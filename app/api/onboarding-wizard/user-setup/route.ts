import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const data = await request.json();

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

    // Partial update: merge with existing so Step 2 can save only primaryServiceCategories without wiping name/email
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
      primaryServiceCategories: [] as string[],
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
          primaryServiceCategories: Array.isArray((existing as any).primaryServiceCategories)
            ? (existing as any).primaryServiceCategories
            : [],
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
      ...(data.primaryServiceCategories !== undefined && {
        primaryServiceCategories: data.primaryServiceCategories || [],
      }),
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
        primaryServiceCategories: merged.primaryServiceCategories,
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
        primaryServiceCategories: merged.primaryServiceCategories,
      } as any,
    });

    // Mirror advisor contact fields on User so /api/profile keeps phone after new empty WizardSessions (3b autofill).
    try {
      await (prisma.user as any).update({
        where: { id: userId },
        data: {
          primaryServiceCategories: merged.primaryServiceCategories,
          phone: merged.phone || null,
          phoneExtension: merged.phoneExtension ?? null,
        },
      });
    } catch (userError) {
      console.error("Error updating user profile with service categories:", userError);

      // Fallback for dev mode where Prisma Client might be stale
      if (process.env.NODE_ENV === 'development') {
        console.log("Attempting fallback update via script...");
        try {
          const { exec } = require('child_process');
          const categoriesJson = JSON.stringify(merged.primaryServiceCategories);

          await new Promise<void>((resolve, reject) => {
            exec(
              'npx ts-node scripts/update-advisor-profile.ts',
              {
                cwd: process.cwd(),
                env: { ...process.env, USER_ID: userId, CATEGORIES_JSON: categoriesJson }
              },
              (error: any, stdout: string, stderr: string) => {
                if (error) {
                  console.error(`Fallback script error: ${error.message}`);
                  reject(error);
                  return;
                }
                if (stderr) console.error(`Fallback stderr: ${stderr}`);
                console.log(`Fallback stdout: ${stdout}`);
                resolve();
              }
            );
          });
        } catch (scriptError) {
          console.error("Fallback script execution failed:", scriptError);
        }
      }
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

    // Normalize so primaryServiceCategories is always a plain array (for Step 2 → Settings)
    if (userSetup) {
      const raw = userSetup as any;
      userSetup = {
        ...raw,
        primaryServiceCategories: Array.isArray(raw.primaryServiceCategories)
          ? [...raw.primaryServiceCategories]
          : [],
      };
    }

    return NextResponse.json({ userSetup });
  } catch (error) {
    console.error("Error loading user setup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
