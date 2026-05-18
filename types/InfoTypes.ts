// types/InfoTypes.ts
export type InfoTypes = {
  userId?: string

  // branding
  clientName?: string
  videoThemeColor?: string
  videoAvatar?: string
  videoBackgroundMusic?: string
  videoBackgroundImage?: File | string | null
  buildSpanishVideo?: boolean
  clientLogo?: File | string | null

  // Synthesia Template


  // detail
  match?: string
  planType?: string
  matchPlan?: string
  matchSafe?: string
  nonElective?: string
  entryDates?: string
  showAdvancedInvestment?: boolean
  showAdvancedDeferrals?: boolean
  showAdvancedChildDeferrals?: boolean
  advancedEntryDates?: string[]
  advancedDeferrals?: string[]
  investments?: string[]
  mandatoryContribution?: string
  deferrals?: string[]
  advancedInvestments?: string[]
  ageRequirement?: string
  vestingScheduleRadio?: string
  vestingSchedules?: string[]
  employerContribution?: string
  automaticEnrollment?: boolean
  automaticIncrease?: boolean
  customEntryDates?: string
  customEntryDateType?: string
  customEntryDatesValue?: string
  fullCustomEntryDates?: string
  advancedEntryHours?: string
  matchType?: string
  customMatchDescription?: string
  matchPercentage?: number
  safeHarborMatch?: string
  safeHarborMatchType?: string
  safeHarborContribution?: string | number
  showWaitingPeriod?: boolean
  nonElectiveEmployerContributions?: boolean
  employerProfitSharingContributions?: boolean
  waitingPeriod?: boolean
  automaticEnrollmentPercentage?: string
  automaticEnrollmentWaitPeriod?: string
  annualAutoIncrease?: string
  automaticIncreasePercentage?: string
  deferralCap?: string
  automaticIncreaseCap?: string
  advancedEntryDatesValue?: string
  waitingPeriodDuration?: string
  waitingPeriodStart?: string
  waitingPeriodStartDate?: string
  nonElectiveType?: string
  nonElectivePercentage?: string
  profitSharingType?: string
  profitSharingPercentage?: string
  useCustomText?: boolean
  customText?: string
  useProfitSharingCustomText?: boolean
  profitSharingCustomText?: string
  customScheduleYears?: string
  customStructureText?: string
  eligibilityRequirement?: string
  entryDate?: string
  customEligibilityText?: string
  customEntryDateText?: string

  profitSharingEligibilityTitle?: string
  profitSharingEligibilityRequirement?: string
  profitSharingEligibilityRequirementCustom?: string
  profitSharingEntryTitle?: string
  profitSharingEntryDate?: string
  profitSharingEntryDateCustom?: string
  profitSharingVestingTitle?: string
  profitSharingVesting?: string
  profitSharingVestingCustom?: string
  nonElectiveTitle?: string
  nonElectiveEligibilityRequirement?: string
  nonElectiveEligibilityRequirementCustom?: string
  nonElectiveEntryTitle?: string
  nonElectiveEntryDate?: string
  nonElectiveEntryDateCustom?: string
  nonElectiveVestingTitle?: string
  nonElectiveVesting?: string
  nonElectiveVestingCustom?: string

  // matching & vesting
  matchCategory?: string
  matchAmount?: string
  matchLimit?: string
  vestingSchedule?: string
  vestingYears?: string
  vestingCliff?: boolean
  vestingCliffYears?: string
  vestingDetails?: string

  // resources
  script?: string
  recordKeeperName?: string
  recordKeeperPhone?: string
  recordKeeperPhoneExtension?: string
  recordKeeperWebsite?: string
  recordkeeper?: string
  onlineEnrollment?: string
  isDisplayRecodeKeeper?: boolean
  title?: string
  companyName?: string
  contactName?: string
  email?: string
  phoneNumber?: string
  phoneNumberExtension?: string
  planAdvisor?: string
  companyContact?: string
  tpa?: string
  educationalVideos?: string
  providerName?: string
  providerLogo?: string
  website?: string
  providerPhoneNumber?: string
  providerPhoneNumberExtension?: string
  displayAdvisorInfoHeader?: boolean
  tpaName?: string
  tpaEmail?: string
  tpaPhoneNumber?: string
  tpaPhoneNumberExtension?: string
  planDocumentsLinks?: string
  recordKeeperId?: string
  addressCode?: string

  // contact info
  contact_title_1?: string
  contact_name_1?: string
  contact_info_1?: string
  contact_info_2?: string
  contact2_title_1?: string
  contact2_name_1?: string
  contact2_info_1?: string
  contact2_info_2?: string
  contact3_title_1?: string
  contact3_name_1?: string
  contact3_info_1?: string
  contact3_info_2?: string
  contact4_title_1?: string
  contact4_name_1?: string
  contact4_info_1?: string
  contact4_info_2?: string
  contact5_title_1?: string
  contact5_name_1?: string
  contact5_info_1?: string
  contact5_info_2?: string

  // disclaimer
  disclaimer?: string
}
