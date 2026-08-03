/**
 * Migration script: reads existing Client.employeePortalPreview.benefits[]
 * and upserts each entry into the new Benefit table.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-benefits.ts
 *   or: npx tsx scripts/migrate-benefits.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting benefit migration...\n");

  const clients = await prisma.client.findMany({
    select: { id: true, companyName: true, employeePortalPreview: true },
  });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const client of clients) {
    const ep = client.employeePortalPreview as any;
    const benefits = ep?.benefits;

    if (!Array.isArray(benefits) || benefits.length === 0) {
      skipped++;
      continue;
    }

    for (const b of benefits) {
      const category = b.category;
      if (!category) {
        console.warn(`  [SKIP] Client ${client.companyName} — benefit missing category`);
        skipped++;
        continue;
      }

      try {
        await prisma.benefit.upsert({
          where: {
            clientId_category: { clientId: client.id, category },
          },
          create: {
            clientId: client.id,
            category,
            title: b.title || category,
            shortDescription: b.shortDescription ?? null,
            journeyHeader: b.journeyHeader ?? null,
            journeySubtitle: b.journeySubtitle ?? null,
            journeyBodyText: b.journeyBodyText ?? null,
            planVideo: b.planVideo ?? null,
            planVideoFileName: b.planVideoFileName ?? null,
            partnerLogo: b.partnerLogo ?? null,
            backgroundImage: b.backgroundImage ?? null,
            innerHeaderImage: b.innerHeaderImage ?? null,
            helpCards: b.helpCards ?? null,
            insurancePlanId: b.insurancePlanId ?? null,
            insuranceLoginUrl: b.insuranceLoginUrl ?? null,
            insuranceBackgroundImage: b.insuranceBackgroundImage ?? null,
            insuranceContainerBlockOpacity: b.insuranceContainerBlockOpacity ?? null,
            faqs: b.faqs ?? null,
            supportContacts: b.supportContacts ?? null,
            signatureMode: b.signatureMode ?? null,
            customClosing: b.customClosing ?? null,
            customSignatureName: b.customSignatureName ?? null,
            customSignatureCompany: b.customSignatureCompany ?? null,
            customClosingBold: b.customClosingBold ?? null,
            customClosingItalic: b.customClosingItalic ?? null,
            customSignatureNameBold: b.customSignatureNameBold ?? null,
            customSignatureNameItalic: b.customSignatureNameItalic ?? null,
            customSignatureCompanyBold: b.customSignatureCompanyBold ?? null,
            customSignatureCompanyItalic: b.customSignatureCompanyItalic ?? null,
            heroBackgroundOpacity: b.heroBackgroundOpacity ?? null,
            heroContainerBlockOpacity: b.heroContainerBlockOpacity ?? null,
            heroContainerInverted: b.heroContainerInverted ?? null,
            heroBackgroundInverted: b.heroBackgroundInverted ?? null,
            heroUseGradient: b.heroUseGradient ?? null,
            desktopHeroBackgroundPosition: b.desktopHeroBackgroundPosition ?? null,
            mobileHeroBackgroundPosition: b.mobileHeroBackgroundPosition ?? null,
            isEnabled: b.isEnabled !== false,
          },
          update: {
            title: b.title || category,
            shortDescription: b.shortDescription ?? null,
            journeyHeader: b.journeyHeader ?? null,
            journeySubtitle: b.journeySubtitle ?? null,
            journeyBodyText: b.journeyBodyText ?? null,
            planVideo: b.planVideo ?? null,
            planVideoFileName: b.planVideoFileName ?? null,
            partnerLogo: b.partnerLogo ?? null,
            backgroundImage: b.backgroundImage ?? null,
            innerHeaderImage: b.innerHeaderImage ?? null,
            helpCards: b.helpCards ?? null,
            insurancePlanId: b.insurancePlanId ?? null,
            insuranceLoginUrl: b.insuranceLoginUrl ?? null,
            insuranceBackgroundImage: b.insuranceBackgroundImage ?? null,
            insuranceContainerBlockOpacity: b.insuranceContainerBlockOpacity ?? null,
            faqs: b.faqs ?? null,
            supportContacts: b.supportContacts ?? null,
            isEnabled: b.isEnabled !== false,
          },
        });
        migrated++;
        console.log(`  [OK] ${client.companyName} → ${category}`);
      } catch (err) {
        errors++;
        console.error(`  [ERROR] ${client.companyName} → ${category}:`, err);
      }
    }
  }

  console.log(`\n--- Migration Summary ---`);
  console.log(`Total clients scanned: ${clients.length}`);
  console.log(`Benefits migrated:     ${migrated}`);
  console.log(`Skipped (no data):     ${skipped}`);
  console.log(`Errors:                ${errors}`);
  console.log(`\nDone.`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
