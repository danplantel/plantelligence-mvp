import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import prisma from "@/lib/prisma";
import { planIdOrSlug } from "@/lib/plan-lookup";
import { getObjectFromR2, isR2Configured } from "@/lib/r2";
import {
  coerceBareBrandingKeySegment,
  toR2BrandingKey,
} from "@/lib/branding-image-url";

export const dynamic = "force-dynamic";

/**
 * The installed app's icon, resolved PER PLAN.
 *
 * A participant installs "their benefits portal", so the home-screen icon is the
 * Plan Company Logo rather than the PlanTelligence mark. The manifest and the
 * iOS `apple-touch-icon` both point here; when the plan has no logo — or the
 * stored value cannot be read — this falls back to the platform icon, so an
 * install never ends up with a broken image.
 *
 * The plan is addressed by its public portal slug. `companyLogo` may be an R2
 * key (`org/...`), an absolute URL, a root-relative path, or a data URL; each is
 * handled without trusting the caller beyond the slug.
 *
 * `sizes` in the manifest are real: the logo is rendered to a square PNG at the
 * requested 192/512 size, contained on white. A plan logo is rarely square, and
 * declaring a square size for an unprocessed image makes some installers reject
 * the icon.
 */

const ICON_SIZE = 192;
const LARGE_ICON_SIZE = 512;

function fallbackFor(size: number): string {
  return size === ICON_SIZE ? "/pwa/icon-192.png" : "/pwa/icon-512.png";
}

function requestedSize(value: string | null): number {
  return value === String(ICON_SIZE) ? ICON_SIZE : LARGE_ICON_SIZE;
}

function decodeDataUrl(value: string): Uint8Array | null {
  const match = /^data:([^;,]+)?((?:;base64)?),(.*)$/s.exec(value);
  if (!match) return null;
  try {
    return match[2] === ";base64"
      ? new Uint8Array(Buffer.from(match[3], "base64"))
      : new Uint8Array(Buffer.from(decodeURIComponent(match[3])));
  } catch {
    return null;
  }
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function readLogo(
  logo: string,
  request: NextRequest,
): Promise<Uint8Array | null> {
  if (logo.startsWith("data:")) return decodeDataUrl(logo);
  if (/^https?:\/\//i.test(logo)) return fetchBytes(logo);
  if (logo.startsWith("/")) {
    return fetchBytes(new URL(logo, request.url).toString());
  }

  // Stored R2 key (org/...). Read server-side, so the icon request does not
  // depend on a portal session the installing browser may not have.
  const key = toR2BrandingKey(logo);
  if (key && isR2Configured()) {
    const object = await getObjectFromR2(key);
    if (object) return object.body;
  }
  return null;
}

async function renderSquareIcon(
  bytes: Uint8Array,
  size: number,
): Promise<Uint8Array | null> {
  try {
    const png = await sharp(Buffer.from(bytes))
      .resize(size, size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const size = requestedSize(request.nextUrl.searchParams.get("size"));
  const fallback = fallbackFor(size);

  const slug = request.nextUrl.searchParams.get("slug")?.trim() || "";
  if (!slug) {
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  try {
    const client = await prisma.client.findFirst({
      where: planIdOrSlug(slug),
      select: { id: true, userId: true, companyLogo: true },
    });
    const storedLogo = String(client?.companyLogo || "").trim();
    if (!storedLogo) {
      return NextResponse.redirect(new URL(fallback, request.url));
    }
    // Heal legacy saves that kept only the final key segment.
    const logo =
      (client
        ? coerceBareBrandingKeySegment(
            storedLogo,
            client.userId,
            client.id,
            "logo",
          )
        : storedLogo) || storedLogo;

    const bytes = await readLogo(logo, request);
    const square = bytes ? await renderSquareIcon(bytes, size) : null;
    if (square) {
      return new Response(square as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          // The logo can change in Settings → Branding. An hour keeps installs
          // snappy without pinning an old icon for long.
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch (error) {
    console.error("[pwa/icon]", error);
  }

  return NextResponse.redirect(new URL(fallback, request.url));
}
