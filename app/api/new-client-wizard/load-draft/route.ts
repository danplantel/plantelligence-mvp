export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mergeOnboardingAdvisorContactsIntoKeyContacts } from "@/lib/seed-onboarding-advisor-contacts";
import { getEffectiveWizardUserSetup } from "@/lib/effective-wizard-user-setup";
import {
  resolveUserPrimaryServiceCategoryLabels,
  userPrimaryServicesMapToBenefitsCategory,
} from "@/lib/resolve-user-primary-service-categories";
import { getOnboardingAdvisorBackgroundImage } from "@/lib/wizard-onboarding-background";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the most recent draft wizard session
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false, // Only get draft sessions
      },
      include: {
        companyBasics: true,
        welcomeStatement: true,
        keyContacts: true,
        complianceDocuments: true,
        employeePortalPreview: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!wizardSession) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No draft found"
      });
    }

    // Build the step data object
    const stepData: any = {};

    if (wizardSession.companyBasics) {
      stepData.companyBasics = wizardSession.companyBasics;

      // Set default heroTitle if empty (should default to company name format)
      const companyName = stepData.companyBasics.companyName || "Company Name";
      const defaultHeroTitle = `Welcome to the ${companyName} Benefits Hub!`;

      // Get heroTitle from various sources
      const heroTitle =
        (stepData.companyBasics as any)?.heroTitle ||
        (stepData.companyBasics as any)?.brandImages?._meta?.heroTitle ||
        wizardSession.welcomeStatement?.headline ||
        "";

      // If heroTitle is empty, set default value
      if (!heroTitle || !heroTitle.trim()) {
        stepData.companyBasics = {
          ...stepData.companyBasics,
          heroTitle: defaultHeroTitle,
        };

        // Also update brandImages._meta if it exists
        if (stepData.companyBasics.brandImages) {
          stepData.companyBasics.brandImages = {
            ...stepData.companyBasics.brandImages,
            _meta: {
              ...(stepData.companyBasics.brandImages._meta || {}),
              heroTitle: defaultHeroTitle,
            },
          };
        } else {
          stepData.companyBasics.brandImages = {
            _meta: {
              heroTitle: defaultHeroTitle,
            },
          };
        }
      }

    }

    if (wizardSession.welcomeStatement) {
      stepData.welcomeStatement = wizardSession.welcomeStatement;
    }

    if (wizardSession.keyContacts) {
      const keyContactsData = wizardSession.keyContacts as any;
      const contactsData = keyContactsData.contacts || {};

      // Extract step3SubStep from keyContacts if it exists
      if (contactsData.step3SubStep) {
        stepData.step3SubStep = { step3SubStep: contactsData.step3SubStep };
        // Remove step3SubStep from contacts before assigning to stepData.keyContacts
        const { step3SubStep, ...contactsWithoutSubStep } = contactsData;
        stepData.keyContacts = {
          ...keyContactsData,
          contacts: contactsWithoutSubStep.contacts || contactsWithoutSubStep,
        };
      } else {
        stepData.keyContacts = wizardSession.keyContacts;
      }
    }

    if (wizardSession.complianceDocuments) {
      stepData.complianceDocuments = wizardSession.complianceDocuments;
    }

    if (wizardSession.employeePortalPreview) {
      const previewData = wizardSession.employeePortalPreview.previewData as any;
      // Flatten so step5SubStep, categoryPortalVisibility, etc. are at top level (same as loadStepData)
      stepData.employeePortalPreview = previewData
        ? { ...previewData }
        : wizardSession.employeePortalPreview;

      if (previewData?.disclaimers) {
        stepData.disclaimers = { disclaimers: previewData.disclaimers };
      }
    }

    // --- Seed advisor contacts from onboarding primaryServiceCategories (persisted records, not just prefill)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        phone: true,
        phoneExtension: true,
        title: true,
        company: true,
        advisorLogo: true,
        advisorLogoUrl: true,
        advisorLink: true,
        primaryServiceCategories: true,
      },
    });

    const userSetup = await getEffectiveWizardUserSetup(session.user.id, null);
    const primaryCats = await resolveUserPrimaryServiceCategoryLabels(
      session.user.id,
    );

    const normalizeKeyContacts = (k: any): { blob: Record<string, unknown>; list: any[] } => {
      if (!k || typeof k !== "object") {
        return { blob: { contacts: [] }, list: [] };
      }
      const list = Array.isArray(k.contacts) ? k.contacts : [];
      return { blob: { ...k, contacts: list }, list };
    };

    const { blob: kcBlob, list: existingContacts } = normalizeKeyContacts(
      stepData.keyContacts,
    );

    const mergedContacts = mergeOnboardingAdvisorContactsIntoKeyContacts(
      existingContacts,
      primaryCats,
      {
        name: (userSetup?.name || user?.name) ?? "",
        email: (userSetup?.email || user?.email) ?? "",
        phone: userSetup?.phone || user?.phone || "",
        phoneExtension:
          (userSetup?.phoneExtension ?? user?.phoneExtension) ?? undefined,
        title: (userSetup?.title ?? user?.title) ?? undefined,
        headshot: userSetup?.headshot ?? undefined,
        company: user?.company ?? undefined,
        advisorLogo: user?.advisorLogo ?? undefined,
        advisorLogoUrl: user?.advisorLogoUrl ?? undefined,
        advisorLink: user?.advisorLink ?? undefined,
      },
    );

    if (mergedContacts.length !== existingContacts.length) {
      const newBlob = { ...kcBlob, contacts: mergedContacts };
      stepData.keyContacts = newBlob;
      await prisma.newClientKeyContacts.upsert({
        where: { sessionId: wizardSession.id },
        update: { contacts: newBlob as any },
        create: { sessionId: wizardSession.id, contacts: newBlob as any },
      });
    }

    // --- Category hub hero only: advisor onboarding background → preview JSON (not plan Step 1 brand header).
    // Only when the user has at least one primary service that maps to a benefits category (Retirement, etc.).
    const onboardingAdvisorBg = await getOnboardingAdvisorBackgroundImage(
      session.user.id,
    );
    if (
      onboardingAdvisorBg &&
      userPrimaryServicesMapToBenefitsCategory(primaryCats)
    ) {
      const existingPrev = await prisma.newClientEmployeePortalPreview.findUnique({
        where: { sessionId: wizardSession.id },
      });
      const fromDb = (existingPrev?.previewData as Record<string, unknown>) || {};
      const fromStep =
        stepData.employeePortalPreview &&
        typeof stepData.employeePortalPreview === "object"
          ? (stepData.employeePortalPreview as Record<string, unknown>)
          : {};
      const basePreview = { ...fromDb, ...fromStep };
      if (!basePreview.onboardingCategoryBackgroundImage) {
        basePreview.onboardingCategoryBackgroundImage = onboardingAdvisorBg;
        stepData.employeePortalPreview = {
          ...(stepData.employeePortalPreview || {}),
          onboardingCategoryBackgroundImage: onboardingAdvisorBg,
        };
        await prisma.newClientEmployeePortalPreview.upsert({
          where: { sessionId: wizardSession.id },
          update: { previewData: basePreview as any },
          create: { sessionId: wizardSession.id, previewData: basePreview as any },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: wizardSession.id,
        currentStep: wizardSession.currentStep,
        stepData,
        createdAt: wizardSession.createdAt,
        updatedAt: wizardSession.updatedAt,
      },
      message: "Draft loaded successfully"
    });

  } catch (error) {
    console.error("Error loading draft:", error);
    return NextResponse.json({ error: "Failed to load draft" }, { status: 500 });
  }
}
