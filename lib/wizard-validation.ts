import { z } from "zod";
import { OrganizationType, TeamSize, ServiceType, LicenseType, BenefitType } from "@/types/wizard";

/**
 * Extract field names from error message for destructive styling
 */
const getFieldFromError = (message: string): string[] => {
  const fields: string[] = [];
  
  // Check for specific field names in the error message
  if (message.includes("organizationType")) fields.push("organizationType");
  if (message.includes("teamSize")) fields.push("teamSize");
  if (message.includes("services")) fields.push("services");
  if (message.includes("logo")) fields.push("logo");
  if (message.includes("organizationName")) fields.push("organizationName");
  if (message.includes("website")) fields.push("website");
  if (message.includes("brandColor")) fields.push("brandColor");
  if (message.includes("subdomain")) fields.push("subdomain");
  if (message.includes("name")) fields.push("name");
  if (message.includes("email")) fields.push("email");
  if (message.includes("phone")) fields.push("phone");
  if (message.includes("title")) fields.push("title");
  
  // Fallback to single field for backward compatibility
  if (fields.length === 0) {
    if (message.includes("organization type")) return ["organizationType"];
    if (message.includes("team size")) return ["teamSize"];
    if (message.includes("service")) return ["services"];
    if (message.includes("logo")) return ["logo"];
    if (message.includes("organization name")) return ["organizationName"];
    if (message.includes("website")) return ["website"];
    if (message.includes("mission")) return ["missionStatement"];
    if (message.includes("color")) return ["brandColor"];
    if (message.includes("subdomain")) return ["subdomain"];
    if (message.includes("branding") || message.includes("Branding")) return ["branding"];
    if (message.includes("name")) return ["name"];
    if (message.includes("email")) return ["email"];
    if (message.includes("phone")) return ["phone"];
    if (message.includes("title")) return ["title"];
    if (message.includes("designation")) return ["designations"];
    if (message.includes("headshot")) return ["headshot"];
    if (message.includes("background")) return ["backgroundImage"];
    return ["unknown"];
  }
  
  return fields;
};
import { isValidDomain, normalizeCleanDomain } from "./url-utils";

// Client Profile validation
export const clientProfileSchema = z.object({
  organizationType: z.nativeEnum(OrganizationType, {
    required_error: "Please select an organization type",
  }),
  customOrganization: z.string().nullable().optional(),
  organizationName: z.string().nullable().optional(), // From branding step
  website: z.string().nullable().optional(), // From branding step
}).refine((data) => {
  if (data.organizationType === OrganizationType.OTHER) {
    return data.customOrganization && data.customOrganization.trim().length > 0;
  }
  return true;
}, {
  message: "Please describe your organization",
  path: ["customOrganization"],
});

// Team Size validation
export const teamSizeSchema = z.object({
  teamSize: z.nativeEnum(TeamSize, {
    required_error: "Please select a team size",
  }),
});

// Services validation - now multi-select with custom input (1–4 categories)
export const servicesSchema = z.object({
  services: z
    .array(z.nativeEnum(ServiceType))
    .min(1, "Please select at least one service")
    .max(4, "Maximum 4 categories allowed"),
  customService: z.string().optional(),
}).refine((data) => {
  // If OTHER is selected, customService must be provided and not empty
  if (data.services.includes(ServiceType.OTHER)) {
    return data.customService && data.customService.trim().length > 0;
  }
  return true;
}, {
  message: "Please specify other benefits",
  path: ["customService"],
}).refine((data) => {
  // Custom service must be 50 characters or less
  if (data.customService) {
    return data.customService.length <= 50;
  }
  return true;
}, {
  message: "Custom benefits must be 50 characters or less",
  path: ["customService"],
});

// Insurance Licensing validation
export const insuranceLicensingSchema = z.object({
  offersInsurance: z.boolean().optional().default(false),
  licenseTypes: z.array(z.nativeEnum(LicenseType)).optional(),
  statesLicensed: z.array(z.string()).optional(),
  licenseNumbers: z.record(z.string()).optional(),
  attestation: z.boolean().optional().default(false),
  licenses: z.array(z.object({
    id: z.string(),
    state: z.string().min(1, "State is required"),
    type: z.string().min(1, "Please select a license type").refine(
      (val) => Object.values(LicenseType).includes(val as LicenseType),
      "Please select a valid license type"
    ),
    customType: z.string().max(50, "License type must be 50 characters or less").optional(),
    number: z.string()
      .min(1, "Please enter a license number")
      .regex(/^[A-Za-z0-9\-\/]+$/, "License number can only contain letters, numbers, - and /"),
  })).optional(),
}).refine((data) => {
  // If offersInsurance is true AND has licenses, then licenses must be valid
  if (data.offersInsurance && data.licenses && data.licenses.length > 0) {
    // Check that all licenses have required fields
    const invalidLicenses = data.licenses.filter(license => 
      !license.state || 
      !license.type || 
      !license.number || 
      license.number.trim().length === 0 ||
      // If type is "other", customType must be provided
      (license.type === "other" && (!license.customType || license.customType.trim().length === 0))
    );
    
    if (invalidLicenses.length > 0) {
      const errorMessages = invalidLicenses.map((license, index) => {
        const licenseIndex = data.licenses!.indexOf(license) + 1;
        const errors = [];
        
        if (!license.type) {
          errors.push(`License ${licenseIndex} (${license.state || 'Unknown'}): Please select a license type`);
        }
        if (license.type === "other" && (!license.customType || license.customType.trim().length === 0)) {
          errors.push(`License ${licenseIndex} (${license.state || 'Unknown'}): Please specify the license type`);
        }
        if (!license.number || license.number.trim().length === 0) {
          errors.push(`License ${licenseIndex} (${license.state || 'Unknown'}): Please enter a license number`);
        }
        
        return errors.join(", ");
      });
      
      throw new Error(errorMessages.join(", "));
    }
  }
  return true;
}, {
  message: "License validation failed",
  path: ["licenses"],
});

// Team Members validation
export const teamMembersSchema = z.object({
  members: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    role: z.string().min(1, "Role is required"),
    isAdmin: z.boolean(),
  })),
});

// Helper function to validate website URL
const isValidWebsiteUrl = (url: string): boolean => {
   if (!url) return false;
   
   // Add protocol if missing
   let urlToValidate = url;
   if (!url.startsWith("http://") && !url.startsWith("https://")) {
     urlToValidate = "https://" + url;
   }
   
   try {
     const urlObj = new URL(urlToValidate);
     // Check if it has a valid domain
     return urlObj.hostname.includes(".") && urlObj.hostname.length > 0;
   } catch {
     return false;
   }
 };

// Branding validation
export const brandingSchema = z.object({
   logo: z.string().min(1, "Logo is required"),
   logoFileName: z.string().optional(),
   backgroundImage: z.string().nullable().optional(),
   backgroundFileName: z.string().optional(),
   organizationName: z.string().nullable().optional(),
   website: z.string().refine(
     (url) => isValidWebsiteUrl(url),
     { message: "Please enter a valid website URL (e.g., example.com or https://example.com)" }
   ),
   missionStatement: z.string().optional(),
   brandColor: z.string().min(1, "Brand color is required").refine(
     (color) => {
       // Allow hex colors, gradients, and other valid CSS colors
       return color && color.trim().length > 0;
     },
     { message: "Brand color is required" }
   ),
   aiAvatar: z.string().optional(),
   avatarFileName: z.string().optional(),
   subdomain: z.string().min(1, "Subdomain is required").refine(
     (subdomain) => {
       // Allow subdomains with dots and basic characters
       return subdomain && subdomain.trim().length > 0;
     },
     { message: "Subdomain is required" }
   ),
 });


// Employer Scope validation
export const employerScopeSchema = z.object({
  servesMultipleEmployers: z.boolean(),
});

// User Setup validation
export const userSetupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string()
    .min(1, "Phone number is required")
    .refine((phone) => {
      // Remove all non-digit characters
      const digits = phone.replace(/\D/g, '');
      // Accept 7-11 digits (flexible for different formats)
      const isValid = digits.length >= 7 && digits.length <= 11;
      return isValid;
    }, {
      message: "Please enter a valid phone number (7-11 digits)"
    }),
  title: z.string().min(1, "Title is required"),
  designations: z.array(z.string()).optional(),
  headshot: z.string().optional().default(""),
  headshotFileName: z.string().optional(),
  headshotData: z.any().optional().nullable(),
  backgroundImage: z.string().optional().default(""),
  backgroundFileName: z.string().optional(),
  primaryServiceCategories: z.array(z.string()).optional(),
});

// Validation functions
export const validateClientProfile = (data: any) => {
  // Handle null values from database
  const processedData = {
    ...data,
    customOrganization: data.customOrganization || "",
  };
  return clientProfileSchema.parse(processedData);
};

export const validateTeamSize = (data: any) => {
  return teamSizeSchema.parse(data);
};

export const validateServices = (data: any) => {
  try {
    const result = servicesSchema.parse(data);
    return result;
  } catch (error) {
    throw error;
  }
};

export const validateInsuranceLicensing = (data: any) => {
  try {
    const result = insuranceLicensingSchema.parse(data);
    return result;
  } catch (error) {
    throw error;
  }
};

export const validateTeamMembers = (data: any) => {
  return teamMembersSchema.parse(data);
};

export const validateBranding = (data: any) => {
  return brandingSchema.parse(data);
};


export const validateEmployerScope = (data: any) => {
  return employerScopeSchema.parse(data);
};

export const validateUserSetup = (data: any) => {
  return userSetupSchema.parse(data);
};

// Validation for current step
export const validateCurrentStep = async (step: number, stepData: any) => {
  try {
    
    switch (step) {
      case 1:
        // Step 1: User Profile and Team Size are required
        // Check if we have the required data in stepData
        const clientProfile = stepData.clientProfile;
        const teamSize = stepData.teamSize;
        
        
        const step1Errors: string[] = [];
        
        if (!clientProfile?.organizationType) {
          step1Errors.push("organizationType");
        }
        
        if (!teamSize?.teamSize || teamSize.teamSize === undefined) {
          step1Errors.push("teamSize");
        }
        
        if (step1Errors.length > 0) {
          throw new Error(`Please complete the following fields: ${step1Errors.join(", ")}`);
        }
        
        // Validate the data
        validateClientProfile(clientProfile);
        validateTeamSize(teamSize);
        break;
      
      case 2:
        break;
        // Step 2: Services are now required
        
        const step2Errors: string[] = [];
        
        // Services are required
        if (!stepData.services?.services || stepData.services.services.length === 0) {
          step2Errors.push("services");
        }
        
        if (step2Errors.length > 0) {
          throw new Error(`Please complete the following fields: ${step2Errors.join(", ")}`);
        }
        
        // Clean up null values that might cause validation issues
        const cleanServices = {
          ...stepData.services,
          services: stepData.services.services || [],
          customService: stepData.services.customService || ""
        };
        validateServices(cleanServices);
        if (stepData.insuranceLicensing) {
          // Clean up null values in insuranceLicensing
          const cleanInsuranceLicensing = {
            ...stepData.insuranceLicensing,
            licenses: stepData.insuranceLicensing.licenses || [],
            licenseTypes: stepData.insuranceLicensing.licenseTypes || [],
            statesLicensed: stepData.insuranceLicensing.statesLicensed || [],
            licenseNumbers: stepData.insuranceLicensing.licenseNumbers || {}
          };
          
          
          // Only validate if user actually offers insurance AND has licenses
          if (cleanInsuranceLicensing.offersInsurance && 
              cleanInsuranceLicensing.licenses && 
              cleanInsuranceLicensing.licenses.length > 0) {
            try {
              validateInsuranceLicensing(cleanInsuranceLicensing);
            } catch (error: any) {
              // Pass through the specific error message instead of replacing it
              throw error;
            }
          } else {
            // If offersInsurance is true but no licenses, that's fine for step 2
            // The user can add licenses later or not offer insurance
          }
        }
        break;
      
      case 3:
        // Step 3: Branding with required fields
        const step3Errors: string[] = [];
        
        // Clean up null values in branding data
        const cleanBranding = {
          ...stepData.branding,
          logo: stepData.branding?.logo || "",
          logoFileName: stepData.branding?.logoFileName || "",
          backgroundImage: stepData.userSetup?.backgroundImage || "",
          backgroundFileName: stepData.branding?.backgroundFileName || "",
          organizationName: stepData.branding?.organizationName || "",
          website: stepData.branding?.website || "",
          missionStatement: stepData.branding?.missionStatement || "",
          brandColor: stepData.branding?.brandColor || "",
          aiAvatar: stepData.branding?.aiAvatar || "",
          avatarFileName: stepData.branding?.avatarFileName || "",
          subdomain: stepData.branding?.subdomain || ""
        };
        
        
        // Check for required fields
        if (!cleanBranding.logo || cleanBranding.logo.trim() === "") {
          step3Errors.push("logo");
        }
        if (!cleanBranding.organizationName || cleanBranding.organizationName.trim() === "") {
          step3Errors.push("organizationName");
        }
        if (!cleanBranding.website || cleanBranding.website.trim() === "") {
          step3Errors.push("website");
        }
        if (!cleanBranding.brandColor || cleanBranding.brandColor.trim() === "") {
          step3Errors.push("brandColor");
        }
        if (!cleanBranding.subdomain || cleanBranding.subdomain.trim() === "") {
          step3Errors.push("subdomain");
        }
        
        if (step3Errors.length === 0) {
          validateBranding(cleanBranding);
        }
        
        if (step3Errors.length > 0) {
          throw new Error(`Please complete the following fields: ${step3Errors.join(", ")}`);
        }
        break;
      
        case 4:
          const step4Errors: string[] = [];
        
          const cleanUserSetup = {
            ...stepData.userSetup,
            name: stepData.userSetup?.name?.trim() || "",
            email: stepData.userSetup?.email?.trim() || "",
            phone: stepData.userSetup?.phone?.trim() || "",
            title: stepData.userSetup?.title?.trim() || "",
            headshot: stepData.userSetup?.headshot || "",
            designations: stepData.userSetup?.designations || [],
            headshotFileName: stepData.userSetup?.headshotFileName || "",
            backgroundFileName: stepData.userSetup?.backgroundFileName || "",
          };
        
          if (!cleanUserSetup.name) step4Errors.push("name");
          if (!cleanUserSetup.email) step4Errors.push("email");
          if (!cleanUserSetup.phone) step4Errors.push("phone");
          if (!cleanUserSetup.title) step4Errors.push("title");
        
          if (step4Errors.length === 0) {
            validateUserSetup(cleanUserSetup);
          }
        
          if (stepData.employerScope) {
            validateEmployerScope(stepData.employerScope);
          }
          if (stepData.teamMembers) {
            validateTeamMembers(stepData.teamMembers);
          }
        
          if (step4Errors.length > 0) {
            throw new Error(`Please complete the following fields: ${step4Errors.join(", ")}`);
          }
        
          break;
              
      case 5:
        // Disclaimers step - validate if "Add Now" was selected but no disclaimers added
        if (stepData.disclaimers?.disclaimers) {
          const disclaimers = stepData.disclaimers.disclaimers;
          if (Array.isArray(disclaimers) && disclaimers.length === 0) {
            // Check if user intended to add disclaimers but didn't
            // This validation is more lenient - we don't force users to add disclaimers
            // But we can add a warning if they seem to have started the process
          }
        }
        break;
      
      default:
        throw new Error(`Invalid step number: ${step}`);
    }
    
    return { isValid: true, errors: [], errorFields: [] };
  } catch (error: any) {
    const errorFields = getFieldFromError(error.message);
    return { 
      isValid: false, 
      errors: error.errors || [{ message: error.message, field: errorFields[0] || "unknown" }],
      errorFields: errorFields
    };
  }
};
