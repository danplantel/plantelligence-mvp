export interface UserSetupData {
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
  primaryServiceCategories?: string[];
  saveAsContact?: boolean;
}

import { OrganizationType } from "@/types/wizard";

// Title options based on Organization Type
export const getTitleOptionsByOrgType = (orgType: OrganizationType | null) => {
  if (!orgType) return [];

  const titleOptionsMap = {
    [OrganizationType.INDEPENDENT]: [
      { value: "Financial Advisor", label: "Financial Advisor" },
      { value: "Retirement Plan Advisor", label: "Retirement Plan Advisor" },
      { value: "Wealth Manager", label: "Wealth Manager" },
      { value: "Financial Planner", label: "Financial Planner" },
      { value: "Investment Consultant", label: "Investment Consultant" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.RIA]: [
      { value: "Financial Advisor", label: "Financial Advisor" },
      { value: "Retirement Plan Advisor", label: "Retirement Plan Advisor" },
      { value: "Wealth Manager", label: "Wealth Manager" },
      { value: "Investment Consultant", label: "Investment Consultant" },
      { value: "Partner / Principal", label: "Partner / Principal" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.HYBRID]: [
      { value: "Financial Advisor", label: "Financial Advisor" },
      { value: "Retirement Plan Advisor", label: "Retirement Plan Advisor" },
      { value: "Insurance Advisor", label: "Insurance Advisor" },
      { value: "Wealth Manager", label: "Wealth Manager" },
      { value: "Financial Planner", label: "Financial Planner" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.BROKER]: [
      { value: "Advisor / Manager", label: "Advisor / Manager" },
      { value: "Relationship Manager", label: "Relationship Manager" },
      { value: "Financial Advisor", label: "Financial Advisor" },
      { value: "Retirement Plan Consultant", label: "Retirement Plan Consultant" },
      { value: "Compliance Manager", label: "Compliance Manager" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.INSURANCE]: [
      { value: "Insurance Agent", label: "Insurance Agent" },
      { value: "Insurance Advisor", label: "Insurance Advisor" },
      { value: "Annuity Specialist", label: "Annuity Specialist" },
      { value: "Retirement Plan Advisor", label: "Retirement Plan Advisor" },
      { value: "Benefits Consultant", label: "Benefits Consultant" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.RECORDKEEPER]: [
      { value: "Plan Administrator", label: "Plan Administrator" },
      { value: "Compliance Manager", label: "Compliance Manager" },
      { value: "Operations Manager", label: "Operations Manager" },
      { value: "Client Service Manager", label: "Client Service Manager" },
      { value: "Retirement Plan Consultant", label: "Retirement Plan Consultant" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.PLAN_SPONSOR]: [
      { value: "HR Manager", label: "HR Manager" },
      { value: "HR Director", label: "HR Director" },
      { value: "Benefits Manager", label: "Benefits Manager" },
      { value: "Benefits Director", label: "Benefits Director" },
      { value: "CFO / Finance Manager", label: "CFO / Finance Manager" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.TRUST_SERVICES]: [
      { value: "Trust Officer", label: "Trust Officer" },
      { value: "Trust Administrator", label: "Trust Administrator" },
      { value: "Trust Manager", label: "Trust Manager" },
      { value: "Wealth Manager", label: "Wealth Manager" },
      { value: "Estate Planning Advisor", label: "Estate Planning Advisor" },
      { value: "Fiduciary Specialist", label: "Fiduciary Specialist" },
      { value: "Other", label: "Other (please specify)" },
    ],
    [OrganizationType.OTHER]: [
      { value: "Custom", label: "Custom (Free Text Field)" },
    ],
  };

  return titleOptionsMap[orgType as keyof typeof titleOptionsMap] || [];
};

// Legacy titleOptions for backward compatibility
export const titleOptions = [
  {
    category: "Advisor / Financial Services",
    options: [
      { value: "Financial Advisor", label: "Financial Advisor" },
      { value: "Retirement Plan Advisor", label: "Retirement Plan Advisor" },
      { value: "Wealth Manager", label: "Wealth Manager" },
      { value: "Financial Planner", label: "Financial Planner" },
      { value: "Investment Consultant", label: "Investment Consultant" },
      { value: "Insurance Agent", label: "Insurance Agent" },
      { value: "Insurance Advisor", label: "Insurance Advisor" },
    ]
  },
  {
    category: "HR / Employer (Plan Sponsor)",
    options: [
      { value: "HR Manager", label: "HR Manager" },
      { value: "HR Director", label: "HR Director" },
      { value: "Benefits Manager", label: "Benefits Manager" },
      { value: "Benefits Director", label: "Benefits Director" },
      { value: "Compensation & Benefits Specialist", label: "Compensation & Benefits Specialist" },
      { value: "Chief Human Resources Officer (CHRO)", label: "Chief Human Resources Officer (CHRO)" },
      { value: "CFO / Finance Manager", label: "CFO / Finance Manager" },
    ]
  },
  {
    category: "Recordkeeper / Partner",
    options: [
      { value: "Relationship Manager", label: "Relationship Manager" },
      { value: "Client Success Manager", label: "Client Success Manager" },
      { value: "Plan Consultant", label: "Plan Consultant" },
      { value: "Compliance Specialist", label: "Compliance Specialist" },
    ]
  },
  {
    category: "Other",
    options: [
      { value: "Other", label: "Other (free text entry)" },
    ]
  }
];

export const designationGroups = {
  financial: [
    "CFP® – Certified Financial Planner",
    "AIF® – Accredited Investment Fiduciary",
    "CPFA® – Certified Plan Fiduciary Advisor",
    "CRPS® – Chartered Retirement Plans Specialist",
    "CRPC® – Chartered Retirement Planning Counselor",
    "CIMA® – Certified Investment Management Analyst",
    "CFA® – Chartered Financial Analyst",
    "CLU® – Chartered Life Underwriter",
    "ChFC® – Chartered Financial Consultant",
    "RICP® – Retirement Income Certified Professional",
    "LUTCF® – Life Underwriter Training Council Fellow",
    "CPA/PFS – Certified Public Accountant / Personal Financial Specialist",
  ],
  hr: [
    "SHRM-CP – Society for Human Resource Management Certified Professional",
    "SHRM-SCP – Senior Certified Professional",
    "PHR – Professional in Human Resources",
    "SPHR – Senior Professional in Human Resources",
    "GPHR – Global Professional in Human Resources",
    "CEBS – Certified Employee Benefit Specialist",
    "CBP – Certified Benefits Professional",
    "CCP – Certified Compensation Professional",
    "CHRS – Certified Health & Retirement Specialist",
  ]
};

// Event handlers
export const onTitleChange = (
  value: string,
  onDataChange: (field: keyof UserSetupData, value: any) => void
) => {
  onDataChange("title", value);
  onDataChange("designations", []);
};

export const onDesignationToggle = (
  designation: string,
  designations: string[],
  onDataChange: (field: keyof UserSetupData, value: any) => void
) => {
  const currentDesignations = designations || [];
  const isSelected = currentDesignations.includes(designation);

  if (isSelected) {
    onDataChange(
      "designations",
      currentDesignations.filter((d: string) => d !== designation),
    );
  } else {
    onDataChange("designations", [...currentDesignations, designation]);
  }
};

export const onRemoveDesignation = (
  designation: string,
  designations: string[],
  onDataChange: (field: keyof UserSetupData, value: any) => void
) => {
  const currentDesignations = designations || [];
  onDataChange(
    "designations",
    currentDesignations.filter((d: string) => d !== designation),
  );
};

export const onAddOtherDesignation = (
  value: string,
  designations: string[],
  onDataChange: (field: keyof UserSetupData, value: any) => void,
  clearInput: () => void
) => {
  if (value && !designations?.includes(value)) {
    onDataChange("designations", [...(designations || []), value]);
    clearInput();
  }
};

export const onHeadshotChange = (
  file: File | null,
  onDataChange: (field: keyof UserSetupData, value: any) => void
) => {
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      onDataChange("headshot", e.target?.result as string);
      onDataChange("headshotFileName", file.name);
    };
    reader.readAsDataURL(file);
  } else {
    onDataChange("headshot", "");
    onDataChange("headshotFileName", "");
  }
};

// Phone formatting functions
export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const phoneNumber = value.replace(/\D/g, '');

  // Don't format if empty or too short
  if (phoneNumber.length === 0) return '';
  if (phoneNumber.length < 3) return phoneNumber;

  // Format based on length
  if (phoneNumber.length <= 3) {
    return `(${phoneNumber}`;
  } else if (phoneNumber.length <= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  } else if (phoneNumber.length <= 10) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  } else {
    // Handle 11 digits (with country code)
    return `+${phoneNumber.slice(0, 1)} (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`;
  }
};

export const normalizePhoneNumber = (value: string): string => {
  // Remove all non-digit characters and return clean number
  return value.replace(/\D/g, '');
};

export const onPhoneChange = (
  value: string,
  onDataChange: (field: keyof UserSetupData, value: any) => void
) => {
  const formatted = formatPhoneNumber(value);
  const normalized = normalizePhoneNumber(value);

  // Update the display value (formatted) and the actual value (normalized)
  onDataChange("phone", normalized);

  return formatted;
};

// Utility functions
export const getRelevantDesignations = (title: string) => {
  if (!title) return [];

  const titleLower = title.toLowerCase();

  if (
    titleLower.includes("advisor") ||
    titleLower.includes("planner") ||
    titleLower.includes("manager") ||
    titleLower.includes("consultant")
  ) {
    return designationGroups.financial;
  } else if (
    titleLower.includes("hr") ||
    titleLower.includes("benefits") ||
    titleLower.includes("chro")
  ) {
    return designationGroups.hr;
  } else if (
    titleLower.includes("relationship") ||
    titleLower.includes("success") ||
    titleLower.includes("plan") ||
    titleLower.includes("compliance")
  ) {
    return []; // No designations required
  } else {
    return [...designationGroups.financial, ...designationGroups.hr]; // Show all
  }
};
