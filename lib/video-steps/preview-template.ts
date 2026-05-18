import type { VideoWizardState } from "@/lib/video-wizard-store";
import { DEFAULT_HEYGEN_AVATAR_ID } from "@/lib/heygen/constants";

export interface PreviewTemplatePayload {
  type: "preview_template";
  planId?: string;
  generatedAt: string;
  scenes: PreviewScene[];
}

export type PreviewScene =
  | AvatarScene
  | DisclaimerScene
  | ResourceScene
  | StaticScene;

export interface AvatarScene {
  type: "avatar";
  step: number;
  key: string;
  input_text: string;
  avatar_id: string;
  voice_id?: string;
  preview_image?: string;
  background:
    | {
        type: "image";
        url: string;
      }
    | {
        type: "color";
        value: string;
      };
  overlay?: {
    type: "logo" | "image";
    url?: string;
    opacity?: number;
  };
  metadata?: Record<string, string>;
}

export interface ResourceScene {
  type: "resources";
  step: number;
  key: string;
  preview_image?: string;
  contacts: Array<{
    label: string;
    name?: string;
    email?: string;
    phone?: string;
  }>;
  qrUrl?: string;
  branding?: {
    logo?: string | null;
    avatarUrl?: string | null;
  };
}

export interface DisclaimerScene {
  type: "disclaimer";
  step: number;
  key: string;
  preview_image?: string;
  lines: string[];
}

export interface StaticScene {
  type: "static";
  step: number;
  key: string;
  preview_image?: string;
  content: Record<string, string>;
}

type StepData = VideoWizardState["stepData"] | Record<string, any>;

interface PreviewTemplateOptions {
  previewImages?: Record<number, string | undefined>;
}

const pickValue = (...values: Array<string | undefined | null>) =>
  values.find((value) => Boolean(value && value.trim())) || "";

const normalizeDisclaimers = (input: unknown): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    return Object.values(obj)
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
  }
  return [];
};

export function buildVideoPreviewTemplate(
  stepData: StepData,
  options: PreviewTemplateOptions = {},
): PreviewTemplatePayload {
  const step1 = (stepData as any).step1 || {};
  const step2a = (stepData as any).step2a || {};
  const step2c = (stepData as any).step2c || {};
  const step3a = (stepData as any).step3a || {};
  const step4a = (stepData as any).step4a || {};
  const step5a = (stepData as any).step5a || {};
  const step5c = (stepData as any).step5c || {};

  const selectedPlan =
    (stepData as any).selectedPlan || (step1 as any)?.selectedPlan || {};

  const planId =
    stepData.selectedPlanId ||
    step1.selectedPlanId ||
    selectedPlan?.id ||
    undefined;

  const planName = pickValue(
    step1.editedPlanName,
    selectedPlan?.companyName,
    selectedPlan?.clientName,
    "Plan Name",
  );

  const planLogo =
    step1.editedLogo ||
    selectedPlan?.companyLogo ||
    selectedPlan?.clientLogo ||
    null;
  const backgroundImage =
    step1.editedBackgroundImg ||
    selectedPlan?.backgroundImg ||
    selectedPlan?.videoBackgroundImage ||
    null;
  const brandColor =
    step1.brandColor ||
    selectedPlan?.brandColor ||
    selectedPlan?.videoThemeColor ||
    "#1F3A60";

  const avatarUrl =
    stepData.avatarValue ||
    stepData.selectedAvatar ||
    selectedPlan?.videoAvatar ||
    DEFAULT_HEYGEN_AVATAR_ID;
  const voiceId =
    stepData.voiceId || stepData.selectedVoice || "elevenlabs-premium-01";

  const scenes: PreviewScene[] = [];

  scenes.push({
    type: "avatar",
    step: 1,
    key: "title_screen",
    input_text: `Welcome to ${planName}.`,
    avatar_id: avatarUrl,
    voice_id: voiceId,
    preview_image: options.previewImages?.[1],
    background: backgroundImage
      ? { type: "image", url: backgroundImage }
      : { type: "color", value: brandColor },
    overlay: planLogo
      ? {
          type: "logo",
          url: planLogo,
          opacity: (step1.backgroundOpacity ?? 100) / 100,
        }
      : undefined,
    metadata: {
      plan_name: planName,
      plan_type:
        step1.planType ||
        selectedPlan?.planDetails?.planType ||
        step2a.planType ||
        "",
    },
  });

  scenes.push({
    type: "avatar",
    step: 2,
    key: "eligibility",
    input_text: `Eligibility overview: Age ${pickValue(
      step2a.customAgeRequirement,
      step2a.ageRequirement,
      "none",
    )}, Service ${pickValue(
      step2a.customServiceRequirement,
      step2a.serviceRequirement,
      "none",
    )}, Entry ${pickValue(
      step2a.customEntryDate,
      step2a.entryDate,
      "Immediate",
    )}.`,
    avatar_id: avatarUrl,
    voice_id: voiceId,
    preview_image: options.previewImages?.[2],
    background: backgroundImage
      ? { type: "image", url: backgroundImage }
      : { type: "color", value: brandColor },
    metadata: {
      age_requirement:
        step2a.customAgeRequirement ||
        step2a.ageRequirement ||
        "No age requirement",
      service_requirement:
        step2a.customServiceRequirement ||
        step2a.serviceRequirement ||
        "No service requirement",
      entry_period:
        step2a.customEntryDate || step2a.entryDate || "Immediate entry",
    },
  });

  scenes.push({
    type: "avatar",
    step: 2,
    key: "deferrals",
    input_text: `Deferrals overview with methods ${(
      step2c.enrollmentMethods || []
    )
      .map((method: string) => method)
      .join(", ")}.`,
    avatar_id: avatarUrl,
    voice_id: voiceId,
    preview_image: options.previewImages?.[6],
    background: backgroundImage
      ? { type: "image", url: backgroundImage }
      : { type: "color", value: brandColor },
    metadata: {
      enrollment_methods: (step2c.enrollmentMethods || [])
        .map((method: string) => method)
        .join(", "),
      auto_enrollment_rate:
        step2c.customEnrollmentRate || step2c.enrollmentRate || "",
      auto_escalation:
        step2c.customAutoEscalation || step2c.autoEscalation || "",
      deferral_cap: step2c.customDeferralCap || step2c.deferralCap || "",
    },
  });

  scenes.push({
    type: "avatar",
    step: 3,
    key: "employer_contributions",
    input_text: `Employer contributions cover ${pickValue(
      step3a.primaryContributionType,
      "company match",
    )}. ${pickValue(
      step3a.companyMatch?.customFormula,
      step3a.companyMatch?.formula,
      step3a.safeHarbor?.customFormula,
      step3a.safeHarbor?.formula,
      step3a.fixedAmount?.customDetails,
      step3a.fixedAmount?.details,
      step3a.profitSharing?.customDetails,
      step3a.profitSharing?.details,
      "",
    )}`,
    avatar_id: avatarUrl,
    voice_id: voiceId,
    preview_image: options.previewImages?.[3],
    background: backgroundImage
      ? { type: "image", url: backgroundImage }
      : { type: "color", value: brandColor },
    metadata: {
      primary_contribution_type:
        step3a.primaryContributionType || "Not specified",
      vesting: pickValue(
        step3a.companyMatch?.customVesting,
        step3a.companyMatch?.vesting,
        step3a.safeHarbor?.customVesting,
        step3a.safeHarbor?.vesting,
        step3a.fixedAmount?.customVesting,
        step3a.fixedAmount?.vesting,
        step3a.profitSharing?.customVesting,
        step3a.profitSharing?.vesting,
      ),
    },
  });

  scenes.push({
    type: "avatar",
    step: 4,
    key: "investments",
    input_text: `Investments include ${(
      step4a.investmentOptions || []
    ).join(", ")}. Additional features: ${(step4a.planFeatures || [])
      .filter((item: string) => item !== "custom")
      .join(", ")}`,
    avatar_id: avatarUrl,
    voice_id: voiceId,
    preview_image: options.previewImages?.[4],
    background: backgroundImage
      ? { type: "image", url: backgroundImage }
      : { type: "color", value: brandColor },
    metadata: {
      plan_features: (step4a.planFeatures || [])
        .filter((item: string) => item !== "custom")
        .join(", "),
      custom_feature: step4a.customFeature || "",
    },
  });

  scenes.push({
    type: "resources",
    step: 5,
    key: "resources",
    preview_image: options.previewImages?.[5],
    contacts: [
      {
        label: "primary",
        name: step5a.contactInformation?.primaryName,
        email: step5a.contactInformation?.primaryEmail,
        phone: step5a.contactInformation?.primaryPhone,
      },
      {
        label: "secondary",
        name: step5a.contactInformation?.secondaryName,
        email: step5a.contactInformation?.secondaryEmail,
        phone: step5a.contactInformation?.secondaryPhone,
      },
      {
        label: "tertiary",
        name: step5a.contactInformation?.tertiaryName,
        email: step5a.contactInformation?.tertiaryEmail,
        phone: step5a.contactInformation?.tertiaryPhone,
      },
    ],
    qrUrl: step5a.qrUrl || "",
    branding: {
      logo: planLogo,
      avatarUrl: "/HeyGen-AI.png",
    },
  });

  scenes.push({
    type: "disclaimer",
    step: 5,
    key: "disclaimer",
    preview_image: options.previewImages?.[5],
    lines: normalizeDisclaimers(step5c.disclaimer || step5c.disclaimers),
  });

  const generatedAt = new Date().toISOString();

  if (typeof console !== "undefined") {
    console.groupCollapsed(
      `[PreviewTemplate] State snapshot ${
        planId ? `for plan ${planId}` : ""
      } (${scenes.length} scenes)`,
    );
    console.groupEnd();
  }

  return {
    type: "preview_template",
    generatedAt,
    planId,
    scenes,
  };
}

