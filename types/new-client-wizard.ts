// New Client Wizard Types

// Step 1: Company Basics & Branding
// Crop metadata in percentages (0-100) relative to original image
export interface CropMetadata {
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  cropped: boolean;
  originalImage?: string;
}

export interface CompanyLogoData {
  url: string;
  // True original image source used for "Reset" in editor modals.
  // Prefer storing as a URL; can temporarily be base64 during editing sessions.
  originalUrl?: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  hasTransparency: boolean;
  backgroundColor?: string;
  warnings: string[];
  cropData?: CropMetadata;
  normalizedData?: {
    horizontal: string;
    square: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    layout: 'horizontal' | 'square';
  };
}

export interface BrandImageData {
  url: string;
  originalUrl?: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  recommendedSize: string;
  status: 'ok' | 'warning' | 'error';
  warnings: string[];
  cropData?: CropMetadata;
}

export interface BrandImagesData {
  header: BrandImageData | null;
  thumbnail: BrandImageData | null;
  secondaryBanner: BrandImageData | null;
  favicon: BrandImageData | null;
}

export interface CompanyBasicsData {
  companyName: string;
  companyWebsite: string;
  companyLogo: CompanyLogoData | null;
  primaryColor: string;
  secondaryColor: string;
  brandImages: BrandImagesData;
  appointmentLink?: string;
  planType?: string;
  organizationType?: "Advisor Firm" | "Client" | "Recordkeeper" | "Partner/Custom";
  isPrimaryColorPickerOpen?: boolean;
  isSecondaryColorPickerOpen?: boolean;
  heroTitle?: string;
  heroDescription?: string;
  missionHeadline?: string;
  missionBody?: string;
  heroOverlayOpacity?: number;
  heroBackgroundOpacity?: number;
  heroContainerOpacity?: number; // DEPRECATED: use heroContainerBackgroundOpacity and heroContainerBlockOpacity
  heroContainerBackgroundOpacity?: number;
  heroContainerBlockOpacity?: number;
  heroCompanyNameColor?: "yellow" | "default";
  heroContainerInverted?: boolean;
  heroBackgroundInverted?: boolean;
}

// Step 2: Welcome Statement
export interface WelcomeStatementData {
  headline: string;
  bodyText: string;
  isAIGenerated: boolean;
  advisorName?: string;
  advisorAvatar?: string | null;
}

// Step 3: Key Contacts
export type BenefitsCategory =
  | "Retirement"
  | "Group Health"
  | "Group Life"
  | "Other Benefits"
  | "Company / Plan Sponsor"
  | "Recordkeeper / Vendor";

export type ContactRole =
  | "HR Generalist"
  | "Advisor / Specialist"
  | "Recordkeeper"
  | "Insurance Carrier"
  | "Vendor / Provider"
  | "Support Team"
  | "Other";

export type ContactType = "individual" | "team_support";

export interface KeyContact {
  id: string;

  // Required fields
  contactType: ContactType;
  benefitsCategories: BenefitsCategory[];
  role?: ContactRole;
  roleOther?: string;
  email: string;
  phone: string;

  // Individual contact fields
  firstName?: string;
  lastName?: string;
  title?: string;
  headshotAssetId?: string;

  // Team/Support contact fields
  displayName?: string;
  departmentLabel?: string;
  supportHours?: string;
  teamImage?: string;
  teamImageFileName?: string;
  teamImageAssetId?: string;

  // Common fields
  companyName?: string;
  companyLogoAssetId?: string;
  websiteUrl?: string;
  schedulingUrl?: string;

  // Primary contact flags
  isPrimaryByCategory?: Record<BenefitsCategory, boolean>;
  isPrimaryOverall?: boolean;

  cardPrimaryColor?: string;
  cardSecondaryColor?: string;
  cardBackgroundColor?: string;
  logoScale?: number;

  // Legacy fields for backward compatibility
  benefitsCategory?: BenefitsCategory;
  benefitsCategoryOther?: string;
  isPrimaryForCategory?: boolean;
  companyLogo?: string;
  name?: string;
  headshot?: string;
  headshotFileName?: string;
  phoneExtension?: string;
  website?: string;
  showOnPortal?: boolean;
  enableContactButton?: boolean;
  isPrimary?: boolean;
  bio?: string;
  displayEmail?: boolean;
  displayPhone?: boolean;
  displayUrl?: boolean;
  displayScheduleAppointment?: boolean;
  // New format: separate orders for contact info and action buttons
  contactInfoOrder?: ("phone" | "email")[];
  actionButtonOrder?: ("phone" | "email" | "schedule" | "website")[] | ("schedule" | "website")[];
  contactUrl?: string;
  contactButtonType?: "email" | "phone" | "calendar" | "url"; // Legacy
  displayScope?: "futureUse" | "thisPortal";
  organization?: string;
  recordkeeper?: string;
  description?: string;
  orgType?: string;
  customRole?: string;
}

export interface KeyContactsData {
  contacts: KeyContact[];
  contactCardLayoutStyle?: number;
  contactDisplayOrder?: string[];
  displayStyle?: number | null;
  cardPrimaryColor?: string;
  cardSecondaryColor?: string;
  cardBackgroundColor?: string;
  logoScale?: number;
}

export interface ContactBuilderData {
  id?: string;
  fullName: string;
  title: string;
  companyName: string;
  orgType: "Advisor Firm" | "Client" | "Recordkeeper" | "Partner/Custom" | "";
  customRole: "advisor" | "hr" | "recordkeeper" | "other" | "";
  recordkeeper?: string;
  description: string;
  headshot?: string;
  showOnPortal: boolean;
  enableContactButton: boolean;
  email?: string;
  phone?: string;
  phoneExtension?: string;
  meetingLink?: string;
}

// Step 4: Compliance Documents
export interface Document {
  id: string;
  name: string;
  /** Legacy: base64 data URL. When storageKey is set, use "r2:stored" so UI treats doc as having a file. */
  file: string;
  type: "spd" | "other";
  size: number;
  status: "uploading" | "success" | "error";
  shortDescription?: string;
  originalFileName?: string;
  language?: "EN" | "ES";
  expirationDate?: string;
  category?: BenefitsCategory;
  categorySuggested?: BenefitsCategory;
  categoryConfidence?: number;
  /** R2 object key when file was uploaded via direct-to-R2 (presign → PUT → save key). */
  storageKey?: string;
}

export interface ComplianceDocumentsData {
  spdFile: Document | null;
  retirementPlanDocuments: Document[];
  otherDocuments: Document[];
  recordkeeper?: string;
  retirementPlatform?: string;
}

// Step 5: Employee Portal Preview
export interface Benefit {
  id: string;
  title: string;
  description: string;
  partnerLogo?: string;
  image?: string;
  buttonText?: string;
  href?: string;
  category?: BenefitsCategory;
  contactId?: string;
  isEnabled?: boolean;
}

export interface EmployeePortalPreviewData {
  previewData: any;
  step5SubStep?: "disclaimers" | "preview" | "benefits-team" | "step5d";
  benefits?: Benefit[];
}

// Legacy types for backward compatibility
export interface CompanyData {
  companyName: string;
  companyWebsite: string;
  companyLogo: string;
  logoFileName: string;
  brandColor: string;
  secondaryColor: string;
  missionHeadline: string;
  missionBody: string;
  isColorPickerOpen?: boolean;
  isSecondaryColorPickerOpen?: boolean;
  appointmentLink: string;
  backgroundImg: string;
  backgroundImgName: string;
  disclaimers?: string;
}

export interface ClientInfoFormData {
  companyData: CompanyData;
  keyContacts: KeyContact[];
}

export interface SbcFile {
  file: string;
  fileName: string;
  title: string;
  fileObj?: File;
}

export interface DocumentData {
  spdFile: any;
  otherDocuments: any[];
}

export interface OptionalDocumentsFormData {
  optionalFiles: Array<{
    fileName: string;
    fileData: string;
    fileType: string;
    description: string;
    language?: "EN" | "ES";
    expirationDate?: string;
  }>;
  provideSpanishVersions: boolean;
}

export interface NewClientWizardStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface Disclaimer {
  id: string;
  text: string;
  locations: string[];
  customLocation?: string;
  scope?: "plan" | "universal";
  apply_all_benefits_categories?: boolean;
}

export interface DisclaimersData {
  disclaimers: Disclaimer[];
  disclosuresText?: string;
  useDefaultDisclosures?: boolean;
}

export interface NewClientWizardState {
  currentStep: number;
  totalSteps: number;
  steps: NewClientWizardStep[];
  isCompleted: boolean;
  stepData: {
    companyBasics?: CompanyBasicsData;
    welcomeStatement?: WelcomeStatementData;
    keyContacts?: KeyContactsData;
    complianceDocuments?: ComplianceDocumentsData;
    employeePortalPreview?: EmployeePortalPreviewData;
    disclaimers?: DisclaimersData;
    contactBuilder?: ContactBuilderData;
    clientInfo?: ClientInfoFormData;
    documentData?: DocumentData;
    optionalDocuments?: OptionalDocumentsFormData;
  };
  nextStep: () => Promise<{ isValid: boolean; errors: any[] }>;
  previousStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (stepId: number) => void;
  completeWizard: () => Promise<void>;
  saveStepData: (stepType: string, data: any, saveToServer?: boolean) => Promise<void>;
  saveStepDataLocally: (stepType: string, data: any) => Promise<void>;
  saveStepDataToServer: (stepType: string, data: any) => Promise<boolean>;
  loadAllWizardData: () => Promise<any>;
  loadOnboardingData: () => Promise<string | null>;
  updateCurrentStep: (step: number) => Promise<void>;
  createNewSession: () => Promise<void>;
  resetWizard: () => void;
}
