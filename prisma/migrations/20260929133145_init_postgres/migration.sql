-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('credentials', 'google');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('in_progress', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TeammatePersonType" AS ENUM ('team_member', 'collaborator');

-- CreateEnum
CREATE TYPE "TeammateProfileState" AS ENUM ('contact', 'invited', 'active');

-- CreateEnum
CREATE TYPE "TeammateAssignmentRole" AS ENUM ('owner', 'admin', 'editor', 'viewer', 'contributor', 'reviewer', 'custom');

-- CreateEnum
CREATE TYPE "TeammateCategoryScope" AS ENUM ('all', 'selected');

-- CreateEnum
CREATE TYPE "TeammateCompanyEntityType" AS ENUM ('partner_provider');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL DEFAULT 'credentials',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT,
    "organizationEmail" TEXT,
    "password" TEXT,
    "resetCode" TEXT,
    "resetCodeExpiry" TIMESTAMP(3),
    "emailVerificationCode" TEXT,
    "emailVerificationExpiry" TIMESTAMP(3),
    "pendingEmail" TEXT,
    "phone" TEXT,
    "phoneExtension" TEXT,
    "organizationType" TEXT,
    "customOrganization" TEXT,
    "teamSize" TEXT,
    "website" TEXT,
    "brandColor" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "organizationName" TEXT,
    "advisorName" TEXT,
    "advisorEmail" TEXT,
    "advisorPhone" TEXT,
    "advisorPhoneExtension" TEXT,
    "disclaimer" TEXT,
    "advisorLogoUrl" TEXT,
    "complianceEmail" TEXT,
    "advisorLink" TEXT,
    "additionalAdvisorLink" TEXT,
    "recordkeeperContactLabel" TEXT,
    "primaryServiceCategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "headshot" TEXT,
    "backgroundImage" TEXT,
    "aiAvatar" TEXT,
    "designations" TEXT[],
    "displayAdvisorInfoHeader" BOOLEAN,
    "displayAdvisorContactButton" BOOLEAN,
    "advisorLogo" TEXT,
    "showAdvancedCompliance" BOOLEAN,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "idIndex" INTEGER,
    "userId" TEXT NOT NULL,
    "videoStatus" "VideoStatus" DEFAULT 'in_progress',
    "clientName" TEXT,
    "clientLogo" TEXT,
    "videoThemeColor" TEXT,
    "videoAvatar" TEXT,
    "videoBackgroundMusic" TEXT,
    "videoBackgroundImage" TEXT,
    "buildSpanishVideo" BOOLEAN NOT NULL DEFAULT false,
    "planType" TEXT,
    "entryDates" TEXT,
    "matchPlan" TEXT,
    "matchSafe" TEXT,
    "nonElective" TEXT,
    "deferrals" TEXT[],
    "investments" TEXT[],
    "advancedInvestments" TEXT[],
    "advancedEntryDates" TEXT[],
    "advancedDeferrals" TEXT[],
    "vestingScheduleRadio" TEXT,
    "vestingSchedules" TEXT[],
    "employerContribution" TEXT,
    "automaticEnrollment" BOOLEAN,
    "automaticIncrease" BOOLEAN,
    "customEntryDates" TEXT,
    "customEntryDateType" TEXT,
    "customEntryDatesValue" TEXT,
    "advancedEntryDatesValue" TEXT,
    "mandatoryContribution" DOUBLE PRECISION,
    "ageRequirement" TEXT,
    "matchType" TEXT,
    "matchPercentage" DOUBLE PRECISION,
    "safeHarborMatch" TEXT,
    "safeHarborMatchType" TEXT,
    "nonElectiveEmployerContributions" BOOLEAN,
    "employerProfitSharingContributions" BOOLEAN,
    "waitingPeriod" BOOLEAN,
    "automaticEnrollmentPercentage" TEXT,
    "automaticEnrollmentWaitPeriod" TEXT,
    "automaticIncreasePercentage" TEXT,
    "automaticIncreaseCap" TEXT,
    "waitingPeriodDuration" TEXT,
    "waitingPeriodStart" TEXT,
    "waitingPeriodStartDate" TEXT,
    "nonElectiveType" TEXT,
    "nonElectivePercentage" TEXT,
    "profitSharingType" TEXT,
    "profitSharingPercentage" TEXT,
    "useCustomText" BOOLEAN,
    "customText" TEXT,
    "useProfitSharingCustomText" BOOLEAN,
    "profitSharingCustomText" TEXT,
    "recordkeeper" TEXT,
    "recordKeeperName" TEXT,
    "recordKeeperPhone" TEXT,
    "recordKeeperPhoneExtension" TEXT,
    "recordKeeperWebsite" TEXT,
    "companyName" TEXT,
    "onlineEnrollment" TEXT,
    "isDisplayRecodeKeeper" BOOLEAN,
    "title" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "phoneNumberExtension" TEXT,
    "planAdvisor" TEXT,
    "companyContact" TEXT,
    "tpa" TEXT,
    "educationalVideos" TEXT,
    "providerName" TEXT,
    "providerLogo" TEXT,
    "website" TEXT,
    "providerPhoneNumber" TEXT,
    "providerPhoneNumberExtension" TEXT,
    "displayAdvisorInfoHeader" BOOLEAN,
    "tpaName" TEXT,
    "tpaEmail" TEXT,
    "tpaPhoneNumber" TEXT,
    "tpaPhoneNumberExtension" TEXT,
    "planDocumentsLinks" TEXT,
    "recordKeeperId" TEXT,
    "addressCode" TEXT,
    "rawData" JSONB,
    "pageView" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitor" INTEGER NOT NULL DEFAULT 0,
    "videoPlay" INTEGER NOT NULL DEFAULT 0,
    "videoComplete" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientContactBuilder" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "customRole" TEXT,
    "description" TEXT,
    "showOnPortal" BOOLEAN NOT NULL DEFAULT false,
    "enableContactButton" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "phone" TEXT,
    "phoneExtension" TEXT,
    "meetingLink" TEXT,
    "headshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientContactBuilder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "clientId" TEXT,
    "videoUrl" TEXT,
    "thumbnail" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "videoProvider" TEXT NOT NULL DEFAULT 'synthesia',
    "videoProviderId" TEXT,
    "videoStatus" "VideoStatus" DEFAULT 'in_progress',
    "pagePlacement" TEXT,
    "pageIndex" INTEGER,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAnalytic" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "planId" TEXT,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "pageView" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitor" INTEGER NOT NULL DEFAULT 0,
    "videoPlay" INTEGER NOT NULL DEFAULT 0,
    "videoComplete" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAnalytic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "planStaticId" TEXT,
    "name" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyStorage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailTask" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardClientProfile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL,
    "customOrganization" TEXT,
    "organizationName" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardTeamSize" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardTeamSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardServices" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "services" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardServices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardInsuranceLicensing" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "offersInsurance" BOOLEAN NOT NULL DEFAULT false,
    "licenseTypes" TEXT[],
    "statesLicensed" TEXT[],
    "licenseNumbers" JSONB NOT NULL,
    "attestation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardInsuranceLicensing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardTeamMembers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardTeamMembers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FutureContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customRole" TEXT,
    "headshot" TEXT,
    "showOnPortal" BOOLEAN NOT NULL DEFAULT false,
    "enableContactButton" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayScope" TEXT,
    "benefitsCategory" TEXT,
    "benefitsCategoryOther" TEXT,
    "roleOther" TEXT,
    "isPrimaryForCategory" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "companyLogo" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "phoneExtension" TEXT,
    "website" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FutureContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardBranding" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "logo" TEXT,
    "logoFileName" TEXT,
    "backgroundImage" TEXT,
    "backgroundFileName" TEXT,
    "organizationName" TEXT,
    "website" TEXT,
    "missionStatement" TEXT,
    "brandColor" TEXT NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "aiAvatar" TEXT,
    "avatarFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardBenefitTypes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "benefitTypes" TEXT[],
    "customBenefitType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardBenefitTypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardEmployerScope" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "servesMultipleEmployers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardEmployerScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardUserSetup" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationEmail" TEXT,
    "phone" TEXT NOT NULL,
    "phoneExtension" TEXT,
    "title" TEXT NOT NULL,
    "designations" TEXT[],
    "headshot" TEXT,
    "headshotData" JSONB,
    "backgroundImage" TEXT,
    "backgroundFileName" TEXT,
    "saveAsContact" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardUserSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardDisclaimers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "disclaimers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WizardDisclaimers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientWizardSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientWizardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientCompanyBasics" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyWebsite" TEXT,
    "companyLogo" TEXT,
    "logoFileName" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1F3A60',
    "secondaryColor" TEXT NOT NULL DEFAULT '#6B7280',
    "typographyTheme" TEXT,
    "brandImages" JSONB NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'client',
    "portalUrl" TEXT,
    "heroOverlayOpacity" DOUBLE PRECISION,
    "heroBackgroundOpacity" DOUBLE PRECISION,
    "heroContainerOpacity" DOUBLE PRECISION,
    "heroContainerBackgroundOpacity" DOUBLE PRECISION,
    "heroContainerBlockOpacity" DOUBLE PRECISION,
    "heroCompanyNameColor" TEXT,
    "heroContainerInverted" BOOLEAN DEFAULT false,
    "heroBackgroundInverted" BOOLEAN DEFAULT false,
    "heroUseGradient" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientCompanyBasics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientWelcomeStatement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "isAIGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientWelcomeStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientKeyContacts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contacts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientKeyContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientComplianceDocuments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "spdFile" JSONB,
    "retirementPlanDocuments" JSONB,
    "otherDocuments" JSONB,
    "recordkeeper" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientComplianceDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewClientEmployeePortalPreview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "previewData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewClientEmployeePortalPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "slug" TEXT,
    "companyName" TEXT NOT NULL,
    "previousName" TEXT,
    "nameUpdatedAt" TIMESTAMP(3),
    "companyWebsite" TEXT,
    "companyLogo" TEXT,
    "companyLogoCropData" JSONB,
    "logoFileName" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#1F3A60',
    "secondaryColor" TEXT NOT NULL DEFAULT '#6B7280',
    "typographyTheme" TEXT,
    "missionHeadline" TEXT,
    "missionBody" TEXT,
    "appointmentLink" TEXT,
    "employeePortalPreview" JSONB,
    "categoryPortalVisibility" JSONB,
    "heroTitle" TEXT,
    "heroDescription" TEXT,
    "heroOverlayOpacity" DOUBLE PRECISION,
    "heroBackgroundOpacity" DOUBLE PRECISION,
    "heroContainerOpacity" DOUBLE PRECISION,
    "heroContainerBackgroundOpacity" DOUBLE PRECISION,
    "heroContainerBlockOpacity" DOUBLE PRECISION,
    "heroCompanyNameColor" TEXT,
    "heroContainerInverted" BOOLEAN DEFAULT false,
    "heroBackgroundInverted" BOOLEAN DEFAULT false,
    "heroUseGradient" BOOLEAN DEFAULT false,
    "desktopHeroBackgroundPosition" JSONB,
    "mobileHeroBackgroundPosition" JSONB,
    "backgroundImg" TEXT,
    "backgroundImgName" TEXT,
    "thumbnailImg" TEXT,
    "thumbnailImgName" TEXT,
    "secondaryBannerImg" TEXT,
    "secondaryBannerImgName" TEXT,
    "faviconImg" TEXT,
    "faviconImgName" TEXT,
    "brandImagesCropData" JSONB,
    "disclaimers" JSONB,
    "keyContacts" JSONB NOT NULL,
    "recordkeeper" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "type" TEXT NOT NULL DEFAULT 'client',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "journeyHeader" TEXT,
    "journeySubtitle" TEXT,
    "journeyBodyText" TEXT,
    "planVideo" TEXT,
    "planVideoFileName" TEXT,
    "partnerLogo" TEXT,
    "backgroundImage" TEXT,
    "innerHeaderImage" TEXT,
    "helpCards" JSONB,
    "insurancePlanId" TEXT,
    "insuranceLoginUrl" TEXT,
    "insuranceBackgroundImage" TEXT,
    "insuranceContainerBlockOpacity" DOUBLE PRECISION,
    "faqs" JSONB,
    "supportContacts" JSONB,
    "providerContact" JSONB,
    "signatureMode" TEXT,
    "customClosing" TEXT,
    "customSignatureName" TEXT,
    "customSignatureCompany" TEXT,
    "customClosingBold" BOOLEAN,
    "customClosingItalic" BOOLEAN,
    "customSignatureNameBold" BOOLEAN,
    "customSignatureNameItalic" BOOLEAN,
    "customSignatureCompanyBold" BOOLEAN,
    "customSignatureCompanyItalic" BOOLEAN,
    "heroBackgroundOpacity" DOUBLE PRECISION,
    "heroContainerBlockOpacity" DOUBLE PRECISION,
    "heroContainerInverted" BOOLEAN,
    "heroBackgroundInverted" BOOLEAN,
    "heroUseGradient" BOOLEAN,
    "desktopHeroBackgroundPosition" JSONB,
    "mobileHeroBackgroundPosition" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "meeting" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "timezone" TEXT,
    "duration" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "platform" TEXT,
    "meetingLink" TEXT,
    "maxAttendees" INTEGER,
    "attendees" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "language" TEXT,
    "benefitsCategory" TEXT,
    "customBenefitsCategory" TEXT,
    "hubLocation" TEXT,
    "displayOnPortal" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "registrationUrl" TEXT,
    "replayUrl" TEXT,
    "startAtUtc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCustomType" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MeetingCustomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webinar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "webinarTitle" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "benefitsCategory" TEXT,
    "placements" JSONB,
    "videoSize" INTEGER,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "sourceType" JSONB NOT NULL,
    "videoFileUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Document',
    "shortDescription" TEXT,
    "language" TEXT DEFAULT 'EN',
    "clientId" TEXT NOT NULL,
    "category" TEXT,
    "categorySuggested" TEXT,
    "categoryConfidence" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),
    "sortOrder" INTEGER,
    "showQrCode" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFlyer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "modeOptions" JSONB,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "hubUrlSnapshot" TEXT NOT NULL,
    "brandSnapshot" JSONB NOT NULL,
    "pdfStorageKey" TEXT NOT NULL,
    "pngStorageKey" TEXT NOT NULL,
    "aiModel" TEXT,
    "aiPromptVersion" TEXT,
    "generatedCopyAt" TIMESTAMP(3),
    "title" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingFlyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT,
    "endDate" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#23919c',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Headshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "square400" TEXT NOT NULL,
    "square800" TEXT NOT NULL,
    "circle400" TEXT NOT NULL,
    "circle800" TEXT NOT NULL,
    "avatar64" TEXT NOT NULL,
    "cropData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Headshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSlug" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSlug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "organizationEmail" TEXT,
    "seatsIncluded" INTEGER,
    "planTier" TEXT,
    "branding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeammateCompany" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "branding" JSONB,
    "entityType" "TeammateCompanyEntityType" NOT NULL DEFAULT 'partner_provider',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeammateCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeammateProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loginUserId" TEXT,
    "type" "TeammatePersonType" NOT NULL,
    "state" "TeammateProfileState" NOT NULL DEFAULT 'contact',
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "designations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "phoneExtension" TEXT,
    "headshot" TEXT,
    "benefitsSpecialty" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companyId" TEXT,
    "allPlans" BOOLEAN NOT NULL DEFAULT false,
    "invitedByUserId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeammateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryScope" "TeammateCategoryScope" NOT NULL DEFAULT 'all',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" "TeammateAssignmentRole" NOT NULL DEFAULT 'contributor',
    "permissionSet" JSONB NOT NULL,
    "showOnBenefitsHub" BOOLEAN NOT NULL DEFAULT true,
    "contactId" TEXT,
    "invitedByUserId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "inviteNote" TEXT,
    "inviteDueDate" TIMESTAMP(3),
    "lastChangedByUserId" TEXT,
    "lastChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeammateAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileId" TEXT,
    "assignmentId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "warningsConfirmed" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeammateAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_done_idx" ON "Task"("userId", "done");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_idIndex_key" ON "Plan"("idIndex");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientContactBuilder_sessionId_key" ON "NewClientContactBuilder"("sessionId");

-- CreateIndex
CREATE INDEX "Video_planId_idx" ON "Video"("planId");

-- CreateIndex
CREATE INDEX "Video_clientId_idx" ON "Video"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAnalytic_key_key" ON "PlanAnalytic"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KeyStorage_key_key" ON "KeyStorage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WizardClientProfile_sessionId_key" ON "WizardClientProfile"("sessionId");

-- CreateIndex
CREATE INDEX "WizardClientProfile_organizationType_idx" ON "WizardClientProfile"("organizationType");

-- CreateIndex
CREATE UNIQUE INDEX "WizardTeamSize_sessionId_key" ON "WizardTeamSize"("sessionId");

-- CreateIndex
CREATE INDEX "WizardTeamSize_teamSize_idx" ON "WizardTeamSize"("teamSize");

-- CreateIndex
CREATE UNIQUE INDEX "WizardServices_sessionId_key" ON "WizardServices"("sessionId");

-- CreateIndex
CREATE INDEX "WizardServices_services_idx" ON "WizardServices" USING GIN ("services");

-- CreateIndex
CREATE UNIQUE INDEX "WizardInsuranceLicensing_sessionId_key" ON "WizardInsuranceLicensing"("sessionId");

-- CreateIndex
CREATE INDEX "WizardInsuranceLicensing_offersInsurance_idx" ON "WizardInsuranceLicensing"("offersInsurance");

-- CreateIndex
CREATE INDEX "WizardInsuranceLicensing_licenseTypes_idx" ON "WizardInsuranceLicensing" USING GIN ("licenseTypes");

-- CreateIndex
CREATE INDEX "WizardInsuranceLicensing_statesLicensed_idx" ON "WizardInsuranceLicensing" USING GIN ("statesLicensed");

-- CreateIndex
CREATE UNIQUE INDEX "WizardTeamMembers_sessionId_key" ON "WizardTeamMembers"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardBranding_sessionId_key" ON "WizardBranding"("sessionId");

-- CreateIndex
CREATE INDEX "WizardBranding_brandColor_idx" ON "WizardBranding"("brandColor");

-- CreateIndex
CREATE UNIQUE INDEX "WizardBenefitTypes_sessionId_key" ON "WizardBenefitTypes"("sessionId");

-- CreateIndex
CREATE INDEX "WizardBenefitTypes_benefitTypes_idx" ON "WizardBenefitTypes" USING GIN ("benefitTypes");

-- CreateIndex
CREATE UNIQUE INDEX "WizardEmployerScope_sessionId_key" ON "WizardEmployerScope"("sessionId");

-- CreateIndex
CREATE INDEX "WizardEmployerScope_servesMultipleEmployers_idx" ON "WizardEmployerScope"("servesMultipleEmployers");

-- CreateIndex
CREATE UNIQUE INDEX "WizardUserSetup_sessionId_key" ON "WizardUserSetup"("sessionId");

-- CreateIndex
CREATE INDEX "WizardUserSetup_title_idx" ON "WizardUserSetup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "WizardDisclaimers_sessionId_key" ON "WizardDisclaimers"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientCompanyBasics_sessionId_key" ON "NewClientCompanyBasics"("sessionId");

-- CreateIndex
CREATE INDEX "NewClientCompanyBasics_companyName_idx" ON "NewClientCompanyBasics"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientWelcomeStatement_sessionId_key" ON "NewClientWelcomeStatement"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientKeyContacts_sessionId_key" ON "NewClientKeyContacts"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientComplianceDocuments_sessionId_key" ON "NewClientComplianceDocuments"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewClientEmployeePortalPreview_sessionId_key" ON "NewClientEmployeePortalPreview"("sessionId");

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Benefit_clientId_idx" ON "Benefit"("clientId");

-- CreateIndex
CREATE INDEX "Benefit_category_idx" ON "Benefit"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Benefit_clientId_category_key" ON "Benefit"("clientId", "category");

-- CreateIndex
CREATE INDEX "Meeting_userId_idx" ON "Meeting"("userId");

-- CreateIndex
CREATE INDEX "Meeting_clientId_idx" ON "Meeting"("clientId");

-- CreateIndex
CREATE INDEX "Meeting_client_idx" ON "Meeting"("client");

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_meetingType_idx" ON "Meeting"("meetingType");

-- CreateIndex
CREATE INDEX "Meeting_archived_idx" ON "Meeting"("archived");

-- CreateIndex
CREATE INDEX "Meeting_displayOnPortal_idx" ON "Meeting"("displayOnPortal");

-- CreateIndex
CREATE INDEX "Meeting_startAtUtc_idx" ON "Meeting"("startAtUtc");

-- CreateIndex
CREATE INDEX "Webinar_userId_idx" ON "Webinar"("userId");

-- CreateIndex
CREATE INDEX "Webinar_clientId_idx" ON "Webinar"("clientId");

-- CreateIndex
CREATE INDEX "Webinar_eventDate_idx" ON "Webinar"("eventDate");

-- CreateIndex
CREATE INDEX "Webinar_createdAt_idx" ON "Webinar"("createdAt");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_uploadedAt_idx" ON "Document"("uploadedAt");

-- CreateIndex
CREATE INDEX "Document_language_idx" ON "Document"("language");

-- CreateIndex
CREATE INDEX "Document_expirationDate_idx" ON "Document"("expirationDate");

-- CreateIndex
CREATE INDEX "Document_clientId_category_idx" ON "Document"("clientId", "category");

-- CreateIndex
CREATE INDEX "Document_clientId_archivedAt_idx" ON "Document"("clientId", "archivedAt");

-- CreateIndex
CREATE INDEX "MarketingFlyer_clientId_idx" ON "MarketingFlyer"("clientId");

-- CreateIndex
CREATE INDEX "MarketingFlyer_userId_idx" ON "MarketingFlyer"("userId");

-- CreateIndex
CREATE INDEX "MarketingFlyer_clientId_archivedAt_idx" ON "MarketingFlyer"("clientId", "archivedAt");

-- CreateIndex
CREATE INDEX "MarketingFlyer_createdAt_idx" ON "MarketingFlyer"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingAsset_clientId_idx" ON "MarketingAsset"("clientId");

-- CreateIndex
CREATE INDEX "MarketingAsset_userId_idx" ON "MarketingAsset"("userId");

-- CreateIndex
CREATE INDEX "MarketingAsset_clientId_type_idx" ON "MarketingAsset"("clientId", "type");

-- CreateIndex
CREATE INDEX "MarketingAsset_clientId_status_idx" ON "MarketingAsset"("clientId", "status");

-- CreateIndex
CREATE INDEX "Headshot_userId_idx" ON "Headshot"("userId");

-- CreateIndex
CREATE INDEX "Headshot_createdAt_idx" ON "Headshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSlug_slug_key" ON "PortalSlug"("slug");

-- CreateIndex
CREATE INDEX "PortalSlug_clientId_idx" ON "PortalSlug"("clientId");

-- CreateIndex
CREATE INDEX "PortalSlug_clientId_isCurrent_idx" ON "PortalSlug"("clientId", "isCurrent");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE INDEX "TeammateCompany_organizationId_idx" ON "TeammateCompany"("organizationId");

-- CreateIndex
CREATE INDEX "TeammateCompany_organizationId_name_idx" ON "TeammateCompany"("organizationId", "name");

-- CreateIndex
CREATE INDEX "TeammateProfile_organizationId_idx" ON "TeammateProfile"("organizationId");

-- CreateIndex
CREATE INDEX "TeammateProfile_organizationId_email_idx" ON "TeammateProfile"("organizationId", "email");

-- CreateIndex
CREATE INDEX "TeammateProfile_companyId_idx" ON "TeammateProfile"("companyId");

-- CreateIndex
CREATE INDEX "TeammateProfile_loginUserId_idx" ON "TeammateProfile"("loginUserId");

-- CreateIndex
CREATE INDEX "TeammateProfile_organizationId_deactivatedAt_idx" ON "TeammateProfile"("organizationId", "deactivatedAt");

-- CreateIndex
CREATE INDEX "PlanAssignment_organizationId_idx" ON "PlanAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "PlanAssignment_clientId_idx" ON "PlanAssignment"("clientId");

-- CreateIndex
CREATE INDEX "PlanAssignment_profileId_idx" ON "PlanAssignment"("profileId");

-- CreateIndex
CREATE INDEX "PlanAssignment_clientId_contactId_idx" ON "PlanAssignment"("clientId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAssignment_profileId_clientId_key" ON "PlanAssignment"("profileId", "clientId");

-- CreateIndex
CREATE INDEX "TeammateAuditEvent_organizationId_createdAt_idx" ON "TeammateAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TeammateAuditEvent_profileId_idx" ON "TeammateAuditEvent"("profileId");

-- CreateIndex
CREATE INDEX "TeammateAuditEvent_assignmentId_idx" ON "TeammateAuditEvent"("assignmentId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientContactBuilder" ADD CONSTRAINT "NewClientContactBuilder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAnalytic" ADD CONSTRAINT "PlanAnalytic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAnalytic" ADD CONSTRAINT "PlanAnalytic_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardSession" ADD CONSTRAINT "WizardSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardClientProfile" ADD CONSTRAINT "WizardClientProfile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardTeamSize" ADD CONSTRAINT "WizardTeamSize_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardServices" ADD CONSTRAINT "WizardServices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardInsuranceLicensing" ADD CONSTRAINT "WizardInsuranceLicensing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardTeamMembers" ADD CONSTRAINT "WizardTeamMembers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FutureContact" ADD CONSTRAINT "FutureContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardBranding" ADD CONSTRAINT "WizardBranding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardBenefitTypes" ADD CONSTRAINT "WizardBenefitTypes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardEmployerScope" ADD CONSTRAINT "WizardEmployerScope_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardUserSetup" ADD CONSTRAINT "WizardUserSetup_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WizardDisclaimers" ADD CONSTRAINT "WizardDisclaimers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientWizardSession" ADD CONSTRAINT "NewClientWizardSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientCompanyBasics" ADD CONSTRAINT "NewClientCompanyBasics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientWelcomeStatement" ADD CONSTRAINT "NewClientWelcomeStatement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientKeyContacts" ADD CONSTRAINT "NewClientKeyContacts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientComplianceDocuments" ADD CONSTRAINT "NewClientComplianceDocuments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewClientEmployeePortalPreview" ADD CONSTRAINT "NewClientEmployeePortalPreview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NewClientWizardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingCustomType" ADD CONSTRAINT "MeetingCustomType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webinar" ADD CONSTRAINT "Webinar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webinar" ADD CONSTRAINT "Webinar_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFlyer" ADD CONSTRAINT "MarketingFlyer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFlyer" ADD CONSTRAINT "MarketingFlyer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Headshot" ADD CONSTRAINT "Headshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
