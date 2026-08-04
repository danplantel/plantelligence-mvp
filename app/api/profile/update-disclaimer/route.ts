// app/api/profile/update-disclaimer/route.ts
// POST /api/profile/update-disclaimer
// Body: { disclaimer: string }
// Updates the current user's disclaimer field on the User record AND propagates
// the change to the user's Client/Plan records so the general (portal footer)
// disclaimer stays in sync across plans. Per-category Benefits disclaimers
// (byCategory) are preserved untouched.

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Parse the User.disclaimer value (JSON-stringified array of Disclaimer objects,
 * an array, or plain text) into an array of Disclaimer objects.
 */
function parseDisclaimerArray(raw: string): any[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "string" && parsed.trim()) return [{ text: parsed }];
  } catch {
    // Not JSON — treat as plain text below
  }
  return [{ text: raw }];
}

/** Extract a flat disclosure string from an array of Disclaimer objects. */
function toDisclosuresText(arr: any[]): string {
  return arr
    .map((d: any) => (typeof d === "string" ? d : d?.text || ""))
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (typeof body.disclaimer !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid disclaimer field' }, { status: 400 });
    }

    const disclaimerArray = parseDisclaimerArray(body.disclaimer);
    const disclosuresText = toDisclosuresText(disclaimerArray);

    await prisma.user.update({
      where: { id: userId },
      data: { disclaimer: body.disclaimer },
    });

    // Propagate the updated disclaimer to the user's Client/Plan records so the
    // general (footer) disclaimer reflects the Settings change. The existing
    // disclaimers object is preserved (including per-category Benefits
    // disclaimers in `byCategory`) and only the general `disclaimers` /
    // `disclosuresText` are replaced with the user's disclaimer.
    const clients = await prisma.client.findMany({
      where: { userId },
      select: { id: true, disclaimers: true },
    });

    if (clients.length > 0) {
      await prisma.$transaction(
        clients.map((client) => {
          const existing = (client as any).disclaimers;
          let existingObj: any = null;
          if (existing && typeof existing === "object" && !Array.isArray(existing)) {
            existingObj = existing;
          } else if (typeof existing === "string") {
            try {
              const parsed = JSON.parse(existing);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                existingObj = parsed;
              }
            } catch {
              // Not JSON — no structured object to preserve
            }
          }

          const nextDisclaimers = {
            ...(existingObj || {}),
            disclaimers: disclaimerArray,
            disclosuresText,
            useDefaultDisclosures: false,
          };

          return prisma.client.update({
            where: { id: client.id },
            data: { disclaimers: nextDisclaimers as any },
          });
        }),
      );
    }

    return NextResponse.json({ success: true, propagatedClients: clients.length });
  } catch (error) {
    console.error('Error updating disclaimer:', error);
    return NextResponse.json({ error: 'Failed to update disclaimer' }, { status: 500 });
  }
}
