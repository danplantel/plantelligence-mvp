import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { toR2BrandingKey } from "@/lib/branding-image-url";

/**
 * Normalize an image value: if it's a full proxy URL (e.g. /api/r2/object?key=org/...),
 * extract and return just the R2 key. Otherwise return the value as-is.
 * This prevents accidentally storing resolved proxy URLs instead of raw R2 keys.
 */
function normalizeImageValue(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  // Check if it's a proxy URL like /api/r2/object?key=org/... or http://.../api/r2/object?key=org/...
  const proxyMatch = value.match(/\/api\/r2\/object\?key=([^&]+)/);
  if (proxyMatch) {
    const extractedKey = decodeURIComponent(proxyMatch[1]);
    // Verify it's a valid R2 key
    const r2Key = toR2BrandingKey(extractedKey);
    if (r2Key) return r2Key;
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const data = await request.json();

    // Normalize image fields: strip proxy URLs back to raw R2 keys
    if (data.headshot !== undefined) {
      data.headshot = normalizeImageValue(data.headshot) || "";
    }
    if (data.backgroundImage !== undefined) {
      data.backgroundImage = normalizeImageValue(data.backgroundImage) || null;
    }

    // Find or create wizard session
    let wizardSession = await prisma.wizardSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.wizardSession.create({
        data: { userId },
      });
    }

    const sessionId = wizardSession.id;
    const existing = await prisma.wizardUserSetup.findUnique({
      where: { sessionId },
    });

    const defaults = {
      name: "",
      email: "",
      phone: "",
      phoneExtension: null as string | null,
      title: "",
      designations: [] as string[],
      headshot: "",
      headshotData: null as any,
      backgroundImage: null as string | null,
      backgroundFileName: null as string | null,
      saveAsContact: true,
    };

    const merged = {
      ...defaults,
      ...(existing
        ? {
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          phoneExtension: existing.phoneExtension,
          title: existing.title,
          designations: existing.designations ?? [],
          headshot: existing.headshot ?? "",
          headshotData: existing.headshotData,
          backgroundImage: existing.backgroundImage,
          backgroundFileName: existing.backgroundFileName,
          saveAsContact: existing.saveAsContact ?? true,
        }
        : {}),
      ...(data.name !== undefined && { name: data.name || "" }),
      ...(data.email !== undefined && { email: data.email || "" }),
      ...(data.phone !== undefined && { phone: data.phone || "" }),
      ...(data.phoneExtension !== undefined && { phoneExtension: data.phoneExtension || null }),
      ...(data.title !== undefined && { title: data.title || "" }),
      ...(data.designations !== undefined && { designations: data.designations || [] }),
      ...(data.headshot !== undefined && { headshot: data.headshot || "" }),
      ...(data.headshotData !== undefined && { headshotData: data.headshotData ?? null }),
      ...(data.backgroundImage !== undefined && { backgroundImage: data.backgroundImage || null }),
      ...(data.backgroundFileName !== undefined && { backgroundFileName: data.backgroundFileName || null }),
      ...(data.saveAsContact !== undefined && { saveAsContact: data.saveAsContact ?? true }),
    };

    const result = await prisma.wizardUserSetup.upsert({
      where: { sessionId },
      update: {
        name: merged.name,
        email: merged.email,
        phone: merged.phone,
        phoneExtension: merged.phoneExtension,
        title: merged.title,
        designations: merged.designations,
        headshot: merged.headshot,
        headshotData: merged.headshotData,
        backgroundImage: merged.backgroundImage,
        backgroundFileName: merged.backgroundFileName,
        saveAsContact: merged.saveAsContact,
        updatedAt: new Date(),
      } as any,
      create: {
        sessionId,
        name: merged.name,
        email: merged.email,
        phone: merged.phone,
        phoneExtension: merged.phoneExtension,
        title: merged.title,
        designations: merged.designations,
        headshot: merged.headshot,
        headshotData: merged.headshotData,
        backgroundImage: merged.backgroundImage,
        backgroundFileName: merged.backgroundFileName,
        saveAsContact: merged.saveAsContact,
      } as any,
    });

    // Mirror advisor contact fields on User so /api/profile keeps phone after new empty WizardSessions (3b autofill).
    try {
      await (prisma.user as any).update({
        where: { id: userId },
        data: {
          phone: merged.phone || null,
          phoneExtension: merged.phoneExtension ?? null,
        },
      });
    } catch (userError) {
      console.error("Error updating user profile:", userError);
    }

    return NextResponse.json({ success: true, userSetup: result });
  } catch (error) {
    console.error("Error saving user setup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Find the latest wizard session
    const wizardSession = await prisma.wizardSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({ userSetup: null });
    }

    // Get user setup data - try current session first, then any session for this user
    let userSetup = await prisma.wizardUserSetup.findUnique({
      where: { sessionId: wizardSession.id },
    });

    // If no data in current session, try to find any user setup data for this user
    if (!userSetup) {
      const allSessions = await prisma.wizardSession.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      for (const ws of allSessions) {
        const setupData = await prisma.wizardUserSetup.findUnique({
          where: { sessionId: ws.id },
        });
        if (setupData) {
          userSetup = setupData;
          break;
        }
      }
    }

    return NextResponse.json({ userSetup });
  } catch (error) {
    console.error("Error loading user setup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
