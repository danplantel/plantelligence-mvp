import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import {
  normalizeContactImagesToR2,
  uploadBrandingToR2,
} from "@/lib/branding-r2";

/**
 * POST /api/maintenance/normalize-branding
 *
 * ONE-SHOT DATA MIGRATION — safe to delete once it has been run.
 *
 * Rows written before the write paths normalised branding were able to store inline
 * data URLs, and those are re-sent to the browser by every list/portal route that reads
 * them. Measured on this database: 3.7 MB of `Benefit` images for six rows, 7.4 MB once
 * the same values were copied into the legacy `employeePortalPreview` mirror, and
 * 848 KB of contact images.
 *
 * This walks the signed-in advisor's OWN plans and, for each inline (data-URL) image:
 *  1. uploads it to R2 and rewrites `Benefit.partnerLogo` / `backgroundImage` /
 *     `innerHeaderImage` / `insuranceBackgroundImage` with the returned key;
 *  2. does the same for `Client.keyContacts[].headshot / teamImage / companyLogo`;
 *  3. strips the remaining inline copies out of `employeePortalPreview.benefits`
 *     (replaced by the corresponding row's key where one exists, dropped otherwise).
 *
 * Idempotent: a second run finds nothing inline and writes nothing. Images that fail to
 * upload (R2 unconfigured) are reported and left untouched rather than lost.
 */
export const dynamic = "force-dynamic";

const BENEFIT_IMAGE_FIELDS = [
  { field: "partnerLogo", slot: "logo", fileName: "benefit-logo.png" },
  { field: "backgroundImage", slot: "background", fileName: "benefit-background.png" },
  { field: "innerHeaderImage", slot: "background", fileName: "benefit-inner-header.png" },
  {
    field: "insuranceBackgroundImage",
    slot: "background",
    fileName: "insurance-background.png",
  },
] as const;

/** Legacy mirror key → the Benefit column that supersedes it. */
const MIRROR_IMAGE_FIELDS: [string, string][] = [
  ["partnerLogo", "partnerLogo"],
  ["image", "backgroundImage"],
  ["backgroundImage", "backgroundImage"],
  ["innerHeaderImage", "innerHeaderImage"],
  ["insuranceBackgroundImage", "insuranceBackgroundImage"],
];

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

const sizeOf = (value: unknown): number =>
  typeof value === "string" ? value.length : 0;

const normalizeCategory = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        keyContacts: true,
        employeePortalPreview: true,
      },
    });

    const report = {
      plansScanned: clients.length,
      benefitImagesMoved: 0,
      contactListsRewritten: 0,
      mirrorInlineImagesRemoved: 0,
      failures: [] as string[],
      before: { benefitBytes: 0, contactBytes: 0, mirrorBytes: 0 },
      after: { benefitBytes: 0, contactBytes: 0, mirrorBytes: 0 },
    };

    for (const client of clients) {
      // ── 1. Benefit rows ──
      const rows = await prisma.benefit.findMany({
        where: { clientId: client.id },
      });
      for (const row of rows) {
        const patch: Record<string, string> = {};
        for (const { field, slot, fileName } of BENEFIT_IMAGE_FIELDS) {
          const value = (row as Record<string, unknown>)[field];
          if (!isDataUrl(value)) continue;
          report.before.benefitBytes += value.length;
          const key = await uploadBrandingToR2({
            dataUrlOrFile: value,
            fileName,
            clientId: client.id,
            slot,
          });
          if (!key) {
            report.failures.push(
              `${client.companyName} / ${row.category} / ${field}: upload failed (left inline)`,
            );
            report.after.benefitBytes += value.length;
            continue;
          }
          patch[field] = key;
          report.after.benefitBytes += key.length;
          report.benefitImagesMoved++;
        }
        if (Object.keys(patch).length > 0) {
          await prisma.benefit.update({ where: { id: row.id }, data: patch });
        }
      }

      // ── 2. keyContacts ──
      const contactsBefore = sizeOf(JSON.stringify(client.keyContacts ?? null));
      const contacts = await normalizeContactImagesToR2(
        client.keyContacts,
        client.id,
      );
      if (contacts !== client.keyContacts) {
        const contactsAfter = sizeOf(JSON.stringify(contacts ?? null));
        report.before.contactBytes += contactsBefore;
        report.after.contactBytes += contactsAfter;
        await prisma.client.update({
          where: { id: client.id },
          data: { keyContacts: contacts as never },
        });
        report.contactListsRewritten++;
      }

      // ── 3. Legacy mirror ──
      const epp = (client.employeePortalPreview as Record<string, unknown>) ?? null;
      const mirrorBenefits = Array.isArray(epp?.benefits)
        ? (epp!.benefits as Record<string, unknown>[])
        : null;
      if (epp && mirrorBenefits) {
        const normalizedRows = await prisma.benefit.findMany({
          where: { clientId: client.id },
          select: {
            category: true,
            partnerLogo: true,
            backgroundImage: true,
            innerHeaderImage: true,
            insuranceBackgroundImage: true,
          },
        });
        const rowByCategory = new Map(
          normalizedRows.map((r) => [normalizeCategory(r.category), r]),
        );

        const before = sizeOf(JSON.stringify(epp));
        let changed = false;
        const cleaned = mirrorBenefits.map((entry) => {
          if (!entry || typeof entry !== "object") return entry;
          const row = rowByCategory.get(normalizeCategory(entry.category));
          let next: Record<string, unknown> | null = null;
          for (const [mirrorKey, rowField] of MIRROR_IMAGE_FIELDS) {
            if (!isDataUrl(entry[mirrorKey])) continue;
            if (!next) next = { ...entry };
            const replacement = row
              ? (row as Record<string, unknown>)[rowField]
              : null;
            if (typeof replacement === "string" && !isDataUrl(replacement)) {
              next[mirrorKey] = replacement;
            } else {
              // No authoritative value to point at — drop the inline copy. Readers
              // resolve these from the Benefit row, which is the source of truth.
              delete next[mirrorKey];
            }
            changed = true;
            report.mirrorInlineImagesRemoved++;
          }
          return next ?? entry;
        });

        report.before.mirrorBytes += before;
        if (changed) {
          const updatedMirror = { ...epp, benefits: cleaned };
          report.after.mirrorBytes += sizeOf(JSON.stringify(updatedMirror));
          await prisma.client.update({
            where: { id: client.id },
            data: { employeePortalPreview: updatedMirror as never },
          });
        } else {
          report.after.mirrorBytes += before;
        }
      }
    }

    const savedBytes =
      report.before.benefitBytes -
      report.after.benefitBytes +
      (report.before.contactBytes - report.after.contactBytes) +
      (report.before.mirrorBytes - report.after.mirrorBytes);

    return NextResponse.json({ success: true, savedBytes, ...report });
  } catch (error) {
    console.error("[maintenance/normalize-branding] failed:", error);
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 },
    );
  }
}
