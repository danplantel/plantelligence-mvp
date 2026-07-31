import { CompanyBasicsData, KeyContact, DocumentData, OptionalDocumentsFormData, CompanyLogoData, BrandImagesData } from "@/types/new-client-wizard";
import { isValidDomain, normalizeCleanDomain } from "./url-utils";

// Validation functions for each step
export const validateCompanyBasics = (data: CompanyBasicsData) => {
  const errors: { field: string; message: string }[] = [];

  // Required company data fields
  if (!data.companyName || data.companyName.trim() === "") {
    errors.push({ field: "companyName", message: "Company name is required" });
  }

  if (data.companyWebsite && data.companyWebsite.trim() !== "") {
    // Validate website format - accept various formats but normalize to clean domain
    const trimmedUrl = data.companyWebsite.trim();
    if (!isValidDomain(trimmedUrl)) {
      errors.push({ field: "companyWebsite", message: "Please enter a valid domain name (e.g., example.com, www.example.com, https://example.com)" });
    }
  }

  // Portal URL is required
  if (!data.portalUrl || data.portalUrl.trim() === "") {
    errors.push({ field: "portalUrl", message: "Portal URL is required" });
  }

  if (!data.companyLogo) {
    errors.push({ field: "companyLogo", message: "Company logo is required" });
  } else {
    // Validate logo file
    if (!data.companyLogo.url || data.companyLogo.url.trim() === "") {
      errors.push({ field: "companyLogo", message: "Company logo file is required" });
    }
    
    // Validate file type
    const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    const fileExtension = data.companyLogo.fileName.split('.').pop()?.toLowerCase();
    const mimeType = fileExtension === 'svg' ? 'image/svg+xml' : 
                     fileExtension === 'png' ? 'image/png' : 
                     fileExtension === 'jpg' || fileExtension === 'jpeg' ? 'image/jpeg' : '';
    
    if (!allowedTypes.includes(mimeType)) {
      errors.push({ field: "companyLogo", message: "Unsupported format. Please upload SVG, PNG, or JPEG." });
    }
  }

  if (!data.primaryColor || data.primaryColor.trim() === "") {
    errors.push({ field: "primaryColor", message: "Primary color is required" });
  } else {
    // Validate primary color format (hex)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(data.primaryColor)) {
      errors.push({ field: "primaryColor", message: "Primary color must be a valid hex color (e.g., #1F3A60)" });
    }
  }

  if (!data.secondaryColor || data.secondaryColor.trim() === "") {
    errors.push({ field: "secondaryColor", message: "Secondary color is required" });
  } else {
    // Validate secondary color format (hex)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(data.secondaryColor)) {
      errors.push({ field: "secondaryColor", message: "Secondary color must be a valid hex color (e.g., #6B7280)" });
    }
  }

  // Validate brand images (optional but if provided, validate them)
  if (data.brandImages) {
    // Header or thumbnail required (hero uses thumbnail as fallback when header empty)
    const hasHeader = !!data.brandImages.header;
    const hasThumbnail = !!data.brandImages.thumbnail;
    if (!hasHeader && !hasThumbnail) {
      errors.push({ field: "brandImages.header", message: "Background Header Image (Hero) or Square Thumbnail is required" });
    }
    if (hasHeader && data.brandImages.header?.fileSize && data.brandImages.header.fileSize > 15 * 1024 * 1024) {
      errors.push({ field: "brandImages.header", message: "Header image is too large. Please upload a file under 15 MB." });
    }
    
    // Validate other brand images if provided
    const otherImages = [
      { key: 'thumbnail', name: 'Square Thumbnail' },
      { key: 'secondaryBanner', name: 'Secondary Banner Image' },
      { key: 'favicon', name: 'Favicon/Icon' }
    ];
    
    otherImages.forEach(({ key, name }) => {
      const image = data.brandImages[key as keyof BrandImagesData];
      if (image && image.fileSize > 15 * 1024 * 1024) {
        errors.push({ field: `brandImages.${key}`, message: `${name} is too large. Please upload a file under 15 MB.` });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorFields: errors.map(error => error.field)
  };
};

export const validateWelcomeStatement = (data: any) => {
  const errors: { field: string; message: string }[] = [];

  if (!data.headline || data.headline.trim() === "") {
    errors.push({ field: "headline", message: "Welcome headline is required" });
  }

  if (!data.bodyText || data.bodyText.trim() === "") {
    errors.push({ field: "bodyText", message: "Welcome message body is required" });
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorFields: errors.map(error => error.field)
  };
};

export const validateKeyContacts = (data: any) => {
  const errors: { field: string; message: string }[] = [];

  if (!data.contacts || data.contacts.length === 0) {
    errors.push({ field: "contacts", message: "At least one key contact is required" });
  } else {
    data.contacts.forEach((contact: any, index: number) => {
      if (!contact.name || contact.name.trim() === "") {
        errors.push({ field: `contacts.${index}.name`, message: `Key contact ${index + 1}: Name is required` });
      }
      if (!contact.email || contact.email.trim() === "") {
        errors.push({ field: `contacts.${index}.email`, message: `Key contact ${index + 1}: Email is required` });
      }
      if (!contact.phone || contact.phone.trim() === "") {
        errors.push({ field: `contacts.${index}.phone`, message: `Key contact ${index + 1}: Phone is required` });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorFields: errors.map(error => error.field)
  };
};

export const validateComplianceDocuments = (data: any) => {
  return {
    isValid: true,
    errors: [],
    errorFields: [],
  };
};

export const validateEmployeePortalPreview = (data: any) => {
  const errors: { field: string; message: string }[] = [];

  // This step is typically just a preview, so minimal validation
  return {
    isValid: errors.length === 0,
    errors,
    errorFields: errors.map(error => error.field)
  };
};

// Main validation function for current step
export const validateNewClientCurrentStep = async (step: number, stepData: any) => {
  try {
    switch (step) {
      case 1:
        if (!stepData.companyBasics) {
          return {
            isValid: false,
            errors: [{ field: "companyBasics", message: "Please complete the Company Basics & Branding section" }],
            errorFields: ["companyBasics"]
          };
        }
        return validateCompanyBasics(stepData.companyBasics);
      
      case 2:
        if (!stepData.welcomeStatement) {
          return {
            isValid: false,
            errors: [{ field: "welcomeStatement", message: "Please complete the Welcome Statement section" }],
            errorFields: ["welcomeStatement"]
          };
        }
        return validateWelcomeStatement(stepData.welcomeStatement);
      
      case 3:
        if (!stepData.keyContacts) {
          return {
            isValid: false,
            errors: [{ field: "keyContacts", message: "Please complete the Key Contacts section" }],
            errorFields: ["keyContacts"]
          };
        }
        return validateKeyContacts(stepData.keyContacts);
      
      case 4:
        if (!stepData.complianceDocuments) {
          return {
            isValid: false,
            errors: [{ field: "complianceDocuments", message: "Please complete the Compliance Documents section" }],
            errorFields: ["complianceDocuments"]
          };
        }
        return validateComplianceDocuments(stepData.complianceDocuments);
      
      case 5:
        if (!stepData.employeePortalPreview) {
          return {
            isValid: false,
            errors: [{ field: "employeePortalPreview", message: "Please complete the Employee Portal Preview section" }],
            errorFields: ["employeePortalPreview"]
          };
        }
        return validateEmployeePortalPreview(stepData.employeePortalPreview);
      
      default:
        return {
          isValid: false,
          errors: [{ field: "step", message: `Invalid step number: ${step}` }],
          errorFields: ["step"]
        };
    }
  } catch (error: any) {
    console.error(`Validation failed for step ${step}:`, error);
    return { 
      isValid: false, 
      errors: [{ field: "error", message: error.message }],
      errorFields: ["error"]
    };
  }
};