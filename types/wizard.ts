export enum OrganizationType {
  INDEPENDENT = 'independent',
  RIA = 'ria',
  HYBRID = 'hybrid',
  BROKER = 'broker',
  INSURANCE = 'insurance',
  RECORDKEEPER = 'recordkeeper',
  PLAN_SPONSOR = 'plan_sponsor',
  TRUST_SERVICES = 'trust_services',
  OTHER = 'other'
}

export enum TeamSize {
  JUST_ME = 'just_me',
  TWO_FIVE = '2_5',
  SIX_TWENTY = '6_20',
  ENTERPRISE = 'enterprise'
}

export enum ServiceType {
  RETIREMENT = 'retirement',
  GROUP_LIFE_DISABILITY = 'group_life_disability',
  GROUP_HEALTH = 'group_health',
  SUPPLEMENTAL_HEALTH = 'supplemental_health',
  OTHER = 'other'
}

export enum LicenseType {
  LIFE = 'life',
  HEALTH_ACCIDENT = 'health_accident',
  VARIABLE_LIFE_ANNUITY = 'variable_life_annuity',
  PROPERTY_CASUALTY = 'property_casualty',
  SURPLUS_LINES = 'surplus_lines',
  ADJUSTER = 'adjuster',
  OTHER = 'other'
}

export enum BenefitType {
  RETIREMENT_401K = '401k',
  GROUP_HEALTH = 'group_health',
  GROUP_LIFE = 'group_life',
  VOLUNTARY = 'voluntary',
  OTHER = 'other'
}

export interface WizardClientProfile {
  id?: string;
  sessionId: string;
  organizationType: OrganizationType;
  customOrganization?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardTeamSize {
  id?: string;
  sessionId: string;
  teamSize: TeamSize;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardServices {
  id?: string;
  sessionId: string;
  services: ServiceType[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardInsuranceLicensing {
  id?: string;
  sessionId: string;
  offersInsurance: boolean;
  licenseTypes: LicenseType[];
  statesLicensed: string[];
  licenseNumbers: { [state: string]: string };
  attestation: boolean;
  licenses?: License[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface License {
  id: string;
  state: string;
  type: LicenseType;
  customType?: string;
  number: string;
}

export interface TeamMember {
  name: string;
  email: string;
  role: string;
  inviteSent?: boolean;
}

export interface WizardTeamMembers {
  id?: string;
  sessionId: string;
  members: TeamMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardBranding {
  id?: string;
  sessionId: string;
  logo?: string;
  brandColor: string;
  aiAvatar?: string;
  subdomain: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardBenefitTypes {
  id?: string;
  sessionId: string;
  benefitTypes: BenefitType[];
  customBenefitType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WizardEmployerScope {
  id?: string;
  sessionId: string;
  servesMultipleEmployers: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}


export type WizardStepData =
  | WizardClientProfile
  | WizardTeamSize
  | WizardServices
  | WizardInsuranceLicensing
  | WizardTeamMembers
  | WizardBranding
  | WizardBenefitTypes
  | WizardEmployerScope;

export const WIZARD_STEP_TYPES = {
  CLIENT_PROFILE: 'clientProfile',
  TEAM_SIZE: 'teamSize',
  SERVICES: 'services',
  INSURANCE_LICENSING: 'insuranceLicensing',
  TEAM_MEMBERS: 'teamMembers',
  BRANDING: 'branding',
  BENEFIT_TYPES: 'benefitTypes',
  EMPLOYER_SCOPE: 'employerScope',
} as const;

export type WizardStepType = typeof WIZARD_STEP_TYPES[keyof typeof WIZARD_STEP_TYPES];

export interface ClientProfileFormData {
  organizationType: OrganizationType;
  customOrganization?: string;
}

export interface TeamSizeFormData {
  teamSize: TeamSize;
}

export interface ServicesFormData {
  services: ServiceType[];
  customService?: string;
}

export interface InsuranceLicensingFormData {
  offersInsurance: boolean;
  licenseTypes: LicenseType[];
  statesLicensed: string[];
  licenseNumbers: { [state: string]: string };
  attestation: boolean;
  licenses?: License[];
}

export interface TeamMembersFormData {
  members: TeamMember[];
}

export interface BrandingFormData {
   logo?: string;
   logoFileName?: string;
   backgroundImage?: string;
   backgroundFileName?: string;
   organizationName?: string;
   website?: string;
   missionStatement?: string;
   brandColor: string;
   primaryColor?: string;
   secondaryColor?: string;
   aiAvatar?: string;
   avatarFileName?: string;
   subdomain: string;
 }


export interface UserSetupFormData {
  name: string;
  email: string;
  phone: string;
  phoneExtension?: string;
  title: string;
  designations: string[];
  headshot: string;
  headshotFileName?: string;
  headshotData?: any;
  backgroundImage?: string;
  backgroundFileName?: string;
  saveAsContact?: boolean;
}

export interface Disclaimer {
  id: string;
  locations: string[];
  customLocation?: string;
  text: string;
  scope?: "plan" | "universal";
  apply_all_benefits_categories?: boolean;
}

export interface DisclaimersFormData {
  disclaimers: Disclaimer[];
}

export interface EmployerScopeFormData {
  servesMultipleEmployers: boolean;
}

