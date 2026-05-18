import { IPlanFormData } from "@/components/pages/create-dashboard";
import { SYNTHESIA_TEMPLATE_ID } from "@/constants/app";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendMail";
import { InfoTypes } from "@/types/InfoTypes";
import axios from "axios";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const mailTemplate = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; color: #333333; padding: 20px; margin: 0;">
    <div width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
      <h2 style="margin-top: 0; color: #111111;">Your PlanTelligence Benefits Portal and related content are generating</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        You will be notified when this process has completed
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Typically, it takes around <strong>5-10 minutes</strong>. 
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Contact us if you need support:
        <a href="mailto:support@plantelligence.ai" style="color: #0070f3;">support@plantelligence.ai</a>
      </p>
    </div>
  </body>
</html>
`;

export async function POST(req: NextRequest) {
  // const url = new URL(request.url);
  // const id = url.pathname.split("/").pop(); // Extract ID from URL path

  // if (!id || typeof id !== "string") {
  // }

  // const { userId, ...data } = await req.json();

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Auth required");
  }

  type TBody = IPlanFormData["branding"] &
    IPlanFormData["employerContributions"] &
    IPlanFormData["investments"] &
    IPlanFormData["planDetails"] &
    IPlanFormData["resources"] & { disclaimer?: string };

  const body: TBody = await req.json();

  const contributionObjects = body.contributionTypes.map((type) => ({
    ...body[type],
    title: type,
  })) as any;

  const sortedContributions = contributionObjects.sort((a: any, b: any) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  const disclaimer = {
    disclaimer: body.disclaimer[0] || "-",
    ...Object.fromEntries(
      Array.from({ length: 24 }, (_, i) => [
        `disclaimer_line${i + 1}`,
        body.disclaimer[i + 1] || "-",
      ]),
    ),
  };

  const updatedEnrollmentMethods =
    body?.employeeDeferrals?.enrollmentMethods?.map((method) =>
      method === "custom"
        ? body?.employeeDeferrals?.customEnrollmentMethod
        : method,
    );

  const updatedPlanFeatures = body.planFeatures?.map((feature) =>
    feature === "custom" ? body?.customFeature : feature,
  );

  const planFeatures = {
    ...Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        `plan_feature${i + 1}`,
        updatedPlanFeatures?.[i] || "-",
      ]),
    ),
  };

  const enrollmentOptions = {
    ...Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [
        `enrollment_option${i + 1}`,
        updatedEnrollmentMethods[i] || "",
      ]),
    ),
  };

  try {
    const contributions = sortedContributions.slice(0, 2);
    let enrollment: any = {}
    if(Object.values(enrollmentOptions).length > 0){
      enrollment.enrollment_option = "Enrollment Option";
      enrollment.enrollment_option1 = enrollmentOptions.enrollment_option1 || "-";
      enrollment.enrollment_option2 = enrollmentOptions.enrollment_option2 || "-";
      enrollment.enrollment_option3 = enrollmentOptions.enrollment_option3 || "-";
      enrollment.enrollment_option4 = enrollmentOptions.enrollment_option4 || "-";
      enrollment.enrollment_option5 = enrollmentOptions.enrollment_option5 || "-";
    }else{
      enrollment.enrollment_option = "Auto Enrollment";
      enrollment.enrollment_option1 = body.employeeDeferrals.enrollmentRate || "-";
      enrollment.enrollment_option2 = body.employeeDeferrals.autoEscalation || "-";
      enrollment.enrollment_option3 = body.employeeDeferrals.deferralCap || "-";
      enrollment.enrollment_option4 =  "-";
      enrollment.enrollment_option5 =  "-";
    }


    let payload: any = {
      templateId: SYNTHESIA_TEMPLATE_ID,
      title: `Plan Details for ${body.companyName}`,
      description: "A personalized video based on your plan selections.",
      script: "",
      visibility: "public",
      branding: {
        primary_color: body.accentColor,
      },
      // https://docs.google.com/document/d/1-g7fU2y3YqPbHZxaCjzGREwhYLFj2NycQF8J8CQ3XQ8/edit?pli=1&tab=t.0
      templateData: {
        // Plan Type Selection
        plan_type: body.planType,
        plan_name: body.planName,
        plan_ID: body.contactInformation?.planId,
        // Eligibility Rules & Entry Period
        age_requirement:
          body.eligibility.customAgeRequirement ||
          body.eligibility.ageRequirement ||
          "-",
        eligibility_requirement:
          body.eligibility.customServiceRequirement ||
          body.eligibility.serviceRequirement ||
          "-",
        entry_date:
          body.eligibility.customEntryDate || body.eligibility.entryDate || "-",

        // Auto-Enrollment
        // auto_enrollment_rate: body.autoEnrollmentRate,
        // auto_enrollment_rate: body.employeeDeferrals.enrollmentRate || "-",
        // annual_auto_increase: body.employeeDeferrals.autoEscalation || "-",
        // deferral_cap: body.employeeDeferrals.deferralCap || "-",

        // PlanId
        plan_id: body.contactInformation.planId || "-",

        // Employee primary contribution
        primary_contribution_title: contributions?.[0]?.title || "-",
        primary_contribution_detail1:
          contributions?.[0]?.customFormula ||
          contributions?.[0]?.formula ||
          "-",
        primary_contribution_detail2:
          contributions?.[0]?.customLimit || contributions?.[0]?.limit || "-",
        primary_contribution_vesting:
          contributions?.[0]?.customVesting ||
          contributions?.[0]?.vesting ||
          "-",

        // Employee secondary contribution
        secondary_contribution_title: contributions?.[1]?.title || "-",
        secondary_contribution_detail1:
          contributions?.[1]?.customFormula ||
          contributions?.[1]?.formula ||
          "-",
        secondary_contribution_detail2:
          contributions?.[1]?.customLimit || contributions?.[1]?.limit || "-",
        secondary_contribution_vesting:
          contributions?.[1]?.customVesting ||
          contributions?.[1]?.vesting ||
          "-",

        // Enrollment options
        ...enrollment,

        // auto_escalation: body.employeeDeferrals.autoEscalation || "-",
        // escalation_cap: body.employeeDeferrals.deferralCap || "-",
        ...planFeatures,

        // Matching & Safe Harbor Mapping to Match Output
        match_category: body.companyMatch.isPrimary ? "Yes" : "No",
        match_line1:
          body.companyMatch.customFormula || body.companyMatch.formula || "-",
        match_line2:
          body.companyMatch.customLimit || body.companyMatch.limit || "-",

        // Vesting Schedule
        vesting_schedule:
          body.companyMatch.customVesting || body.companyMatch.vesting,

        // Non-Elective / Profit Sharing
        ps_type: body.profitSharing.isPrimary ? "Yes" : "No",
        ps_eligibility_title:
          body.eligibility.customAgeRequirement ||
          body.eligibility.ageRequirement ||
          "-",
        ps_eligibility_req:
          body.eligibility.customServiceRequirement ||
          body.eligibility?.serviceRequirement ||
          "-",
        ps_entry_title:
          body.profitSharing.customDetails || body.profitSharing.details || "-",
        ps_entry_date:
          body.profitSharing.customVesting || body.profitSharing.vesting || "-",
        ps_vesting_title:
          body.profitSharing.customVesting || body.profitSharing.vesting || "-",
        // ps_vesting_title: body.profitSharingVestingTitle,
        ps_vesting:
          body.profitSharing.customVesting || body.profitSharing.vesting || "-",
        ne_entry_title:
          body.fixedAmount.customDetails || body.fixedAmount.details || "-",
        ne_entry_date:
          body.fixedAmount.customVesting || body.fixedAmount.vesting || "-",
        ne_vesting_title:
          body.fixedAmount.customAmount || body.fixedAmount.amount || "-",
        ne_vesting:
          body.fixedAmount.customVesting || body.fixedAmount.vesting || "-",

        ne_type: body.safeHarbor.customType || body.safeHarbor.type || "-",
        ne_eligibility_title:
          body.safeHarbor.customType || body.safeHarbor.type || "-",
        ne_eligibility_req: body.safeHarbor.customFormula || "-",

        // Investment & Operations
        investments: body.investmentOptions?.join(", "),

        // Contact Form (resources)
        contact1_title:
          body.contactInformation?.primaryTypeCustom ||
          body.contactInformation?.primaryType ||
          "-",
        contact1_name: body.contactInformation?.primaryName || "-",
        contact1_email: body.contactInformation?.primaryEmail || "-",
        contact1_phone: body.contactInformation?.primaryPhone || "-",
        contact2_title:
          body.contactInformation?.secondaryTypeCustom ||
          body.contactInformation?.secondaryType ||
          "-",
        contact2_name: body.contactInformation?.secondaryName || "-",
        contact2_email: body.contactInformation?.secondaryEmail || "-",
        contact2_phone: body.contactInformation?.secondaryPhone || "-",
        contact3_title:
          body.contactInformation?.tertiaryTypeCustom ||
          body.contactInformation?.tertiaryType ||
          "-",
        contact3_name: body.contactInformation?.tertiaryName || "-",
        contact3_email: body.contactInformation?.tertiaryEmail || "-",
        contact3_phone: body.contactInformation?.tertiaryPhone || "-",

        // Disclaimer
        ...disclaimer,

        // automatic_enrollment_percentage: body.automaticEnrollmentPercentage,
        // automatic_enrollment_wait_period: body.automaticEnrollmentWaitPeriod,
        // automatic_increase_cap: body.automaticIncreaseCap,
        // automatic_increase_percentage: body.automaticIncreasePercentage,
        // record_keeper_name: body.recordKeeperName,
        // record_keeper_phone: body.recordKeeperPhone,
        // record_keeper_website: body.recordKeeperWebsite,
        // match_percent: body?.matchPercentage,
        // vesting_period:
        //   body.vestingScheduleRadio !== "default"
        //     ? body.vestingScheduleRadio
        //     : "Immediate",
        // match_percentage: body.matchPercentage,
        // company_match_amount: body.matchType,
        // non_elective_contribution_percent: body.nonElectivePercentage,
        // profit_sharing_percent: body.profitSharingPercentage,
        // // entry_date: body.entryDates,
        // percentage_limit: body.automaticIncreaseCap,
        // discretionary_or_non_discretionary: body.nonElectiveType,
        // // new
        // video_avatar: body.videoAvatar,
        // bg_image: body.videoBackgroundImage,
        bg: body.backgroundImage || "",
        logo: body.companyLogo || "",
        qr: body.qrUrl,
        avatar: body.avatarId,
        // match_type: body.matchType,
        // service_requirement:
        //   body.entryDates === "Immediate"
        //     ? "Immediate Entry"
        //     : body.entryDates === "Custom"
        //     ? `${body.customEntryDates} ${body.customEntryDateType}`
        //     : body.entryDates === "Advanced"
        //     ? `${body.advancedEntryHours} Hours`
        //     : body.entryDates === "Full Custom"
        //     ? "Custom-defined"
        //     : "Unknown",
        // // age_requirement: body.ageRequirement,

        // record_keeper_site: body.recordKeeperWebsite,
        // contact_name: body.contactName,
        // contact_email: body.email,
        // contact_phone: body.phoneNumber,
      },
    };

    // if (body.safeHarborMatchType === "Basic Safe Harbor") {
    //   payload.templateData.match_line1 =
    //     "100% match on the first 3% of deferred compensation";
    //   payload.templateData.match_line2 =
    //     "plus a 50% match on deferrals between 3% and 5% (4% total)";
    // }

    // if (body.safeHarborMatchType === "Enhanced Safe Harbor") {
    //   payload.templateData.match_line1 =
    //     "100% match on the first 4% of deferred compensation";
    //   payload.templateData.match_line2 =
    //     "Employer may provide additional contributions";
    // }

    // if (body.safeHarborMatchType === "Non-Elective Safe Harbor") {
    //   payload.templateData.match_line1 =
    //     "Employer contributes at least 3% to all eligible employees";
    //   payload.templateData.match_line2 = "Regardless of employee contributions";
    // }

    // if (body.safeHarborMatchType === "QACA Safe Harbor") {
    //   payload.templateData.match_line1 =
    //     "100% match on the first 1% of compensation";
    //   payload.templateData.match_line2 =
    //     "Then 50% on deferrals above 1% up to 6%";
    // }

    // if (body.disclaimer) {
    //   for (let i = 0; i < 25; i++) {
    //     payload.templateData[`disclaimer_line${i + 1}`] = (body as any)[
    //       `disclaimer_line${i + 1}`
    //     ];
    //   }
    // }

    // Filter out WebP images as Synthesia doesn't support them
    if (payload.templateData.logo && payload.templateData.logo.includes('.webp')) {
      console.warn("WebP logo detected, removing from payload");
      payload.templateData.logo = "";
    }
    
    if (payload.templateData.bg && payload.templateData.bg.includes('.webp')) {
      console.warn("WebP background image detected, removing from payload");
      payload.templateData.bg = "";
    }

    const synthesiaApiKey = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;
    const synthesiaResponse = await axios.post(
      "https://api.synthesia.io/v2/videos/fromTemplate",
      payload,
      {
        headers: {
          Authorization: synthesiaApiKey,
          "Content-Type": "application/json",
        },
      },
    );
    const videoData = synthesiaResponse.data;

    // const result = await prisma.$transaction(async (prisma) => {
    // });
    const key = "planCurrentIndex";
    const setting = await prisma.setting.findFirst({
      where: {
        key: key,
      },
    });

    const newIndex = +(setting?.value || 0) + 1;

    await prisma.setting.upsert({
      where: {
        key: key,
      },
      create: {
        key: key,
        value: `${newIndex}`,
      },
      update: {
        value: `${newIndex}`,
      },
    });

    const user = await prisma.user.findFirst({
      where: {
        email: session?.user?.email || "",
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const plan = await prisma.plan.create({
      data: {
        userId: user.id,
        idIndex: newIndex,

        rawData: body as any,
        clientName: body?.planName,
        companyName: body?.companyName,
        clientLogo: body?.companyLogo as string,
        videoThemeColor: body?.accentColor,
        videoAvatar: body?.avatarId || "avatar",
        // videoBackgroundMusic: body?.videoBackgroundMusic,
        // videoBackgroundImage: body?.videoBackgroundImage as string,
        // buildSpanishVideo: body?.buildSpanishVideo,

        // useCustomText: body?.useCustomText,
        // advancedDeferrals: body?.advancedDeferrals,
        // advancedEntryDates: body?.advancedEntryDates,
        // advancedEntryDatesValue: body?.advancedEntryDatesValue,
        // advancedInvestments: body?.advancedInvestments,
        // ageRequirement: body?.ageRequirement,
        // automaticEnrollment: body?.automaticEnrollment,
        // automaticEnrollmentPercentage: body?.automaticEnrollmentPercentage,
        // automaticEnrollmentWaitPeriod: body?.automaticEnrollmentWaitPeriod,
        // automaticIncrease: body?.automaticIncrease,
        // automaticIncreaseCap: body?.automaticIncreaseCap,
        // automaticIncreasePercentage: body?.automaticIncreasePercentage,
        // customEntryDates: body?.customEntryDates,
        // customEntryDatesValue: body?.customEntryDatesValue,
        // customEntryDateType: body?.customEntryDateType,
        // customText: body?.customText,
        // deferrals: body?.deferrals,
        // employerContribution: body?.employerContribution,
        // employerProfitSharingContributions:
        //   body?.employerProfitSharingContributions,
        // entryDates: body?.entryDates,
        // investments: body?.investments,
        // mandatoryContribution: parseFloat(body?.mandatoryContribution || "0"),
        // matchPercentage: body?.matchPercentage,
        // matchPlan: body?.matchPlan,
        // matchSafe: body?.matchSafe,
        // matchType: body?.matchType,
        // nonElective: body?.nonElective,
        // nonElectiveEmployerContributions:
        //   body?.nonElectiveEmployerContributions,
        // nonElectivePercentage: body?.nonElectivePercentage,
        // nonElectiveType: body?.nonElectiveType,
        // planType: body?.planType,
        // profitSharingCustomText: body?.profitSharingCustomText,
        // profitSharingPercentage: body?.profitSharingPercentage,
        // profitSharingType: body?.profitSharingType,
        // safeHarborMatch: body?.safeHarborMatch,
        // safeHarborMatchType: body?.safeHarborMatchType,
        // useProfitSharingCustomText: body?.useProfitSharingCustomText,
        // vestingScheduleRadio: body?.vestingScheduleRadio,
        // vestingSchedules: body?.vestingSchedules,
        // waitingPeriod: body?.waitingPeriod,
        // waitingPeriodDuration: body?.waitingPeriodDuration,
        // waitingPeriodStart: body?.waitingPeriodStart,
        // waitingPeriodStartDate: body?.waitingPeriodStartDate,

        // resource
        // recordKeeperId: body?.recordKeeperId,
        // recordkeeper: body?.recordkeeper,
        // companyName: body?.companyName,
        // addressCode: body?.addressCode,
        // companyContact: body?.companyContact,
        // contactName: body?.contactName,
        // displayAdvisorInfoHeader: body?.displayAdvisorInfoHeader,
        // educationalVideos: body?.educationalVideos,
        // email: body?.email,
        // isDisplayRecodeKeeper: body?.isDisplayRecodeKeeper,
        // onlineEnrollment: body?.onlineEnrollment,
        // phoneNumber: body?.phoneNumber,
        // planAdvisor: body?.planAdvisor,
        // planDocumentsLinks: body?.planDocumentsLinks,
        // providerLogo: body?.providerLogo,
        // providerName: body?.providerName,
        // providerPhoneNumber: body?.providerPhoneNumber,
        title: body?.companyName,
        // tpa: body?.tpa,
        // tpaEmail: body?.tpaEmail,
        // tpaName: body?.tpaName,
        // tpaPhoneNumber: body?.tpaPhoneNumber,
        // website: body?.website,
      },
    });

    const newVideo = await prisma.video.create({
      data: {
        planId: new ObjectId(plan.id) as any,
        title: videoData.title,
        description: videoData.description,
        videoProvider: "synthesia",
        videoProviderId: videoData.id,
        videoStatus: "in_progress",
        data: videoData.data || null,
      },
    });

    const result = { ...plan, video: newVideo };

    sendEmail({
      to: user.email,
      subject:
        "Your PlanTelligence Benefits Portal and related content are generating",
      html: mailTemplate,
    });

    return NextResponse.json({
      message: "Plan saved successfully",
      data: result,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}

// export async function POST(req: NextRequest) {
//   // const url = new URL(request.url);
//   // const id = url.pathname.split("/").pop(); // Extract ID from URL path

//   // if (!id || typeof id !== "string") {
//   // }

//   // const { userId, ...data } = await req.json();

//   const session = await getServerSession(authOptions);
//   if (!session?.user?.email) {
//     throw new Error("Auth required");
//   }

//   const body: InfoTypes = await req.json();
//   

//   try {
//     let payload: any = {
//       templateId: SYNTHESIA_TEMPLATE_ID,
//       title: `Plan Details for ${body.clientName}`,
//       // title: `Shimano Plan Details`,
//       description: "A personalized video based on your plan selections.",
//       script: body.script,
//       branding: {
//         primary_color: body.videoThemeColor,
//       },
//       // https://docs.google.com/document/d/1-g7fU2y3YqPbHZxaCjzGREwhYLFj2NycQF8J8CQ3XQ8/edit?pli=1&tab=t.0
//       templateData: {
//         // Plan Type Selection
//         plan_type: body.planType,

//         // Eligibility Rules & Entry Period
//         age_requirement: body.ageRequirement,
//         eligibility_requirement: body.eligibilityRequirement,
//         entry_date: body.entryDate,

//         // Auto-Enrollment
//         // auto_enrollment_rate: body.autoEnrollmentRate,
//         auto_enrollment_rate: body.automaticEnrollmentPercentage,
//         annual_auto_increase: body.annualAutoIncrease,
//         deferral_cap: body.deferralCap,

//         // Matching & Safe Harbor Mapping to Match Output
//         match_category: body.matchCategory,
//         // match_line1: body.matchLine1,
//         // match_line2: body.matchLine2,

//         // Vesting Schedule
//         vesting_schedule: body.vestingSchedule,

//         // Non-Elective / Profit Sharing
//         ps_type: body.profitSharingType,
//         ps_eligibility_title: body.profitSharingEligibilityTitle,
//         ps_eligibility_req:
//           body.profitSharingEligibilityRequirementCustom ||
//           body.profitSharingEligibilityRequirement,
//         ps_entry_title: body.profitSharingEntryTitle,
//         ps_entry_date:
//           body.profitSharingEntryDateCustom || body.profitSharingEntryDate,
//         ps_vesting_title: body.profitSharingVestingTitle,
//         ps_vesting:
//           body.profitSharingVestingCustom || body.profitSharingVesting,
//         ne_eligibility_title: body.nonElectiveTitle,
//         ne_eligibility_req:
//           body.nonElectiveEligibilityRequirementCustom ||
//           body.nonElectiveEligibilityRequirement,
//         ne_entry_title: body.nonElectiveEntryTitle,
//         ne_entry_date:
//           body.nonElectiveEntryDateCustom || body.nonElectiveEntryDate,
//         ne_vesting_title: body.nonElectiveVestingTitle,
//         ne_vesting: body.nonElectiveVestingCustom || body.nonElectiveVesting,

//         // Investment & Operations
//         investments: body.investments,

//         // Contact Form (resources)
//         contact_title_1: body.contact_title_1,
//         contact_name_1: body.contact_name_1,
//         contact_info_1: body.contact_info_1,
//         contact_info_2: body.contact_info_2,
//         contact2_title_1: body.contact2_title_1,
//         contact2_name_1: body.contact2_name_1,
//         contact2_info_1: body.contact2_info_1,
//         contact2_info_2: body.contact2_info_2,
//         contact3_title_1: body.contact3_title_1,
//         contact3_name_1: body.contact3_name_1,
//         contact3_info_1: body.contact3_info_1,
//         contact3_info_2: body.contact3_info_2,

//         // Disclaimer
//         // disclaimer_line1: body.disclaimer_line1,
//         // disclaimer_line2: body.disclaimer_line2,
//         // disclaimer_line3: body.disclaimer_line3,
//         // disclaimer_line4: body.disclaimer_line4,
//         // disclaimer_line5: body.disclaimer_line5,
//         // disclaimer_line6: body.disclaimer_line6,
//         // disclaimer_line7: body.disclaimer_line7,
//         // disclaimer_line8: body.disclaimer_line8,
//         // disclaimer_line9: body.disclaimer_line9,
//         // disclaimer_line10: body.disclaimer_line10,
//         // disclaimer_line11: body.disclaimer_line11,
//         // disclaimer_line12: body.disclaimer_line12,
//         // disclaimer_line13: body.disclaimer_line13,
//         // disclaimer_line14: body.disclaimer_line14,
//         // disclaimer_line15: body.disclaimer_line15,
//         // disclaimer_line16: body.disclaimer_line16,
//         // disclaimer_line17: body.disclaimer_line17,
//         // disclaimer_line18: body.disclaimer_line18,
//         // disclaimer_line19: body.disclaimer_line19,
//         // disclaimer_line20: body.disclaimer_line20,
//         // disclaimer_line21: body.disclaimer_line21,
//         // disclaimer_line22: body.disclaimer_line22,
//         // disclaimer_line23: body.disclaimer_line23,
//         // disclaimer_line24: body.disclaimer_line24,
//         // disclaimer_line25: body.disclaimer_line25,

//         automatic_enrollment_percentage: body.automaticEnrollmentPercentage,
//         automatic_enrollment_wait_period: body.automaticEnrollmentWaitPeriod,
//         automatic_increase_cap: body.automaticIncreaseCap,
//         automatic_increase_percentage: body.automaticIncreasePercentage,
//         record_keeper_name: body.recordKeeperName,
//         record_keeper_phone: body.recordKeeperPhone,
//         record_keeper_website: body.recordKeeperWebsite,
//         match_percent: body?.matchPercentage,
//         vesting_period:
//           body.vestingScheduleRadio !== "default"
//             ? body.vestingScheduleRadio
//             : "Immediate",
//         match_percentage: body.matchPercentage,
//         company_match_amount: body.matchType,
//         non_elective_contribution_percent: body.nonElectivePercentage,
//         profit_sharing_percent: body.profitSharingPercentage,
//         // entry_date: body.entryDates,
//         percentage_limit: body.automaticIncreaseCap,
//         discretionary_or_non_discretionary: body.nonElectiveType,
//         // new
//         video_avatar: body.videoAvatar,
//         bg_image: body.videoBackgroundImage,
//         logo: body.clientLogo,
//         match_type: body.matchType,
//         service_requirement:
//           body.entryDates === "Immediate"
//             ? "Immediate Entry"
//             : body.entryDates === "Custom"
//             ? `${body.customEntryDates} ${body.customEntryDateType}`
//             : body.entryDates === "Advanced"
//             ? `${body.advancedEntryHours} Hours`
//             : body.entryDates === "Full Custom"
//             ? "Custom-defined"
//             : "Unknown",
//         // age_requirement: body.ageRequirement,

//         record_keeper_site: body.recordKeeperWebsite,
//         contact_name: body.contactName,
//         contact_email: body.email,
//         contact_phone: body.phoneNumber,
//       },
//     };

//     if (body.safeHarborMatchType === "Basic Safe Harbor") {
//       payload.templateData.match_line1 =
//         "100% match on the first 3% of deferred compensation";
//       payload.templateData.match_line2 =
//         "plus a 50% match on deferrals between 3% and 5% (4% total)";
//     }

//     if (body.safeHarborMatchType === "Enhanced Safe Harbor") {
//       payload.templateData.match_line1 =
//         "100% match on the first 4% of deferred compensation";
//       payload.templateData.match_line2 =
//         "Employer may provide additional contributions";
//     }

//     if (body.safeHarborMatchType === "Non-Elective Safe Harbor") {
//       payload.templateData.match_line1 =
//         "Employer contributes at least 3% to all eligible employees";
//       payload.templateData.match_line2 = "Regardless of employee contributions";
//     }

//     if (body.safeHarborMatchType === "QACA Safe Harbor") {
//       payload.templateData.match_line1 =
//         "100% match on the first 1% of compensation";
//       payload.templateData.match_line2 =
//         "Then 50% on deferrals above 1% up to 6%";
//     }

//     if (body.disclaimer) {
//       for (let i = 0; i < 25; i++) {
//         payload.templateData[`disclaimer_line${i + 1}`] = (body as any)[
//           `disclaimer_line${i + 1}`
//         ];
//       }
//     }

//     

//     const synthesiaApiKey = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;
//     const synthesiaResponse = await axios.post(
//       "https://api.synthesia.io/v2/videos/fromTemplate",
//       payload,
//       {
//         headers: {
//           Authorization: synthesiaApiKey,
//           "Content-Type": "application/json",
//         },
//       },
//     );
//     
//     const videoData = synthesiaResponse.data;

//     // const result = await prisma.$transaction(async (prisma) => {
//     // });
//     const key = "planCurrentIndex";
//     const setting = await prisma.setting.findFirst({
//       where: {
//         key: key,
//       },
//     });

//     const newIndex = +(setting?.value || 0) + 1;

//     await prisma.setting.upsert({
//       where: {
//         key: key,
//       },
//       create: {
//         key: key,
//         value: `${newIndex}`,
//       },
//       update: {
//         value: `${newIndex}`,
//       },
//     });

//     const user = await prisma.user.findFirst({
//       where: {
//         email: session?.user?.email || "",
//       },
//     });

//     if (!user) {
//       throw new Error("User not found");
//     }

//     const plan = await prisma.plan.create({
//       data: {
//         userId: user.id,
//         idIndex: newIndex,

//         rawData: body as any,

//         clientName: body?.clientName,
//         clientLogo: body?.clientLogo as string,
//         videoThemeColor: body?.videoThemeColor,
//         videoAvatar: body?.videoAvatar,
//         videoBackgroundMusic: body?.videoBackgroundMusic,
//         videoBackgroundImage: body?.videoBackgroundImage as string,
//         buildSpanishVideo: body?.buildSpanishVideo,

//         useCustomText: body?.useCustomText,
//         advancedDeferrals: body?.advancedDeferrals,
//         advancedEntryDates: body?.advancedEntryDates,
//         advancedEntryDatesValue: body?.advancedEntryDatesValue,
//         advancedInvestments: body?.advancedInvestments,
//         ageRequirement: body?.ageRequirement,
//         automaticEnrollment: body?.automaticEnrollment,
//         automaticEnrollmentPercentage: body?.automaticEnrollmentPercentage,
//         automaticEnrollmentWaitPeriod: body?.automaticEnrollmentWaitPeriod,
//         automaticIncrease: body?.automaticIncrease,
//         automaticIncreaseCap: body?.automaticIncreaseCap,
//         automaticIncreasePercentage: body?.automaticIncreasePercentage,
//         customEntryDates: body?.customEntryDates,
//         customEntryDatesValue: body?.customEntryDatesValue,
//         customEntryDateType: body?.customEntryDateType,
//         customText: body?.customText,
//         deferrals: body?.deferrals,
//         employerContribution: body?.employerContribution,
//         employerProfitSharingContributions:
//           body?.employerProfitSharingContributions,
//         entryDates: body?.entryDates,
//         investments: body?.investments,
//         mandatoryContribution: parseFloat(body?.mandatoryContribution || "0"),
//         matchPercentage: body?.matchPercentage,
//         matchPlan: body?.matchPlan,
//         matchSafe: body?.matchSafe,
//         matchType: body?.matchType,
//         nonElective: body?.nonElective,
//         nonElectiveEmployerContributions:
//           body?.nonElectiveEmployerContributions,
//         nonElectivePercentage: body?.nonElectivePercentage,
//         nonElectiveType: body?.nonElectiveType,
//         planType: body?.planType,
//         profitSharingCustomText: body?.profitSharingCustomText,
//         profitSharingPercentage: body?.profitSharingPercentage,
//         profitSharingType: body?.profitSharingType,
//         safeHarborMatch: body?.safeHarborMatch,
//         safeHarborMatchType: body?.safeHarborMatchType,
//         useProfitSharingCustomText: body?.useProfitSharingCustomText,
//         vestingScheduleRadio: body?.vestingScheduleRadio,
//         vestingSchedules: body?.vestingSchedules,
//         waitingPeriod: body?.waitingPeriod,
//         waitingPeriodDuration: body?.waitingPeriodDuration,
//         waitingPeriodStart: body?.waitingPeriodStart,
//         waitingPeriodStartDate: body?.waitingPeriodStartDate,

//         // resource
//         recordKeeperId: body?.recordKeeperId,
//         recordkeeper: body?.recordkeeper,
//         companyName: body?.companyName,
//         addressCode: body?.addressCode,
//         companyContact: body?.companyContact,
//         contactName: body?.contactName,
//         displayAdvisorInfoHeader: body?.displayAdvisorInfoHeader,
//         educationalVideos: body?.educationalVideos,
//         email: body?.email,
//         isDisplayRecodeKeeper: body?.isDisplayRecodeKeeper,
//         onlineEnrollment: body?.onlineEnrollment,
//         phoneNumber: body?.phoneNumber,
//         planAdvisor: body?.planAdvisor,
//         planDocumentsLinks: body?.planDocumentsLinks,
//         providerLogo: body?.providerLogo,
//         providerName: body?.providerName,
//         providerPhoneNumber: body?.providerPhoneNumber,
//         title: body?.title,
//         tpa: body?.tpa,
//         tpaEmail: body?.tpaEmail,
//         tpaName: body?.tpaName,
//         tpaPhoneNumber: body?.tpaPhoneNumber,
//         website: body?.website,
//       },
//     });

//     const newVideo = await prisma.video.create({
//       data: {
//         planId: new ObjectId(plan.id) as any,
//         title: videoData.title,
//         description: videoData.description,
//         videoProvider: "synthesia",
//         videoProviderId: videoData.id,
//         videoStatus: "in_progress",
//         data: videoData.data || null,
//       },
//     });

//     const result = { ...plan, video: newVideo };

//     sendEmail({
//       to: user.email,
//       subject:
//         "Your PlanTelligence Benefits Portal and related content are generating",
//       html: mailTemplate,
//     });

//     return NextResponse.json({
//       message: "Plan saved successfully",
//       data: result,
//     });
//   } catch (error) {
//     
//     return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
//   }
// }
