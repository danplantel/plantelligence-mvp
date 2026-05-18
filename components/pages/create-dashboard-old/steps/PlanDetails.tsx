"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icons } from "@/components/icons";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import type { InfoTypes } from "@/types/InfoTypes";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordKeepers } from "@/constants/data";

interface PlanDetailsProps {
  updateInfo: (info: Partial<InfoTypes>) => void;
  info: Partial<InfoTypes>;
  onComplete: () => void;
}

// Plan Type Selection Component (formerly in PlanTypeSelection.tsx)
const PlanTypeSelectionTab = ({
  updateInfo,
  info,
  onComplete,
}: {
  updateInfo: (info: Partial<InfoTypes>) => void;
  info: Partial<InfoTypes>;
  onComplete: () => void;
}) => {
  const [selectedPlanType, setSelectedPlanType] = useState<string>(
    info.planType || "401k",
  );

  const handlePlanTypeSelect = (planType: string) => {
    setSelectedPlanType(planType);
  };

  const handleSubmit = () => {
    updateInfo({ planType: selectedPlanType });
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Select Plan Type</h3>
        <p className="text-sm text-muted-foreground">
          Choose the type of retirement plan you want to create.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["401k", "403b", "401a", "Simple IRA", "457"].map((planType) => (
          <Button
            key={planType}
            variant={selectedPlanType === planType ? "default" : "outline"}
            className={`h-auto justify-start p-4 rounded-md ${
              planType !== "401k"
                ? "cursor-not-allowed opacity-50"
                : selectedPlanType === planType
                ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                : ""
            }`}
            onClick={() =>
              planType === "401k" && handlePlanTypeSelect(planType)
            }
            disabled={planType !== "401k"}
          >
            <div className="flex flex-col items-start text-left">
              <div className="font-medium">{planType}</div>
              <div className="text-sm text-muted-foreground">
                {planType === "401k"
                  ? "Standard retirement plan for private employers"
                  : "Currently not available"}
              </div>
            </div>
          </Button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit}>Continue</Button>
      </div>
    </div>
  );
};

// Plan Details Component (formerly in PlanDetails.tsx)
const PlanDetailsTab = ({
  setActiveTab,
  info,
  updateInfo,
}: {
  setActiveTab: (tab: string) => void;
  info: Partial<InfoTypes>;
  updateInfo: (info: Partial<InfoTypes>) => void;
}) => {
  const defaultValues: InfoTypes = {
    // match: "",
    planType: info?.planType || "401k",
    matchPlan: info?.matchPlan || "No",
    matchSafe: info?.matchSafe || "No",
    nonElective: info?.nonElective || "No",
    entryDates: info?.entryDates || "Immediate",
    showAdvancedInvestment: info?.showAdvancedInvestment || true,
    showAdvancedDeferrals: info?.showAdvancedDeferrals || true,
    showAdvancedChildDeferrals: info?.showAdvancedChildDeferrals || true,
    advancedEntryDates: info?.advancedEntryDates || [],
    advancedDeferrals: info?.advancedDeferrals || [],
    investments: info?.investments || [],
    deferrals: info?.deferrals || [
      "Traditional Deferrals",
      "Plan Deferral Limits",
    ],
    advancedInvestments: info?.advancedInvestments || [],
    vestingScheduleRadio: info?.vestingScheduleRadio || "default",
    vestingSchedules: info?.vestingSchedules || [],
    employerContribution: info?.employerContribution || "1",
    automaticEnrollment: info?.automaticEnrollment || false,
    automaticIncrease: info?.automaticIncrease || false,
    customEntryDates: info?.customEntryDates || "No Wait",
    customEntryDateType: info?.customEntryDateType || "days",
    customEntryDatesValue: info?.customEntryDatesValue || "Next Payroll",
    fullCustomEntryDates: info?.fullCustomEntryDates || "",
    advancedEntryHours: info?.advancedEntryHours || "1000",
    matchType: info?.matchType || "Dollar for Dollar Match",
    matchPercentage: info?.matchPercentage || 0.5,
    customMatchDescription: info?.customMatchDescription || "",
    safeHarborMatch: info?.safeHarborMatch || "Safe Harbor Match",
    safeHarborMatchType: info?.safeHarborMatchType || "",
    nonElectiveEmployerContributions:
      info?.nonElectiveEmployerContributions || false,
    employerProfitSharingContributions:
      info?.employerProfitSharingContributions || false,
    waitingPeriod: info?.waitingPeriod || false,
    automaticEnrollmentPercentage: info?.automaticEnrollmentPercentage || "1%",
    automaticEnrollmentWaitPeriod:
      info?.automaticEnrollmentWaitPeriod || "months",
    automaticIncreasePercentage: info?.automaticIncreasePercentage || "0.5%",
    automaticIncreaseCap: info?.automaticIncreaseCap || "No Cap",
    advancedEntryDatesValue: info?.advancedEntryDatesValue || "Next Payroll",
    waitingPeriodDuration: info?.waitingPeriodDuration || "1,000 hours",
    waitingPeriodStart: info?.waitingPeriodStart || "Immediate",
    waitingPeriodStartDate: info?.waitingPeriodStartDate || "Next Payroll",
    nonElectiveType: info?.nonElectiveType || "Discretionary",
    nonElectivePercentage: info?.nonElectivePercentage || "1%",
    profitSharingType: info?.profitSharingType || "Discretionary",
    profitSharingPercentage: info?.profitSharingPercentage || "1%",
    useCustomText: info?.useCustomText || false,
    customText: info?.customText || "",
    useProfitSharingCustomText: info?.useProfitSharingCustomText || false,
    profitSharingCustomText: info?.profitSharingCustomText || "",

    profitSharingEligibilityTitle: info?.profitSharingEligibilityTitle || "",
    profitSharingEligibilityRequirement:
      info?.profitSharingEligibilityRequirement || "",
    profitSharingEligibilityRequirementCustom:
      info?.profitSharingEligibilityRequirementCustom || "",
    profitSharingEntryTitle: info?.profitSharingEntryTitle || "",
    profitSharingEntryDate: info?.profitSharingEntryDate || "",
    profitSharingEntryDateCustom: info?.profitSharingEntryDateCustom || "",
    profitSharingVestingTitle: info?.profitSharingVestingTitle || "",
    profitSharingVesting: info?.profitSharingVesting || "",
    profitSharingVestingCustom: info?.profitSharingVestingCustom || "",
    nonElectiveTitle: info?.nonElectiveTitle || "",
    nonElectiveEligibilityRequirement:
      info?.nonElectiveEligibilityRequirement || "",
    nonElectiveEligibilityRequirementCustom:
      info?.nonElectiveEligibilityRequirementCustom || "",
    nonElectiveEntryTitle: info?.nonElectiveEntryTitle || "",
    nonElectiveEntryDate: info?.nonElectiveEntryDate || "",
    nonElectiveEntryDateCustom: info?.nonElectiveEntryDateCustom || "",
    nonElectiveVestingTitle: info?.nonElectiveVestingTitle || "",
    nonElectiveVesting: info?.nonElectiveVesting || "",
    nonElectiveVestingCustom: info?.nonElectiveVestingCustom || "",
  };

  const form = useForm<InfoTypes>({
    defaultValues,
    mode: "onChange",
  });

  const { handleSubmit, control, watch, setValue } = form;
  const planType = watch("planType");
  const entryDates = watch("entryDates");
  const matchPlan = watch("matchPlan");
  const matchSafe = watch("matchSafe");
  const customMatchDescription = watch("customMatchDescription");
  const nonElective = watch("nonElective");
  const deferrals = watch("deferrals") || [];
  const investments = watch("investments") || [];
  const advancedInvestments = watch("advancedInvestments") || [];
  const advancedEntryDates = watch("advancedEntryDates") || [];
  const advancedDeferrals = watch("advancedDeferrals") || [];
  const showAdvancedDeferrals = watch("showAdvancedDeferrals");
  const showAdvancedInvestment = watch("showAdvancedInvestment");
  const showAdvancedChildDeferrals = watch("showAdvancedChildDeferrals");
  const vestingScheduleRadio = watch("vestingScheduleRadio");
  const vestingSchedules = watch("vestingSchedules") || [];
  const employerContribution = watch("employerContribution");
  const automaticEnrollment = watch("automaticEnrollment");
  const automaticIncrease = watch("automaticIncrease");
  const customEntryDates = watch("customEntryDates");
  const customEntryDateType = watch("customEntryDateType");
  const customEntryDatesValue = watch("customEntryDatesValue");
  const advancedEntryDatesValue = watch("advancedEntryDatesValue");
  const [mandatoryContribution, setMandatoryContribution] = useState<
    number | null
  >(null);
  const [ageRequirement, setAgeRequirement] = useState("16");

  const isSimpleIRA = planType === "Simple IRA";

  const shimanoTemplateId = "7d581314-69fc-4470-ae97-8691c13fe768"; // Shimano/generic (same ID) template ID
  const genericTemplateId = "7d581314-69fc-4470-ae97-8691c13fe768"; // Generic template ID

  useEffect(() => {
    (Object.keys(defaultValues) as (keyof typeof defaultValues)[]).forEach(
      (key) => {
        setValue(key, info?.[key] || defaultValues[key]);
      },
    );
  }, [info, setValue]);

  const selectedRecordKeeper = recordKeepers.find(
    (keeper) => keeper.id === info.recordKeeperId,
  );

  const getEntryDateData = (data: InfoTypes, ageRequirement: string) => {
    const {
      entryDates,
      customEntryDates,
      customEntryDateType,
      customEntryDatesValue,
      advancedEntryHours,
      advancedEntryDatesValue,
      fullCustomEntryDates,
    } = data;

    const hasAgeRequirement =
      entryDates === "Immediate" ||
      entryDates === "Custom" ||
      entryDates === "Advanced"
        ? data.advancedEntryDates?.includes("Add Age Requirement")
        : false;

    return {
      ageRequirement: hasAgeRequirement
        ? `${ageRequirement} and older`
        : "None",
      serviceRequirement:
        entryDates === "Immediate"
          ? "Immediate Entry"
          : entryDates === "Custom"
          ? `${customEntryDates} ${customEntryDateType}`
          : entryDates === "Advanced"
          ? `${advancedEntryHours} Hours`
          : entryDates === "Full Custom"
          ? "Custom-defined"
          : "Unknown",
      entryDate:
        entryDates === "Immediate"
          ? "Immediate"
          : entryDates === "Custom"
          ? customEntryDatesValue
          : entryDates === "Advanced"
          ? advancedEntryDatesValue
          : entryDates === "Full Custom"
          ? fullCustomEntryDates
          : "Unknown",
    };
  };

  const navigateToResources = (data: InfoTypes) => {
    const entryDateData = getEntryDateData(data, ageRequirement);
    const synthesiaParams = {
      logo: data.clientLogo || "",
      bg_image: data.videoBackgroundImage || "",
      video_avatar: data.videoAvatar || "",
      age_requirement: entryDateData.ageRequirement,
      service_requirement: entryDateData.serviceRequirement,
      entry_date: entryDateData.entryDate,
      match_type: data.matchType,
      match_percentage: data.matchPercentage,
      custom_match_description: data.customMatchDescription,
      discretionary_or_non_discretionary: data.nonElectiveType,
      non_elective_contribution_percent: data.nonElectivePercentage,
      profit_sharing_percent: data.profitSharingPercentage,
      percentage_limit: data.automaticIncreaseCap,
      vesting_period:
        data.vestingScheduleRadio !== "default"
          ? data.vestingScheduleRadio
          : "Immediate",
      record_keeper_name: selectedRecordKeeper?.name || "",
      record_keeper_phone: selectedRecordKeeper?.phone || "",
      record_keeper_website: selectedRecordKeeper?.website || "",
    };
    updateInfo({
      ...data,
    });
    setActiveTab("resources");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(navigateToResources)}
        className="w-full space-y-4"
      >
        <FormField
          control={control}
          name="planType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan Type</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {["401k", "403b", "401a", "Simple IRA", "457"].map(
                    (item, index) => (
                      <Button
                        className={`inline-flex gap-[4px] ${
                          field.value === item
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        } ${
                          item !== "401k" ? "cursor-not-allowed opacity-50" : ""
                        }`}
                        key={index}
                        type="button"
                        onClick={() => {
                          if (item === "401k") {
                            setValue("planType", item);
                          }
                        }}
                        disabled={item !== "401k"}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            field.value === item
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                          }`}
                        />
                        <span
                          className={`${
                            field.value === item
                              ? "text-black"
                              : "text-gray-600"
                          }`}
                        >
                          {item}
                        </span>
                      </Button>
                    ),
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={control}
          name="entryDates"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entry Dates</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {["Immediate", "Custom", "Advanced", "Full Custom"].map(
                    (item, index) => (
                      <Button
                        className={`inline-flex gap-[4px]  ${
                          field.value === item
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        }`}
                        key={index}
                        type="button"
                        onClick={() => setValue("entryDates", item)}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            field.value === item
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                          }`}
                        />
                        <span
                          className={`${
                            field.value === item ? "text-black" : "text-black"
                          }`}
                        >
                          {item}
                        </span>
                      </Button>
                    ),
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {entryDates === "Custom" && (
          <div>
            <FormField
              control={control}
              name="customEntryDates"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <label className="text-sm truncate">
                      Employees who&apos;ve completed
                    </label>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        setValue("customEntryDates", value);
                        if (value === "1,000 hours") {
                          setValue("customEntryDateType", "hours"); // Automatically set to "hours"
                        } else {
                          setValue("customEntryDateType", ""); // Clear the type for other cases
                        }
                      }}
                    >
                      <SelectTrigger className="w-auto">
                        <SelectValue placeholder="No Wait" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="No Wait">No Wait</SelectItem>
                        <SelectItem value="1,000 hours">1,000 hours</SelectItem>
                        {Array.from({ length: 14 }, (_, i) => (
                          <SelectItem key={i} value={`${i + 1}`}>
                            {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value !== "No Wait" &&
                      field.value !== "1,000 hours" && ( // Exclude "1,000 hours"
                        <Select
                          value={customEntryDateType}
                          onValueChange={(value) =>
                            setValue("customEntryDateType", value)
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            <SelectItem value="days">days</SelectItem>
                            <SelectItem value="months">months</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    <label className="text-sm truncate">
                      {field.value === "1"
                        ? customEntryDateType === "days"
                          ? "day"
                          : customEntryDateType === "months"
                          ? "month"
                          : "hours"
                        : customEntryDateType === "days"
                        ? "days"
                        : customEntryDateType === "months"
                        ? "months"
                        : "hours"}{" "}
                      of service are eligible to enter the plan at the start of
                      the
                    </label>
                    <FormControl>
                      <Select
                        value={customEntryDatesValue}
                        onValueChange={(value) => {
                          setValue("customEntryDatesValue", value);
                        }}
                      >
                        <SelectTrigger className="w-auto">
                          <SelectValue placeholder="Next Payroll" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="Next Payroll">
                            Next Payroll
                          </SelectItem>
                          <SelectItem value="Next Month">Next Month</SelectItem>
                          <SelectItem value="Next Quarter">
                            Next Quarter
                          </SelectItem>
                          <SelectItem value="Next Semi Annual Entry Date">
                            Next Semi Annual Date
                          </SelectItem>
                          <SelectItem value="Next Annual Entry Date">
                            Next Annual Date
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        {entryDates === "Advanced" && (
          <div>
            <FormField
              control={control}
              name="advancedEntryHours"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">
                      Employees who&apos;ve completed
                    </label>
                    <Select
                      value={field.value}
                      onValueChange={(value) =>
                        setValue("advancedEntryHours", value)
                      }
                    >
                      <SelectTrigger className="w-auto">
                        <SelectValue placeholder="1000" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {Array.from({ length: 14 }, (_, i) => (
                          <SelectItem key={i} value={`${1000 - i * 50}`}>
                            {1000 - i * 50}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="text-sm">
                      hours of service are eligible to enter the plan at the
                      start of the
                    </label>
                    <FormControl>
                      <Select
                        value={advancedEntryDatesValue}
                        onValueChange={(value) => {
                          setValue("advancedEntryDatesValue", value);
                        }}
                      >
                        <SelectTrigger className="w-auto">
                          <SelectValue placeholder="Next Payroll" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="Next Payroll">
                            Next Payroll
                          </SelectItem>
                          <SelectItem value="Next Month">Next Month</SelectItem>
                          <SelectItem value="Next Quarter">
                            Next Quarter
                          </SelectItem>
                          <SelectItem value="Next Semi Annual Entry Date">
                            Next Semi Annual Date
                          </SelectItem>
                          <SelectItem value="Next Annual Entry Date">
                            Next Annual Date
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {entryDates === "Full Custom" && (
          <FormField
            control={control}
            name="fullCustomEntryDates"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Custom Entry Dates</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    {...field}
                    placeholder="Enter your entry date structure"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div
          className="flex items-center gap-[4px] !mb-[16px] cursor-pointer"
          onClick={() =>
            setValue("showAdvancedDeferrals", !showAdvancedDeferrals)
          }
        >
          <p className="text-[12px]">Advanced</p>
          {!showAdvancedDeferrals ? (
            <Icons.arrowDown className="rotate-180 mt-[2px] w-4 h-4" />
          ) : (
            <Icons.arrowDown className="mt-[2px] w-4 h-4" />
          )}
        </div>

        {showAdvancedDeferrals && (
          <div className="flex flex-wrap flex-col gap-[10px] text-sm">
            {["Add Age Requirement", "Add 1,000 Hour Requirement"].map(
              (item, index) => (
                <div
                  key={index}
                  className="inline-flex gap-[10px] items-center"
                >
                  <Checkbox
                    onCheckedChange={(checked: boolean) => {
                      let newAdvancedEntryDates: string[] = [];
                      if (checked) {
                        newAdvancedEntryDates = [...advancedEntryDates, item];
                      } else {
                        newAdvancedEntryDates = advancedEntryDates.filter(
                          (deferral) => deferral !== item,
                        );
                      }
                      setValue("advancedEntryDates", newAdvancedEntryDates);
                    }}
                    checked={advancedEntryDates.includes(item)}
                  />
                  <span>{item}</span>
                  {item === "Add Age Requirement" &&
                    advancedEntryDates.includes(item) && (
                      <Select
                        onValueChange={(value) =>
                          setValue("ageRequirement", value)
                        }
                        value={watch("ageRequirement") || ""}
                      >
                        <SelectTrigger className="w-auto">
                          <SelectValue placeholder="Select age" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-auto">
                          {[...Array(11)].map((_, i) => {
                            const age = 16 + i * 0.5;
                            return (
                              <SelectItem key={i} value={age.toString()}>
                                {`${age} and older`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                </div>
              ),
            )}
          </div>
        )}

        <Separator className="!mt-[4px]" />

        <FormField
          control={control}
          name="deferrals"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deferrals</FormLabel>
              <FormControl>
                <div>
                  <div className="flex flex-wrap flex-col gap-[10px] text-sm">
                    {[
                      "Traditional Deferrals",
                      "Plan Deferral Limits",
                      "Automatic Enrollment",
                      "Automatic Increase",
                      "After Tax Roth Contributions",
                    ].map((item: string, index) => (
                      <div
                        key={index}
                        className={`inline-flex gap-[10px] items-center ${
                          item === "Traditional Deferrals" ||
                          item === "Plan Deferral Limits"
                            ? "cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <Checkbox
                          onCheckedChange={(checked: boolean) => {
                            let newDeferrals: string[] = field.value || [];

                            if (
                              item !== "Traditional Deferrals" &&
                              item !== "Plan Deferral Limits"
                            ) {
                              if (checked) {
                                newDeferrals = [...newDeferrals, item];
                              } else {
                                newDeferrals = newDeferrals.filter(
                                  (deferral: string) => deferral !== item,
                                );
                              }
                              setValue("deferrals", newDeferrals);
                            }

                            if (item === "Automatic Enrollment") {
                              setValue("automaticEnrollment", checked);
                            }
                            if (item === "Automatic Increase") {
                              setValue("automaticIncrease", checked);
                            }
                          }}
                          checked={
                            item === "Traditional Deferrals" ||
                            item === "Plan Deferral Limits" ||
                            field.value?.includes(item)
                          }
                          disabled={
                            item === "Traditional Deferrals" ||
                            item === "Plan Deferral Limits"
                          }
                        />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  {automaticEnrollment && (
                    <div className="mt-[16px] flex items-center gap-[10px]">
                      <p className="text-sm">
                        Employees are enrolled in the plan at
                      </p>
                      <div className="flex items-center">
                        <Select
                          value={String(watch("automaticEnrollmentPercentage"))}
                          onValueChange={(value) =>
                            setValue("automaticEnrollmentPercentage", value)
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="1%" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {[...Array(15)].map((_, i) => (
                              <SelectItem key={i} value={`${i * 0.5 + 1}%`}>
                                {i * 0.5 + 1}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm">after a waiting period of</p>
                      <div className="flex items-center gap-[10px]">
                        <Input type="number" className="w-20" placeholder="0" />
                        <Select
                          value={String(watch("automaticEnrollmentWaitPeriod"))}
                          onValueChange={(value) =>
                            setValue("automaticEnrollmentWaitPeriod", value)
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="months" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            <SelectItem value="months">months</SelectItem>
                            <SelectItem value="days">days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {automaticIncrease && (
                    <div className="mt-[16px] flex items-center">
                      <p className="text-sm mr-[10px]">
                        Contributions will be increased
                      </p>
                      <div className="flex items-center gap-[10px]">
                        <Select
                          value={watch("automaticIncreasePercentage")}
                          onValueChange={(value) =>
                            setValue("automaticIncreasePercentage", value)
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="0.5%" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {[...Array(10)].map((_, i) => (
                              <SelectItem key={i} value={`${i * 0.5 + 0.5}%`}>
                                {i * 0.5 + 0.5}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm">
                          per year until you reach the deferral percentage of
                        </p>
                        <Select
                          value={watch("automaticIncreaseCap")}
                          onValueChange={(value) =>
                            setValue("automaticIncreaseCap", value)
                          }
                        >
                          <SelectTrigger className="w-auto">
                            <SelectValue placeholder="No Cap" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            <SelectItem value="No Cap">No Cap</SelectItem>
                            {[...Array(20)].map((_, i) => (
                              <SelectItem key={i} value={`${i * 0.5 + 1}%`}>
                                {i * 0.5 + 1}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <div
                    className="flex items-center gap-[4px] mt-[16px] mb-[4px] cursor-pointer"
                    onClick={() =>
                      setValue(
                        "showAdvancedChildDeferrals",
                        !showAdvancedChildDeferrals,
                      )
                    }
                  >
                    <p className="text-[12px]">Advanced</p>
                    {!showAdvancedChildDeferrals ? (
                      <Icons.arrowDown className="rotate-180 mt-[2px] w-4 h-4" />
                    ) : (
                      <Icons.arrowDown className="mt-[2px] w-4 h-4" />
                    )}
                  </div>
                  {showAdvancedChildDeferrals && (
                    <div className="flex flex-wrap flex-col gap-[10px] text-sm">
                      {[
                        "Mandatory Contributions (at custom %)",
                        "Auto enrollment contribution defaults as Roth",
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="inline-flex gap-[10px] items-center"
                        >
                          <Checkbox
                            onCheckedChange={(checked: boolean) => {
                              let newAdvancedDeferrals: string[] = [];
                              if (checked) {
                                newAdvancedDeferrals = [
                                  ...advancedDeferrals,
                                  item,
                                ];
                              } else {
                                newAdvancedDeferrals = advancedDeferrals.filter(
                                  (investment: string) => investment !== item,
                                );
                              }
                              setValue(
                                "advancedDeferrals",
                                newAdvancedDeferrals,
                              );
                            }}
                            checked={advancedDeferrals.includes(item)}
                          />
                          <span>{item}</span>
                          {item === "Mandatory Contributions (at custom %)" &&
                            advancedDeferrals.includes(item) && (
                              <Input
                                type="number"
                                className="w-20"
                                placeholder="0.5%"
                                value={mandatoryContribution || ""}
                                onChange={(e) =>
                                  setMandatoryContribution(
                                    Number(e.target.value),
                                  )
                                }
                                min="0"
                                max="100"
                                step="0.1"
                              />
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isSimpleIRA && <Separator />}

        {isSimpleIRA && (
          <>
            <Separator />
            <FormField
              control={control}
              name="nonElective"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employer Contributions</FormLabel>
                  <FormControl>
                    <RadioGroup
                      defaultValue="1"
                      className="flex flex-col gap-[10px]"
                      onValueChange={(value: string) => {
                        setValue("employerContribution", value);
                      }}
                      value={employerContribution}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1" id="r1" />
                        <Label
                          htmlFor="r1"
                          className="inline-flex items-center gap-[4px]"
                        >
                          100% match on the first{" "}
                          <Input
                            disabled
                            defaultValue={"3%"}
                            className="w-[60px]"
                          />{" "}
                          of deferred compensation
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="2" id="r2" />
                        <Label htmlFor="r2">2% Non-Elective</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
          </>
        )}
        <div className="space-y-[8px]">
          <div>
            <FormLabel>Non-Elective / Profit Sharing</FormLabel>
            <Select
              value={watch("profitSharingType")}
              onValueChange={(value) => setValue("profitSharingType", value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Discretionary" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Discretionary">Discretionary</SelectItem>
                <SelectItem value="Non-Discretionary">
                  Non-Discretionary
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* <div>
            <div className="mt-[10px]">
              <span className="ml-2">Profit Sharing Eligibility Title</span>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("profitSharingEligibilityTitle")}
                onChange={(e) => setValue("profitSharingEligibilityTitle", e.target.value)}
              />
            </div>
          </div> */}
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Eligibility Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Profit Sharing Eligibility Title)"
              className="mt-[10px]"
              value={watch("profitSharingEligibilityTitle")}
              onChange={(e) =>
                setValue("profitSharingEligibilityTitle", e.target.value)
              }
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Eligibility Requirement
            </FormLabel>
            <Select
              value={watch("profitSharingEligibilityRequirement")}
              onValueChange={(value) =>
                setValue("profitSharingEligibilityRequirement", value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="1,000 hours">1,000 hours</SelectItem>
                <SelectItem value="X months/days of employment">
                  X months/days of employment
                </SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {watch("profitSharingEligibilityRequirement") === "Custom" && (
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("profitSharingEligibilityRequirementCustom")}
                onChange={(e) =>
                  setValue(
                    "profitSharingEligibilityRequirementCustom",
                    e.target.value,
                  )
                }
              />
            )}
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Entry Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Profit Sharing Entry Title)"
              className="mt-[10px]"
              value={watch("profitSharingEntryTitle")}
              onChange={(e) =>
                setValue("profitSharingEntryTitle", e.target.value)
              }
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Entry Date
            </FormLabel>
            <Select
              value={watch("profitSharingEntryDate")}
              onValueChange={(value) =>
                setValue("profitSharingEntryDate", value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Start of next payroll">
                  Start of next payroll
                </SelectItem>
                <SelectItem value="Next month">Next month</SelectItem>
                <SelectItem value="Next quarter">Next quarter</SelectItem>
                <SelectItem value="Next semi-annual entry date">
                  Next semi-annual entry date
                </SelectItem>
                <SelectItem value="Next annual entry date">
                  Next annual entry date
                </SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("profitSharingEntryDate") === "Custom" && (
            <div>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("profitSharingEntryDateCustom")}
                onChange={(e) =>
                  setValue("profitSharingEntryDateCustom", e.target.value)
                }
              />
            </div>
          )}
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Vesting Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Profit Sharing Vesting Title)"
              className="mt-[10px]"
              value={watch("profitSharingVestingTitle")}
              onChange={(e) =>
                setValue("profitSharingVestingTitle", e.target.value)
              }
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Profit Sharing Vesting
            </FormLabel>
            <Select
              value={watch("profitSharingVesting")}
              onValueChange={(value) => setValue("profitSharingVesting", value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="3-Year Cliff">3-Year Cliff</SelectItem>
                <SelectItem value="Next quarter">Next quarter</SelectItem>
                <SelectItem value="6-Year Graded">6-Year Graded</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("profitSharingVesting") === "Custom" && (
            <div>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("profitSharingVestingCustom")}
                onChange={(e) =>
                  setValue("profitSharingVestingCustom", e.target.value)
                }
              />
            </div>
          )}

          <div className="">
            <FormLabel className="text-sm mr-2">
              Non-Elective Eligibility Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Non-Elective Eligibility Title)"
              className="mt-[10px]"
              value={watch("nonElectiveTitle")}
              onChange={(e) => setValue("nonElectiveTitle", e.target.value)}
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Non-Elective Eligibility Requirement
            </FormLabel>
            <Select
              value={watch("nonElectiveEligibilityRequirement")}
              onValueChange={(value) =>
                setValue("nonElectiveEligibilityRequirement", value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="1,000 hours">1,000 hours</SelectItem>
                <SelectItem value="X months/days of employment">
                  X months/days of employment
                </SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("nonElectiveEligibilityRequirement") === "Custom" && (
            <div>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("nonElectiveEligibilityRequirementCustom")}
                onChange={(e) =>
                  setValue(
                    "nonElectiveEligibilityRequirementCustom",
                    e.target.value,
                  )
                }
              />
            </div>
          )}
          <div className="">
            <FormLabel className="text-sm mr-2">
              Non-Elective Entry Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Non-Elective Entry Title)"
              className="mt-[10px]"
              value={watch("nonElectiveEntryTitle")}
              onChange={(e) =>
                setValue("nonElectiveEntryTitle", e.target.value)
              }
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">
              Non-Elective Entry Date
            </FormLabel>
            <Select
              value={watch("nonElectiveEntryDate")}
              onValueChange={(value) => setValue("nonElectiveEntryDate", value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Start of next payroll">
                  Start of next payroll
                </SelectItem>
                <SelectItem value="Next month">Next month</SelectItem>
                <SelectItem value="Next quarter">Next quarter</SelectItem>
                <SelectItem value="Next semi-annual entry date">
                  Next semi-annual entry date
                </SelectItem>
                <SelectItem value="Next annual entry date">
                  Next annual entry date
                </SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("nonElectiveEntryDate") === "Custom" && (
            <div>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("nonElectiveEntryDateCustom")}
                onChange={(e) =>
                  setValue("nonElectiveEntryDateCustom", e.target.value)
                }
              />
            </div>
          )}
          <div className="">
            <FormLabel className="text-sm mr-2">
              Non-Elective Vesting Title
            </FormLabel>
            <Input
              type="text"
              placeholder="(enter Non-Elective Vesting Title)"
              className="mt-[10px]"
              value={watch("nonElectiveVestingTitle")}
              onChange={(e) =>
                setValue("nonElectiveVestingTitle", e.target.value)
              }
            />
          </div>
          <div className="">
            <FormLabel className="text-sm mr-2">Non-Elective Vesting</FormLabel>
            <Select
              value={watch("nonElectiveVesting")}
              onValueChange={(value) => setValue("nonElectiveVesting", value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="3-Year Cliff">3-Year Cliff</SelectItem>
                <SelectItem value="Next quarter">Next quarter</SelectItem>
                <SelectItem value="6-Year Graded">6-Year Graded</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {watch("nonElectiveVesting") === "Custom" && (
            <div>
              <Input
                type="text"
                placeholder="(enter your custom non elective contribution structure)"
                className="mt-[10px]"
                value={watch("nonElectiveVestingCustom")}
                onChange={(e) =>
                  setValue("nonElectiveVestingCustom", e.target.value)
                }
              />
            </div>
          )}
        </div>
        <Separator />
        <FormField
          control={control}
          name="nonElective"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Non Elective (Non-Matching) Contributions</FormLabel>
              <FormControl>
                <div>
                  <FormLabel className="text-sm">
                    Are there non-elective or profit sharing contributions?
                  </FormLabel>
                  <div className="flex gap-[10px] mt-[10px]">
                    {["Yes", "No"].map((item, index) => (
                      <Button
                        className={`inline-flex gap-[4px]  ${
                          field.value?.toLowerCase() === item.toLowerCase()
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        }`}
                        key={index}
                        type="button"
                        onClick={() => setValue("nonElective", item)}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            field.value?.toLowerCase() === item.toLowerCase()
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                          }`}
                        />
                        <span
                          className={`${
                            field.value?.toLowerCase() === item.toLowerCase()
                              ? "text-black"
                              : "text-black"
                          }`}
                        >
                          {item}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {field.value === "Yes" && (
                    <div className="mt-[16px] text-sm">
                      <div className="flex gap-[10px] items-center">
                        <Checkbox
                          onCheckedChange={(checked: boolean) =>
                            setValue(
                              "nonElectiveEmployerContributions",
                              checked,
                            )
                          }
                          checked={watch("nonElectiveEmployerContributions")}
                        />
                        <span>Non Elective Employer Contributions</span>
                      </div>
                      {watch("nonElectiveEmployerContributions") && (
                        <div className="mt-[10px]">
                          <Select
                            value={watch("nonElectiveType")}
                            onValueChange={(value) =>
                              setValue("nonElectiveType", value)
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Discretionary" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              <SelectItem value="Discretionary">
                                Discretionary
                              </SelectItem>
                              <SelectItem value="Non-Discretionary">
                                Non-Discretionary
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-[10px]">
                            <p className="text-sm">
                              {watch("nonElectiveType") === "Non-Discretionary"
                                ? "We make non elective contributions of"
                                : "We generally make non elective contributions of"}
                            </p>
                            <Select
                              value={watch("nonElectivePercentage")}
                              onValueChange={(value) =>
                                setValue("nonElectivePercentage", value)
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue placeholder="1%" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                <SelectItem value="1%">1%</SelectItem>
                                <SelectItem value="1.5%">1.5%</SelectItem>
                                <SelectItem value="2%">2%</SelectItem>
                                <SelectItem value="2.5%">2.5%</SelectItem>
                                <SelectItem value="3%">3%</SelectItem>
                                <SelectItem value="3.5%">3.5%</SelectItem>
                                <SelectItem value="4%">4%</SelectItem>
                                <SelectItem value="4.5%">4.5%</SelectItem>
                                <SelectItem value="5%">5%</SelectItem>
                                <SelectItem value="5.5%">5.5%</SelectItem>
                                <SelectItem value="6%">6%</SelectItem>
                                <SelectItem value="6.5%">6.5%</SelectItem>
                                <SelectItem value="7%">7%</SelectItem>
                                <SelectItem value="7.5%">7.5%</SelectItem>
                                <SelectItem value="8%">8%</SelectItem>
                                <SelectItem value="8.5%">8.5%</SelectItem>
                                <SelectItem value="9%">9%</SelectItem>
                                <SelectItem value="9.5%">9.5%</SelectItem>
                                <SelectItem value="10%">10%</SelectItem>
                                <SelectItem value="10.5%">10.5%</SelectItem>
                                <SelectItem value="11%">11%</SelectItem>
                                <SelectItem value="11.5%">11.5%</SelectItem>
                                <SelectItem value="12%">12%</SelectItem>
                                <SelectItem value="12.5%">12.5%</SelectItem>
                                <SelectItem value="13%">13%</SelectItem>
                                <SelectItem value="13.5%">13.5%</SelectItem>
                                <SelectItem value="14%">14%</SelectItem>
                                <SelectItem value="14.5%">14.5%</SelectItem>
                                <SelectItem value="15%">15%</SelectItem>
                                <SelectItem value="15.5%">15.5%</SelectItem>
                                <SelectItem value="16%">16%</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="inline text-sm">
                              {" "}
                              into the plan on your behalf.
                            </p>
                          </div>
                          <div className="mt-[10px]">
                            <Checkbox
                              onCheckedChange={(checked: boolean) =>
                                setValue("useCustomText", checked)
                              }
                              checked={watch("useCustomText")}
                            />
                            <span className="ml-2">Use Custom Text</span>
                            {watch("useCustomText") && (
                              <Input
                                type="text"
                                placeholder="(enter your custom non elective contribution structure)"
                                className="mt-[10px]"
                                value={watch("customText")}
                                onChange={(e) =>
                                  setValue("customText", e.target.value)
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-[10px] items-center mt-[10px]">
                        <Checkbox
                          onCheckedChange={(checked: boolean) =>
                            setValue(
                              "employerProfitSharingContributions",
                              checked,
                            )
                          }
                          checked={watch("employerProfitSharingContributions")}
                        />
                        <span>Employer Profit Sharing Contributions</span>
                      </div>
                      {watch("employerProfitSharingContributions") && (
                        <div className="mt-[10px]">
                          <Select
                            value={watch("profitSharingType")}
                            onValueChange={(value) =>
                              setValue("profitSharingType", value)
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Discretionary" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              <SelectItem value="Discretionary">
                                Discretionary
                              </SelectItem>
                              <SelectItem value="Non-Discretionary">
                                Non-Discretionary
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-[10px]">
                            <p className="text-sm">
                              {watch("profitSharingType") ===
                              "Non-Discretionary"
                                ? "We make profit sharing contributions of"
                                : "We generally make profit sharing contributions of"}
                            </p>
                            <Select
                              value={watch("profitSharingPercentage")}
                              onValueChange={(value) =>
                                setValue("profitSharingPercentage", value)
                              }
                            >
                              <SelectTrigger className="w-20 mt-2">
                                <SelectValue placeholder="1%" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                <SelectItem value="1%">1%</SelectItem>
                                <SelectItem value="1.5%">1.5%</SelectItem>
                                <SelectItem value="2%">2%</SelectItem>
                                <SelectItem value="2.5%">2.5%</SelectItem>
                                <SelectItem value="3%">3%</SelectItem>
                                <SelectItem value="3.5%">3.5%</SelectItem>
                                <SelectItem value="4%">4%</SelectItem>
                                <SelectItem value="4.5%">4.5%</SelectItem>
                                <SelectItem value="5%">5%</SelectItem>
                                <SelectItem value="5.5%">5.5%</SelectItem>
                                <SelectItem value="6%">6%</SelectItem>
                                <SelectItem value="6.5%">6.5%</SelectItem>
                                <SelectItem value="7%">7%</SelectItem>
                                <SelectItem value="7.5%">7.5%</SelectItem>
                                <SelectItem value="8%">8%</SelectItem>
                                <SelectItem value="8.5%">8.5%</SelectItem>
                                <SelectItem value="9%">9%</SelectItem>
                                <SelectItem value="9.5%">9.5%</SelectItem>
                                <SelectItem value="10%">10%</SelectItem>
                                <SelectItem value="10.5%">10.5%</SelectItem>
                                <SelectItem value="11%">11%</SelectItem>
                                <SelectItem value="11.5%">11.5%</SelectItem>
                                <SelectItem value="12%">12%</SelectItem>
                                <SelectItem value="12.5%">12.5%</SelectItem>
                                <SelectItem value="13%">13%</SelectItem>
                                <SelectItem value="13.5%">13.5%</SelectItem>
                                <SelectItem value="14%">14%</SelectItem>
                                <SelectItem value="14.5%">14.5%</SelectItem>
                                <SelectItem value="15%">15%</SelectItem>
                                <SelectItem value="15.5%">15.5%</SelectItem>
                                <SelectItem value="16%">16%</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="inline text-sm">
                              {" "}
                              into the plan on your behalf.
                            </p>
                          </div>
                          <div className="mt-[10px]">
                            <Checkbox
                              onCheckedChange={(checked: boolean) =>
                                setValue("useProfitSharingCustomText", checked)
                              }
                              checked={watch("useProfitSharingCustomText")}
                            />
                            <span className="ml-2">Use Custom Text</span>
                            {watch("useProfitSharingCustomText") && (
                              <Input
                                type="text"
                                placeholder="(enter your custom profit sharing contribution structure)"
                                className="mt-[10px]"
                                value={watch("profitSharingCustomText")}
                                onChange={(e) =>
                                  setValue(
                                    "profitSharingCustomText",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-[10px] items-center mt-[10px]">
                        <Checkbox
                          onCheckedChange={(checked: boolean) =>
                            setValue("waitingPeriod", checked)
                          }
                          checked={watch("waitingPeriod")}
                        />
                        <span>Waiting Period</span>
                      </div>
                      {watch("waitingPeriod") && (
                        <div className="mt-[10px]">
                          <div className="flex items-center gap-[10px]">
                            <p className="text-sm">You must work for</p>
                            <Select
                              value={watch("waitingPeriodDuration")}
                              onValueChange={(value) =>
                                setValue("waitingPeriodDuration", value)
                              }
                            >
                              <SelectTrigger className="mt-2 mb-2 w-26">
                                <SelectValue placeholder="1,000 hours" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                <SelectItem value="1,000 hours">
                                  1,000 hours
                                </SelectItem>
                                <SelectItem value="1 month">1 month</SelectItem>
                                <SelectItem value="2 months">
                                  2 months
                                </SelectItem>
                                <SelectItem value="3 months">
                                  3 months
                                </SelectItem>
                                <SelectItem value="4 months">
                                  4 months
                                </SelectItem>
                                <SelectItem value="5 months">
                                  5 months
                                </SelectItem>
                                <SelectItem value="6 months">
                                  6 months
                                </SelectItem>
                                <SelectItem value="7 months">
                                  7 months
                                </SelectItem>
                                <SelectItem value="8 months">
                                  8 months
                                </SelectItem>
                                <SelectItem value="9 months">
                                  9 months
                                </SelectItem>
                                <SelectItem value="10 months">
                                  10 months
                                </SelectItem>
                                <SelectItem value="11 months">
                                  11 months
                                </SelectItem>
                                <SelectItem value="12 months">
                                  12 months
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="inline text-sm">
                              {" "}
                              before we start to make contributions on your
                              behalf.
                            </p>
                          </div>
                          <div className="flex gap-[10px] mt-[10px]">
                            <Button
                              className={`inline-flex gap-[4px] ${
                                watch("waitingPeriodStart") === "Immediate"
                                  ? "bg-white hover:bg-white"
                                  : "bg-muted text-white hover:bg-muted"
                              }`}
                              type="button"
                              onClick={() =>
                                setValue("waitingPeriodStart", "Immediate")
                              }
                            >
                              <div
                                className={`w-[10px] h-[10px] rounded-full ${
                                  watch("waitingPeriodStart") === "Immediate"
                                    ? "bg-black"
                                    : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                                }`}
                              />
                              <span
                                className={`${
                                  watch("waitingPeriodStart") === "Immediate"
                                    ? "text-black"
                                    : "text-black dark:text-white"
                                }`}
                              >
                                Immediate
                              </span>
                            </Button>
                            <Button
                              className={`inline-flex gap-[4px] ${
                                watch("waitingPeriodStart") === "Custom"
                                  ? "bg-white hover:bg-white"
                                  : "bg-muted text-white hover:bg-muted"
                              }`}
                              type="button"
                              onClick={() =>
                                setValue("waitingPeriodStart", "Custom")
                              }
                            >
                              <div
                                className={`w-[10px] h-[10px] rounded-full ${
                                  watch("waitingPeriodStart") === "Custom"
                                    ? "bg-black"
                                    : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                                }`}
                              />
                              <span
                                className={`${
                                  watch("waitingPeriodStart") === "Custom"
                                    ? "text-black"
                                    : "text-black dark:text-white"
                                }`}
                              >
                                Custom
                              </span>
                            </Button>
                          </div>
                          {watch("waitingPeriodStart") === "Custom" && (
                            <div className="mt-[10px] flex items-center gap-[10px]">
                              <p className="text-sm">
                                These contributions will begin on the
                              </p>
                              <Select
                                value={watch("waitingPeriodStartDate")}
                                onValueChange={(value) =>
                                  setValue("waitingPeriodStartDate", value)
                                }
                              >
                                <SelectTrigger className="w-auto min-w-32">
                                  <SelectValue placeholder="Next Payroll" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  <SelectItem value="Next Payroll">
                                    Next Payroll
                                  </SelectItem>
                                  <SelectItem value="Next Month">
                                    Next Month
                                  </SelectItem>
                                  <SelectItem value="Next Quarter">
                                    Next Quarter
                                  </SelectItem>
                                  <SelectItem value="Next Semi Annual Entry Date">
                                    Next Semi Annual Entry Date
                                  </SelectItem>
                                  <SelectItem value="Next Annual Entry Date">
                                    Next Annual Entry Date
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={control}
          name="investments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Investments & Operations</FormLabel>
              <FormControl>
                <div>
                  <FormLabel className="text-sm">Investments</FormLabel>
                  <div className="flex flex-wrap flex-col gap-[10px] mt-[16px] text-sm">
                    {[
                      "Qualified Default Investment Alternative (QDIA)",
                      "Target Date Fund Description",
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="inline-flex gap-[10px] items-center"
                      >
                        <Checkbox
                          onCheckedChange={(checked: boolean) => {
                            let newInvestments: string[] = [];
                            if (checked) {
                              newInvestments = [...(field.value || []), item];
                            } else {
                              newInvestments =
                                field.value?.filter(
                                  (deferral: string) => deferral !== item,
                                ) || [];
                            }
                            setValue("investments", newInvestments);
                          }}
                          checked={field.value?.includes(item)}
                        />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="flex items-center gap-[4px] mb-3 mt-[16px] cursor-pointer"
                    onClick={() =>
                      setValue(
                        "showAdvancedInvestment",
                        !showAdvancedInvestment,
                      )
                    }
                  >
                    <p className="text-[12px]">Advanced</p>
                    {!showAdvancedInvestment ? (
                      <Icons.arrowDown className="rotate-180 mt-[2px] w-4 h-4" />
                    ) : (
                      <Icons.arrowDown className="mt-[2px] w-4 h-4" />
                    )}
                  </div>
                  {showAdvancedInvestment && (
                    <div className="flex flex-wrap flex-col gap-[10px] mb-3 mt-[10px] text-sm">
                      {[
                        "Model Portfolio Description",
                        "Self Directed Brokerage Accounts",
                        "Managed Accounts (Plan Specs only)",
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="inline-flex gap-[10px] items-center"
                        >
                          <Checkbox
                            onCheckedChange={(checked: boolean) => {
                              let newAdvancedInvestments: string[] = [];
                              if (checked) {
                                newAdvancedInvestments = [
                                  ...advancedInvestments,
                                  item,
                                ];
                              } else {
                                newAdvancedInvestments =
                                  advancedInvestments.filter(
                                    (investment: string) => investment !== item,
                                  );
                              }
                              setValue(
                                "advancedInvestments",
                                newAdvancedInvestments,
                              );
                            }}
                            checked={advancedInvestments.includes(item)}
                          />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="w-full flex justify-center mt-[16px] gap-[16px]">
          <Button
            type="button"
            className="rounded-[9999px] bg-transparent text-black dark:text-white border-[1px] border-solid border-white hover:bg-transparent"
            onClick={() => setActiveTab("branding")}
          >
            Back
          </Button>
          <Button type="submit" className="rounded-[9999px]">
            Next: Resources
          </Button>
        </div>
      </form>
    </Form>
  );
};

const PlanDetails = ({ updateInfo, info, onComplete }: PlanDetailsProps) => {
  const [activeTab, setActiveTab] = useState("planType");
  const [planTypeCompleted, setPlanTypeCompleted] = useState(!!info.planType);
  const [combinedInfo, setCombinedInfo] = useState<Partial<InfoTypes>>(info);

  const handlePlanTypeUpdate = (newInfo: Partial<InfoTypes>) => {
    setCombinedInfo((prev) => ({ ...prev, ...newInfo }));
    setPlanTypeCompleted(true);
    setActiveTab("planDetails");
  };

  const handlePlanDetailsUpdate = (newInfo: Partial<InfoTypes>) => {
    const updatedInfo = { ...combinedInfo, ...newInfo };
    updateInfo(updatedInfo);
    onComplete();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Plan Details</h2>
      <p className="text-muted-foreground">
        Select your plan type and configure the plan details.
      </p>

      <Card>
        <CardContent className="pt-6">
          {/* <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="planType">Plan Type</TabsTrigger>
              <TabsTrigger value="planDetails" disabled={!planTypeCompleted}>
                Plan Details
              </TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="planType">
              <PlanTypeSelectionTab
                updateInfo={handlePlanTypeUpdate}
                info={combinedInfo}
                onComplete={() => {}} // We'll handle tab switching manually
              />
            </TabsContent>
            <TabsContent value="planDetails">
              <PlanDetailsTab
                setActiveTab={() => {}} // We'll handle completion manually
                updateInfo={handlePlanDetailsUpdate}
                info={combinedInfo}
              />
            </TabsContent>
          </Tabs> */}
          <PlanDetailsTab
            setActiveTab={() => {}} // We'll handle completion manually
            updateInfo={handlePlanDetailsUpdate}
            info={combinedInfo}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanDetails;
