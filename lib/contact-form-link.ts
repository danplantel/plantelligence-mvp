import { uploadFileToR2 } from "@/lib/upload-to-r2";

/**
 * Build the first-party Plantelligence `/contact` URL for a contact's CTA.
 * `to` (the contact's email), `company`, `name`, `avatar` (headshot), and `logo`
 * (company logo) are included when present. base64 `data:` images are skipped —
 * they are too large for a query string.
 */
export function buildContactFormHref(
  to: string,
  company?: string,
  name?: string,
  avatar?: string,
  logo?: string,
  title?: string,
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (company) params.set("company", company);
  if (name) params.set("name", name);
  if (title) params.set("title", title);
  if (avatar && !avatar.startsWith("data:")) params.set("avatar", avatar);
  if (logo && !logo.startsWith("data:")) params.set("logo", logo);
  const qs = params.toString();
  return `${base}/contact${qs ? `?${qs}` : ""}`;
}

/** Minimal contact fields needed to build a /contact link at click time. */
export interface ContactFormCtaContact {
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
  headshot?: string | null;
  title?: string | null;
}

/** Convert a base64 `data:` URL into a File for R2 upload. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64 = ""] = dataUrl.split(",");
  const mime = /^data:([^;]+)/.exec(meta)?.[1] ?? "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Resolve the URL opened by a Contact Form CTA button so the /contact page shows
 * the contact's current name, company, and headshot — even for links that were
 * saved before those params existed. Missing `to` / `company` / `name` / `avatar`
 * are backfilled from the live contact object; a base64 data-URL headshot is
 * uploaded to R2 first (data URLs are too large to carry in a link).
 */
export async function resolveContactFormUrl(
  url: string,
  contact: ContactFormCtaContact | null | undefined,
): Promise<string> {
  if (!url) return url;
  const c = contact || {};

  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "https://plantel.pro",
    );
    if (u.pathname !== "/contact") return url;

    if (!u.searchParams.has("to") && c.email) {
      u.searchParams.set("to", c.email);
    }
    if (!u.searchParams.has("company") && c.companyName) {
      u.searchParams.set("company", c.companyName);
    }
    if (!u.searchParams.has("name") && c.name) {
      u.searchParams.set("name", c.name);
    }
    if (!u.searchParams.has("title") && c.title) {
      u.searchParams.set("title", c.title);
    }
    if (!u.searchParams.has("logo") && c.companyLogo) {
      const logo = c.companyLogo;
      if (!logo.startsWith("data:")) {
        u.searchParams.set("logo", logo);
      }
    }

    if (!u.searchParams.has("avatar") && c.headshot) {
      const headshot = c.headshot;
      if (!headshot.startsWith("data:")) {
        u.searchParams.set("avatar", headshot);
      } else {
        try {
          const file = dataUrlToFile(headshot, `contact-headshot-${Date.now()}.png`);
          const key = await uploadFileToR2({
            file,
            purpose: "upload",
            subPath: "advisor/headshot",
            fileName: file.name,
          });
          if (key) u.searchParams.set("avatar", key);
        } catch (error) {
          console.warn(
            "Failed to upload contact headshot before opening /contact",
            error,
          );
        }
      }
    }

    return u.toString();
  } catch {
    return url;
  }
}
