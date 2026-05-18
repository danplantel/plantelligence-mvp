import html2canvas from 'html2canvas';

export interface EligibilityData {
  ageRequirement: string;
  customAgeRequirement?: string;
  serviceRequirement: string;
  customServiceRequirement?: string;
  entryDate: string;
  customEntryDate?: string;
}

export interface EmployeeDeferralsData {
  autoEnrollment: boolean | null;
  autoEscalation: string;
  customEnrollmentMethod: string;
  deferralCap: string;
  enrollmentRate: string;
  enrollmentMethods: string[];
  customEnrollmentRate?: string;
  customAutoEscalation?: string;
  customDeferralCap?: string;
}

export interface EmployerContributionsData {
  hasContributions: boolean | null;
  hasAdditionalContributions: boolean | null;
  contributionTypes: string[];
  primaryContributionType: string | null;
  companyMatch: {
    isPrimary: boolean;
    formula: string;
    customFormula?: string;
    limit: string;
    customLimit?: string;
    vesting: string;
    customVesting?: string;
  };
  safeHarbor: {
    isPrimary: boolean;
    type: string;
    customType?: string;
    formula: string;
    customFormula?: string;
    limit: string;
    customLimit?: string;
    vesting: string;
    customVesting?: string;
  };
  fixedAmount: {
    isPrimary: boolean;
    amount: string;
    customAmount?: string;
    percentageAmount?: string;
    details: string;
    customDetails?: string;
    vesting: string;
    customVesting?: string;
  };
  profitSharing: {
    isPrimary: boolean;
    details: string;
    customDetails?: string;
    conditions: string;
    customConditions?: string;
    vesting: string;
    customVesting?: string;
  };
}

export interface InvestmentsData {
  investmentOptions: string[];
  planFeatures: string[];
  customFeature?: string;
}

export interface ResourcesData {
  contactInformation: {
    planId: string;
    primaryType: string;
    primaryTypeCustom?: string;
    primaryName: string;
    primaryEmail: string;
    primaryPhone: string;
    secondaryType: string;
    secondaryTypeCustom?: string;
    secondaryName: string;
    secondaryEmail: string;
    secondaryPhone: string;
    tertiaryType: string;
    tertiaryTypeCustom?: string;
    tertiaryName: string;
    tertiaryEmail: string;
    tertiaryPhone: string;
  };
  qrUrl: string;
}

export async function generateEligibilityImage(
  eligibilityData: EligibilityData,
  brandColor: string = '#005F73'
): Promise<string> {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.background = 'transparent';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-end';
  container.style.fontFamily = 'Arial, sans-serif';
  
  // Create the content HTML
  const contentHTML = `
    <div style="text-align: right; padding-right: 32px;">
      <div style="margin-bottom: 16px;">
        <p style="font-size: 48px; font-weight: bold; color: black; margin: 0; line-height: 1.2;">
          Age requirement
        </p>
        <div style="font-size: 32px; color: black; margin: 0; line-height: 1.2;">
          ${eligibilityData.customAgeRequirement || eligibilityData.ageRequirement || "-"}
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <p style="font-size: 48px; font-weight: bold; color: black; margin: 0; line-height: 1.2;">
          Service requirement
        </p>
        <div style="font-size: 32px; color: black; margin: 0; line-height: 1.2;">
          ${eligibilityData.customServiceRequirement || eligibilityData.serviceRequirement || "-"}
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <p style="font-size: 48px; font-weight: bold; color: black; margin: 0; line-height: 1.2;">
          Entry period
        </p>
        <div style="font-size: 32px; color: black; margin: 0; line-height: 1.2;">
          ${eligibilityData.customEntryDate || eligibilityData.entryDate || "-"}
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = contentHTML;
  document.body.appendChild(container);
  
  try {
    // Generate the image using html2canvas
    const canvas = await html2canvas(container, {
      backgroundColor: null, // Transparent background
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      width: 800,
      height: 600,
    });
    
    // Convert to PNG with transparency
    const dataURL = canvas.toDataURL('image/png');
    
    return dataURL;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

export async function generateEmployeeDeferralsImage(
  deferralsData: EmployeeDeferralsData,
  brandColor: string = '#005F73'
): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.background = 'transparent';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-end';
  container.style.fontFamily = 'Arial, sans-serif';

  // Helper function to get enrollment rate label
  const getEnrollmentRateLabel = (rate: string) => {
    const rates = [
      { value: "1", label: "1%" },
      { value: "2", label: "2%" },
      { value: "3", label: "3%" },
      { value: "4", label: "4%" },
      { value: "5", label: "5%" },
      { value: "6", label: "6%" },
      { value: "7", label: "7%" },
      { value: "8", label: "8%" },
      { value: "9", label: "9%" },
      { value: "10", label: "10%" }
    ];
    return rates.find(r => r.value === rate)?.label || rate;
  };

  // Helper function to get auto escalation label
  const getAutoEscalationLabel = (escalation: string) => {
    const escalations = [
      { value: "1", label: "1% annually" },
      { value: "2", label: "2% annually" },
      { value: "3", label: "3% annually" },
      { value: "4", label: "4% annually" },
      { value: "5", label: "5% annually" }
    ];
    return escalations.find(e => e.value === escalation)?.label || escalation;
  };

  // Helper function to get deferral cap label
  const getDeferralCapLabel = (cap: string) => {
    const caps = [
      { value: "10", label: "10%" },
      { value: "15", label: "15%" },
      { value: "20", label: "20%" },
      { value: "25", label: "25%" },
      { value: "30", label: "30%" }
    ];
    return caps.find(c => c.value === cap)?.label || cap;
  };

  // Helper function to get enrollment method label
  const getEnrollmentMethodLabel = (method: string) => {
    const methods = [
      { value: "online", label: "Online" },
      { value: "phone", label: "Phone" },
      { value: "paper", label: "Paper" },
      { value: "mobile", label: "Mobile App" },
      { value: "custom", label: "Custom" }
    ];
    return methods.find(m => m.value === method)?.label || method;
  };

  let contentHTML = `
    <div style="text-align: right; padding-right: 48px;">
      <p style="font-size: 48px; font-weight: bold; color: black; margin: 0; line-height: 1.2; margin-bottom: 16px;">
        ${deferralsData.autoEnrollment ? "Auto Enrollment" : "Enrollment Option"}
      </p>
  `;

  if (deferralsData.autoEnrollment) {
    // Auto Enrollment is Yes - show enrollment rate, auto escalation, and deferral cap
    contentHTML += `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 20px; font-weight: bold; color: black;">
            Enrollment Rate:
          </span>
          <span style="font-size: 20px; color: black;">
            ${deferralsData.customEnrollmentRate || getEnrollmentRateLabel(deferralsData.enrollmentRate) || ""}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 20px; font-weight: bold; color: black;">
            Auto Escalation:
          </span>
          <span style="font-size: 20px; color: black;">
            ${deferralsData.customAutoEscalation || getAutoEscalationLabel(deferralsData.autoEscalation) || ""}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px; font-weight: bold; color: black;">
            Escalation Cap:
          </span>
          <span style="font-size: 20px; color: black;">
            ${deferralsData.customDeferralCap || getDeferralCapLabel(deferralsData.deferralCap) || ""}
          </span>
        </div>
      </div>
    `;
  } else {
    // Auto Enrollment is No - show enrollment methods
    contentHTML += `<div style="margin-bottom: 16px;">`;
    deferralsData.enrollmentMethods.forEach((method, index) => {
      if (method) {
        const methodLabel = method === 'custom' ? deferralsData.customEnrollmentMethod : getEnrollmentMethodLabel(method);
        if (methodLabel) {
          contentHTML += `
            <div style="font-size: 48px; color: black; margin-bottom: 8px;">
              ${methodLabel}
            </div>
          `;
        }
      }
    });
    contentHTML += `</div>`;
  }

  contentHTML += `</div>`;
  
  container.innerHTML = contentHTML;
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: 800,
      height: 600,
    });
    
    const dataURL = canvas.toDataURL('image/png');
    return dataURL;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateEmployerContributionsImage(
  contributionsData: EmployerContributionsData,
  brandColor: string = '#005F73'
): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.background = 'transparent';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-start';
  container.style.fontFamily = 'Arial, sans-serif';

  const contributionTypeNames: Record<string, string> = {
    companyMatch: "Company Match",
    safeHarbor: "Safe Harbor",
    fixedAmount: "Fixed Amount",
    profitSharing: "Profit Sharing",
  };

  let contentHTML = `<div style="text-align: left; padding-left: 32px;">`;

  if (contributionsData.hasContributions && contributionsData.contributionTypes && contributionsData.contributionTypes.length > 0) {
    contributionsData.contributionTypes.forEach((type) => {
      contentHTML += `
        <div style="margin-bottom: 16px;">
          <strong style="font-size: 48px; font-weight: bold; color: black; display: block; margin-bottom: 8px;">
            ${contributionTypeNames[type]}
          </strong>
      `;

      // Add details based on contribution type
      switch (type) {
        case "companyMatch":
          contentHTML += `
            <div style="font-size: 24px; color: black; margin-bottom: 8px;">
              ${contributionsData.companyMatch.customFormula || contributionsData.companyMatch.formula || ""}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Limit:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.companyMatch.customLimit || contributionsData.companyMatch.limit || ""}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Vesting:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.companyMatch.customVesting || contributionsData.companyMatch.vesting || ""}
              </span>
            </div>
          `;
          break;
        case "safeHarbor":
          contentHTML += `
            <div style="font-size: 24px; color: black; margin-bottom: 8px;">
              ${contributionsData.safeHarbor.customFormula || contributionsData.safeHarbor.formula || ""}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Limit:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.safeHarbor.customLimit || contributionsData.safeHarbor.limit || ""}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Vesting:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.safeHarbor.customVesting || contributionsData.safeHarbor.vesting || ""}
              </span>
            </div>
          `;
          break;
        case "fixedAmount":
          contentHTML += `
            <div style="font-size: 24px; color: black; margin-bottom: 8px;">
              ${contributionsData.fixedAmount.customAmount || contributionsData.fixedAmount.amount || ""}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Limit:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.fixedAmount.customDetails || contributionsData.fixedAmount.details || ""}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Vesting:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.fixedAmount.customVesting || contributionsData.fixedAmount.vesting || ""}
              </span>
            </div>
          `;
          break;
        case "profitSharing":
          contentHTML += `
            <div style="font-size: 24px; color: black; margin-bottom: 8px;">
              ${contributionsData.profitSharing.customDetails || contributionsData.profitSharing.details || ""}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Limit:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.profitSharing.customConditions || contributionsData.profitSharing.conditions || ""}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: bold; color: #374151;">Vesting:</span>
              <span style="font-size: 18px; color: #6B7280;">
                ${contributionsData.profitSharing.customVesting || contributionsData.profitSharing.vesting || ""}
              </span>
            </div>
          `;
          break;
      }
      
      contentHTML += `</div>`;
    });
  } else {
    contentHTML += `
      <div style="font-size: 48px; font-weight: bold; color: black;">
        Employer Contributions
      </div>
    `;
  }

  contentHTML += `</div>`;
  
  container.innerHTML = contentHTML;
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: 800,
      height: 600,
    });
    
    const dataURL = canvas.toDataURL('image/png');
    return dataURL;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateInvestmentsImage(
  investmentsData: InvestmentsData,
  brandColor: string = '#005F73'
): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.background = 'transparent';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-start';
  container.style.fontFamily = 'Arial, sans-serif';

  // Helper function to get feature label
  const getFeatureLabel = (feature: string) => {
    const features = [
      { value: "financialPlanning", label: "Financial Planning Services" },
      { value: "investmentAdvice", label: "Investment Advice" },
      { value: "retirementCalculator", label: "Retirement Calculator" },
      { value: "mobileApp", label: "Mobile App" },
      { value: "custom", label: "Custom" }
    ];
    return features.find(f => f.value === feature)?.label || feature;
  };

  let contentHTML = `
    <div style="text-align: left; padding-left: 32px;">
      <strong style="font-size: 48px; font-weight: bold; color: black; display: block; margin-bottom: 16px;">
        Plan Features
      </strong>
      
      <!-- Static features - always displayed -->
      <p style="font-size: 24px; color: black; margin-bottom: 8px;">
        - Simplified Enrollment
      </p>
      <p style="font-size: 24px; color: black; margin-bottom: 8px;">
        - Diversified Investment Options
      </p>
      <p style="font-size: 24px; color: black; margin-bottom: 8px;">
        - Benefits Website with Online Access
      </p>
      <p style="font-size: 24px; color: black; margin-bottom: 8px;">
        - Dedicated Support Team
      </p>
  `;

  // Selected features with dashes
  if (investmentsData.planFeatures && investmentsData.planFeatures.length > 0) {
    investmentsData.planFeatures
      .filter((item) => item !== "none")
      .forEach((currentItem) => {
        const displayValue = currentItem === "custom" 
          ? investmentsData.customFeature 
          : getFeatureLabel(currentItem);

        if (displayValue) {
          contentHTML += `
            <p style="font-size: 24px; color: black; margin-bottom: 8px;">
              - ${displayValue}
            </p>
          `;
        }
      });
  }

  contentHTML += `</div>`;
  
  container.innerHTML = contentHTML;
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: 800,
      height: 600,
    });
    
    const dataURL = canvas.toDataURL('image/png');
    return dataURL;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateResourcesImage(
  resourcesData: ResourcesData,
  brandColor: string = '#005F73'
): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.background = 'transparent';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'flex-start';
  container.style.fontFamily = 'Arial, sans-serif';

  let contentHTML = `
    <div style="text-align: left; padding-left: 16px;">
      <img src="/pt_web_light.png" style="object-contain; height: 80px; margin-bottom: 16px;" alt="PlanTelligence" />
      
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="font-size: 18px; font-weight: bold; color: #374151;">Plan ID:</span>
        <span style="font-size: 18px; color: #6B7280;">
          ${resourcesData.contactInformation.planId}
        </span>
      </div>
  `;

  // Primary Contact - only show if any field has content
  if (resourcesData.contactInformation.primaryTypeCustom ||
      resourcesData.contactInformation.primaryType ||
      resourcesData.contactInformation.primaryName ||
      resourcesData.contactInformation.primaryEmail ||
      resourcesData.contactInformation.primaryPhone) {
    contentHTML += `<div style="margin-bottom: 16px;">`;
    
    if (resourcesData.contactInformation.primaryTypeCustom || resourcesData.contactInformation.primaryType) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: bold; color: #6B7280; text-transform: uppercase;">Primary Contact Type:</span>
          <strong style="font-size: 14px;">
            ${resourcesData.contactInformation.primaryTypeCustom || resourcesData.contactInformation.primaryType}
          </strong>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.primaryName) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Name:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.primaryName}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.primaryEmail) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Email:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.primaryEmail}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.primaryPhone) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Phone:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.primaryPhone}
          </span>
        </div>
      `;
    }
    
    contentHTML += `</div>`;
  }

  // Secondary Contact - only show if any field has content
  if (resourcesData.contactInformation.secondaryTypeCustom ||
      resourcesData.contactInformation.secondaryType ||
      resourcesData.contactInformation.secondaryName ||
      resourcesData.contactInformation.secondaryEmail ||
      resourcesData.contactInformation.secondaryPhone) {
    contentHTML += `<div style="margin-bottom: 16px;">`;
    
    if (resourcesData.contactInformation.secondaryTypeCustom || resourcesData.contactInformation.secondaryType) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: bold; color: #6B7280; text-transform: uppercase;">Secondary Contact Type:</span>
          <strong style="font-size: 14px;">
            ${resourcesData.contactInformation.secondaryTypeCustom || resourcesData.contactInformation.secondaryType}
          </strong>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.secondaryName) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Name:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.secondaryName}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.secondaryEmail) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Email:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.secondaryEmail}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.secondaryPhone) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Phone:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.secondaryPhone}
          </span>
        </div>
      `;
    }
    
    contentHTML += `</div>`;
  }

  // Tertiary Contact - only show if any field has content
  if (resourcesData.contactInformation.tertiaryTypeCustom ||
      resourcesData.contactInformation.tertiaryType ||
      resourcesData.contactInformation.tertiaryName ||
      resourcesData.contactInformation.tertiaryEmail ||
      resourcesData.contactInformation.tertiaryPhone) {
    contentHTML += `<div style="margin-bottom: 16px;">`;
    
    if (resourcesData.contactInformation.tertiaryTypeCustom || resourcesData.contactInformation.tertiaryType) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: bold; color: #6B7280; text-transform: uppercase;">Tertiary Contact Type:</span>
          <strong style="font-size: 14px;">
            ${resourcesData.contactInformation.tertiaryTypeCustom || resourcesData.contactInformation.tertiaryType}
          </strong>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.tertiaryName) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Name:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.tertiaryName}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.tertiaryEmail) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Email:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.tertiaryEmail}
          </span>
        </div>
      `;
    }
    
    if (resourcesData.contactInformation.tertiaryPhone) {
      contentHTML += `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: bold; color: #374151;">Phone:</span>
          <span style="font-size: 14px; color: #6B7280;">
            ${resourcesData.contactInformation.tertiaryPhone}
          </span>
        </div>
      `;
    }
    
    contentHTML += `</div>`;
  }

  contentHTML += `</div>`;
  
  container.innerHTML = contentHTML;
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: 800,
      height: 600,
    });
    
    const dataURL = canvas.toDataURL('image/png');
    return dataURL;
  } finally {
    document.body.removeChild(container);
  }
}

// Alternative function that works with an existing DOM element
export async function generateEligibilityImageFromElement(
  elementRef: HTMLElement
): Promise<string> {
  try {
    const canvas = await html2canvas(elementRef, {
      backgroundColor: null, // Transparent background
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating eligibility image:', error);
    throw error;
  }
}

// Function to convert data URL to File object
function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// Function to upload image file to server
async function uploadPreviewImage(imageFile: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', imageFile);
  try {
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload preview image: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    if (!result.url) {
      throw new Error('Upload response missing URL');
    }
    return result.url;
  } catch (error) {
    throw error;
  }
}

// Function to generate images from data URLs
export async function generateImagesFromDataUrls(
  imageDataArray: Array<{ key: string; dataUrl: string }>,
  config?: { width?: number; height?: number; quality?: number; format?: string }
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  
  for (const { key, dataUrl } of imageDataArray) {
    try {
      const filename = `${key}-preview.png`;
      const imageFile = dataURLtoFile(dataUrl, filename);
      const imageUrl = await uploadPreviewImage(imageFile);
      results[key] = imageUrl;
    } catch (error) {
      console.error(`Error processing image for ${key}:`, error);
      results[key] = null;
    }
  }
  
  return results;
} 