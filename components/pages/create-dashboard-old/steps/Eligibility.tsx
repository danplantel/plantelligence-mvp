"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InfoTypes } from "@/types/InfoTypes";
import { useState } from "react";

interface EligibilityProps {
  updateInfo: (info: Partial<InfoTypes>) => void;
  info: Partial<InfoTypes>;
  onComplete: () => void;
}

const listServiceRequirement = [
  {
    label: "No service requirement",
    value: "none",
  },
  {
    label: "1 month of service",
    value: "1month",
  },
  {
    label: "3 months of service",
    value: "3months",
  },
  {
    label: "6 months of service",
    value: "6months",
  },
  {
    label: "1 year of service",
    value: "1year",
  },
];
const Eligibility = ({ updateInfo, info, onComplete }: EligibilityProps) => {
  const [activeTab, setActiveTab] = useState("eligibilityRules");
  const [eligibilityCompleted, setEligibilityCompleted] = useState(
    !!(info.ageRequirement && info.eligibilityRequirement && info.entryDate),
  );
  const [combinedInfo, setCombinedInfo] = useState<Partial<InfoTypes>>(info);

  // Eligibility Rules section
  const handleEligibilityUpdate = () => {
    setEligibilityCompleted(true);
    setActiveTab("autoEnrollment");
  };

  // Auto Enrollment section
  const handleAutoEnrollmentUpdate = () => {
    updateInfo(combinedInfo);
    onComplete();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Eligibility</h2>
      <p className="text-muted-foreground">
        Define eligibility rules and auto-enrollment settings for your plan.
      </p>

      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="eligibilityRules">
                Eligibility Rules
              </TabsTrigger>
              <TabsTrigger
                value="autoEnrollment"
                disabled={!eligibilityCompleted}
              >
                Auto-Enrollment
              </TabsTrigger>
            </TabsList>
            <Separator className="my-4" />

            {/* Eligibility Rules Content */}
            <TabsContent value="eligibilityRules">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Age Requirement</h3>
                  <RadioGroup
                    value={combinedInfo.ageRequirement || ""}
                    onValueChange={(value) =>
                      setCombinedInfo({
                        ...combinedInfo,
                        ageRequirement: value,
                      })
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="age-none" />
                      <Label htmlFor="age-none">No age requirement</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="18" id="age-18" />
                      <Label htmlFor="age-18">18 years or older</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="21" id="age-21" />
                      <Label htmlFor="age-21">21 years or older</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Service Requirement</h3>
                  <RadioGroup
                    value={combinedInfo.eligibilityRequirement || ""}
                    onValueChange={(value) =>
                      setCombinedInfo({
                        ...combinedInfo,
                        eligibilityRequirement: value,
                      })
                    }
                    className="space-y-3"
                  >
                    {listServiceRequirement.map((item) => (
                      <div
                        className="flex items-center space-x-2"
                        key={item.value}
                      >
                        <RadioGroupItem value={item.value} id="service-none" />
                        <Label htmlFor="service-none">{item.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Entry Date</h3>
                  <RadioGroup
                    value={combinedInfo.entryDate || ""}
                    onValueChange={(value) =>
                      setCombinedInfo({ ...combinedInfo, entryDate: value })
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="immediate" id="entry-immediate" />
                      <Label htmlFor="entry-immediate">
                        Immediate entry upon meeting eligibility
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="entry-monthly" />
                      <Label htmlFor="entry-monthly">
                        Monthly entry (first day of month after eligibility)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quarterly" id="entry-quarterly" />
                      <Label htmlFor="entry-quarterly">
                        Quarterly entry (Jan 1, Apr 1, Jul 1, Oct 1)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="semiannual"
                        id="entry-semiannual"
                      />
                      <Label htmlFor="entry-semiannual">
                        Semi-annual entry (Jan 1, Jul 1)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex justify-center mt-6">
                  <Button
                    type="button"
                    className="rounded-full px-8"
                    onClick={handleEligibilityUpdate}
                    disabled={
                      !combinedInfo.ageRequirement ||
                      !combinedInfo.eligibilityRequirement ||
                      !combinedInfo.entryDate
                    }
                  >
                    Next: Auto-Enrollment
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Auto Enrollment Content */}
            <TabsContent value="autoEnrollment">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Automatic Enrollment</h3>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-enrollment"
                      checked={combinedInfo.automaticEnrollment === true}
                      onCheckedChange={(checked) =>
                        setCombinedInfo({
                          ...combinedInfo,
                          automaticEnrollment: checked,
                        })
                      }
                    />
                    <Label htmlFor="auto-enrollment">
                      Enable automatic enrollment for eligible employees
                    </Label>
                  </div>
                </div>

                {combinedInfo.automaticEnrollment === true && (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">
                        Default Deferral Rate
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          id="default-deferral"
                          value={
                            combinedInfo.automaticEnrollmentPercentage || ""
                          }
                          onChange={(e) =>
                            setCombinedInfo({
                              ...combinedInfo,
                              automaticEnrollmentPercentage: e.target.value,
                            })
                          }
                          className="w-20"
                          min="1"
                          max="15"
                        />
                        <Label htmlFor="default-deferral">
                          % of compensation
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">
                        Annual Automatic Increase
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-increase"
                          checked={combinedInfo.annualAutoIncrease === "yes"}
                          onCheckedChange={(checked) =>
                            setCombinedInfo({
                              ...combinedInfo,
                              annualAutoIncrease: checked ? "yes" : "no",
                            })
                          }
                        />
                        <Label htmlFor="auto-increase">
                          Enable annual automatic increase
                        </Label>
                      </div>
                    </div>

                    {combinedInfo.annualAutoIncrease === "yes" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          Automatic Increase Percentage
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="increase-percentage"
                            value={
                              combinedInfo.automaticIncreasePercentage || ""
                            }
                            onChange={(e) =>
                              setCombinedInfo({
                                ...combinedInfo,
                                automaticIncreasePercentage: e.target.value,
                              })
                            }
                            className="w-20"
                            min="1"
                            max="5"
                          />
                          <Label htmlFor="increase-percentage">
                            % per year
                          </Label>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Deferral Cap</h3>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          id="deferral-cap"
                          value={combinedInfo.deferralCap || ""}
                          onChange={(e) =>
                            setCombinedInfo({
                              ...combinedInfo,
                              deferralCap: e.target.value,
                            })
                          }
                          className="w-20"
                          min="1"
                          max="15"
                        />
                        <Label htmlFor="deferral-cap">% maximum</Label>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-center mt-6">
                  <Button
                    type="button"
                    className="rounded-full px-8"
                    onClick={handleAutoEnrollmentUpdate}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Eligibility;
