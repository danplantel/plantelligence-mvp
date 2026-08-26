/**
 * Seed 10 placeholder plans (Client records) into the database.
 * Run with: npx tsx scripts/seed-placeholder-plans.ts
 *
 * These placeholder plans can be used across the app for testing/demo purposes.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** All-hidden portal visibility — seeded plans start with every hub hidden so the
 *  advisor explicitly publishes each benefit category from the Benefits wizard.
 *  Mirrors `HIDDEN_CATEGORY_PORTAL_VISIBILITY` in lib/portal-category-visibility.ts. */
const HIDDEN_CATEGORY_PORTAL_VISIBILITY: Record<string, boolean> = {
  Retirement: false,
  "Group Life": false,
  "Group Health": false,
  Other: false,
};

/** Default 4 benefit hubs, all disabled, so the portal + Benefits wizard reflect
 *  them as Hidden until the advisor explicitly publishes each one. */
const DEFAULT_HIDDEN_BENEFITS = [
  { id: "retirement", category: "Retirement", title: "Retirement Plan Benefits", isEnabled: false },
  { id: "health", category: "Group Health", title: "Health Insurance", isEnabled: false },
  { id: "life", category: "Group Life", title: "Life Insurance", isEnabled: false },
  { id: "wellness", category: "Company / Plan Sponsor", title: "Wellness Programs", isEnabled: false },
];

/** Force every benefit hub hidden on a preview payload (preserves other fields).
 *  When no benefits exist yet, seed the 4 default hubs as hidden. */
function withHiddenBenefits(previewData: any): any {
  const base =
    previewData && typeof previewData === "object" && !Array.isArray(previewData)
      ? { ...previewData }
      : {};
  const existing = Array.isArray(previewData?.benefits) ? previewData.benefits : [];
  const benefits =
    existing.length > 0
      ? existing.map((b: any) => ({ ...b, isEnabled: false }))
      : DEFAULT_HIDDEN_BENEFITS;
  return { ...base, benefits };
}

const PLACEHOLDER_PLANS = [
  { companyName: "Acme Corp", planType: "401(k)", brandColor: "#1F3A60", secondaryColor: "#6B7280" },
  { companyName: "Blue Ridge Industries", planType: "403(b)", brandColor: "#1e40af", secondaryColor: "#6b7280" },
  { companyName: "Cascade Technologies", planType: "401(k)", brandColor: "#047857", secondaryColor: "#6B7280" },
  { companyName: "Delta Manufacturing", planType: "Profit Sharing", brandColor: "#b45309", secondaryColor: "#6B7280" },
  { companyName: "Evergreen Healthcare", planType: "403(b)", brandColor: "#0d9488", secondaryColor: "#6B7280" },
  { companyName: "First Federal Credit Union", planType: "401(k)", brandColor: "#1d4ed8", secondaryColor: "#6B7280" },
  { companyName: "Golden Gate Logistics", planType: "401(k)", brandColor: "#92400e", secondaryColor: "#6B7280" },
  { companyName: "Horizon Construction", planType: "SIMPLE IRA", brandColor: "#6d28d9", secondaryColor: "#6B7280" },
  { companyName: "Innovative Solutions Inc.", planType: "401(k)", brandColor: "#15803d", secondaryColor: "#6B7280" },
  { companyName: "Juniper Valley Schools", planType: "403(b)", brandColor: "#0f766e", secondaryColor: "#6B7280" },
  { companyName: "Keystone Financial Group", planType: "401(k)", brandColor: "#1e3a5f", secondaryColor: "#6B7280" },
  { companyName: "Liberty Engineering", planType: "401(k)", brandColor: "#7c3aed", secondaryColor: "#6B7280" },
  { companyName: "Meridian Health Systems", planType: "403(b)", brandColor: "#0891b2", secondaryColor: "#6B7280" },
  { companyName: "North Star Retail", planType: "SIMPLE IRA", brandColor: "#1d4ed8", secondaryColor: "#6B7280" },
  { companyName: "Oakwood Plumbing Supply", planType: "Profit Sharing", brandColor: "#b91c1c", secondaryColor: "#6B7280" },
  { companyName: "Pinnacle Marketing Group", planType: "401(k)", brandColor: "#0f766e", secondaryColor: "#6B7280" },
  { companyName: "Quantum Software Labs", planType: "401(k)", brandColor: "#6366f1", secondaryColor: "#6B7280" },
  { companyName: "Redwood Property Management", planType: "401(k)", brandColor: "#92400e", secondaryColor: "#6B7280" },
  { companyName: "Summit Hospitality", planType: "401(k)", brandColor: "#166534", secondaryColor: "#6B7280" },
  { companyName: "Titan Automotive Group", planType: "401(k)", brandColor: "#1e293b", secondaryColor: "#6B7280" },
];

async function main() {
  // Find the first user to associate plans with
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    console.error("No user found in the database. Please create a user first.");
    process.exit(1);
  }

  console.log(`Using user: ${user.name} (${user.email}) [ID: ${user.id}]`);

  let created = 0;
  let skipped = 0;

  for (const plan of PLACEHOLDER_PLANS) {
    // Check if a plan with this name already exists for this user
    const existing = await prisma.client.findFirst({
      where: {
        userId: user.id,
        companyName: plan.companyName,
      },
    });

    if (existing) {
      // Re-runs also enforce the hidden-by-default benefit visibility on previously
      // seeded placeholder plans, so every seed plan starts with all hubs hidden.
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          categoryPortalVisibility: { ...HIDDEN_CATEGORY_PORTAL_VISIBILITY },
          employeePortalPreview: withHiddenBenefits(
            (existing as any).employeePortalPreview,
          ),
        },
      });
      console.log(`  ⏭  Skipping "${plan.companyName}" — already exists (ID: ${existing.id})`);
      skipped++;
      continue;
    }

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        companyName: plan.companyName,
        status: "Active",
        type: plan.planType || "client",
        brandColor: plan.brandColor,
        secondaryColor: plan.secondaryColor,
        keyContacts: { contacts: [] },
        currentStep: 5,
        // Newly created plans default ALL benefit hubs to hidden — the advisor
        // publishes each category explicitly from the Benefits wizard.
        categoryPortalVisibility: { ...HIDDEN_CATEGORY_PORTAL_VISIBILITY },
        employeePortalPreview: withHiddenBenefits({
          portalTitle: `${plan.companyName} Benefits Hub`,
          portalDescription: `Welcome to the ${plan.companyName} Benefits Hub. Manage your benefits, view documents, and stay informed.`,
          showWelcomeStatement: true,
          showKeyContacts: true,
          showDocuments: true,
          showMeetings: true,
          showVideos: true,
          heroVideo: null,
        }),
      },
    });

    console.log(`  ✅ Created "${plan.companyName}" (ID: ${client.id})`);
    created++;
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
