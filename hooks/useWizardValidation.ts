import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  clientProfileSchema,
  teamSizeSchema,
  servicesSchema,
  insuranceLicensingSchema,
  teamMembersSchema,
  brandingSchema,
  employerScopeSchema,
  userSetupSchema,
} from "@/lib/wizard-validation";

// Combined schemas for each wizard step
export const step1Schema = z.object({
  clientProfile: clientProfileSchema,
  teamSize: teamSizeSchema,
});

export const step2Schema = z.object({
  services: servicesSchema,
  insuranceLicensing: insuranceLicensingSchema,
});

export const step3Schema = brandingSchema;

export const step4Schema = z.object({
  userSetup: userSetupSchema,
  employerScope: employerScopeSchema,
  teamMembers: teamMembersSchema,
});

export const step5Schema = z.object({}); // Summary step - no validation needed

// Type definitions for each step
export type Step1FormData = z.infer<typeof step1Schema>;
export type Step2FormData = z.infer<typeof step2Schema>;
export type Step3FormData = z.infer<typeof step3Schema>;
export type Step4FormData = z.infer<typeof step4Schema>;
export type Step5FormData = z.infer<typeof step5Schema>;

// Hook for step 1 validation
export const useStep1Validation = (defaultValues?: Partial<Step1FormData>) => {
  return useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      clientProfile: {
        organizationType: "ADVISOR" as any,
        customOrganization: "",
      },
      teamSize: {
        teamSize: "SMALL" as any,
      },
      ...defaultValues,
    },
    mode: "onChange",
  });
};

// Hook for step 2 validation
export const useStep2Validation = (defaultValues?: Partial<Step2FormData>) => {
  return useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      services: {
        services: [],
      },
      insuranceLicensing: {
        offersInsurance: false,
        attestation: false,
      },
      ...defaultValues,
    },
    mode: "onChange",
  });
};

// Hook for step 3 validation
export const useStep3Validation = (defaultValues?: Partial<Step3FormData>) => {
  return useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      brandColor: "#1F3A60",
      subdomain: "",
      ...defaultValues,
    },
    mode: "onChange",
  });
};

// Hook for step 4 validation
export const useStep4Validation = (defaultValues?: Partial<Step4FormData>) => {
  return useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      userSetup: {
        name: "",
        email: "",
        phone: "",
        title: "",
        designations: [],
        headshot: "",
      },
      employerScope: {
        servesMultipleEmployers: false,
      },
      teamMembers: {
        members: [],
      },
      ...defaultValues,
    },
    mode: "onChange",
  });
};

// Hook for step 5 validation (summary - no validation needed)
export const useStep5Validation = (defaultValues?: Partial<Step5FormData>) => {
  return useForm<Step5FormData>({
    defaultValues: {
      ...defaultValues,
    },
    mode: "onChange",
  });
};

// Generic hook for any step validation
export const useWizardStepValidation = (
  step: number,
  defaultValues?: any
) => {
  switch (step) {
    case 1:
      return useStep1Validation(defaultValues);
    case 2:
      return useStep2Validation(defaultValues);
    case 3:
      return useStep3Validation(defaultValues);
    case 4:
      return useStep4Validation(defaultValues);
    case 5:
      return useStep5Validation(defaultValues);
    default:
      throw new Error(`Invalid step number: ${step}`);
  }
};
