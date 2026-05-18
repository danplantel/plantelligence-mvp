"use client";

import { useState, useEffect } from "react";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listQDIAOptions,
  listAdditionalFeatures,
} from "@/components/pages/create-dashboard/Section/InvestmentsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoStep4aProps {
  errorFields?: string[];
}

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return <p className="text-sm text-red-500 mt-1">{error}</p>;
}

export function VideoStep4a({ errorFields = [] }: VideoStep4aProps) {
  const { stepData, saveStepDataLocally, previousStep, nextStep } =
    useVideoWizardStore();

  // Get saved data or initialize
  const step4aData = (stepData as any).step4a || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  // Initialize investments state
  const [investmentOptions, setInvestmentOptions] = useState<string[]>(
    step4aData.investmentOptions ||
      selectedPlan?.investments?.investmentOptions ||
      [],
  );

  // Initialize plan features state
  const [planFeatures, setPlanFeatures] = useState<string[]>(
    step4aData.planFeatures || selectedPlan?.resources?.planFeatures || [],
  );

  const [customFeature, setCustomFeature] = useState<string>(
    step4aData.customFeature || "",
  );

  // Save data when it changes
  useEffect(() => {
    saveStepDataLocally("step4a", {
      investmentOptions,
      planFeatures,
      customFeature,
    });
  }, [investmentOptions, planFeatures, customFeature, saveStepDataLocally]);

  const handleInvestmentOptionChange = (value: string) => {
    setInvestmentOptions(value ? [value] : []);
  };

  const handleFeatureToggle = (featureValue: string, checked: boolean) => {
    if (checked) {
      setPlanFeatures((prev) => [...prev, featureValue]);
    } else {
      setPlanFeatures((prev) => prev.filter((f) => f !== featureValue));
    }
  };

  const handleCustomFeatureChange = (value: string) => {
    setCustomFeature(value);
  };

  const handleNext = async () => {
    // Use nextStep from store which handles sub-step navigation
    await nextStep();
  };

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
          Investments & Features
        </CardTitle>
        <p className="text-gray-500 mt-1">
          Configure your plan&apos;s investment options and additional features
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>QDIA (Choose One)</Label>
          <Select
            value={investmentOptions.join(", ")}
            onValueChange={handleInvestmentOptionChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select QDIA option" />
            </SelectTrigger>
            <SelectContent>
              {listQDIAOptions.map((item) => (
                <SelectItem value={item.value} key={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Additional Features</Label>
            <p className="text-sm text-gray-500">
              Are there any additional plan features that you would like to
              mention in the plan video (check all that apply)
            </p>
            <div className="space-y-2 mt-2">
              {listAdditionalFeatures.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`feature-${item.value}`}
                    checked={planFeatures.includes(item.value)}
                    onCheckedChange={(checked) =>
                      handleFeatureToggle(item.value, checked as boolean)
                    }
                  />
                  <Label htmlFor={`feature-${item.value}`}>{item.label}</Label>
                </div>
              ))}
              {planFeatures.includes("custom") && (
                <div className="mt-2">
                  <Input
                    type="text"
                    placeholder="Enter custom feature"
                    maxLength={50}
                    value={customFeature}
                    onChange={(e) => handleCustomFeatureChange(e.target.value)}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {customFeature.length}/50 characters
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="feature-none"
                  checked={planFeatures.includes("none")}
                  onCheckedChange={(checked) =>
                    handleFeatureToggle("none", checked as boolean)
                  }
                />
                <Label htmlFor="feature-none">None</Label>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              NOTE: These are optional and would display on a summary screen
              towards the end of video, we will always refer participants to
              Summary Plan Description regardless.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
