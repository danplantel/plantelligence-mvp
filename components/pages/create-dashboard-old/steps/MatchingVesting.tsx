"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import type { InfoTypes } from "@/types/InfoTypes"

interface MatchingVestingProps {
  updateInfo: (info: Partial<InfoTypes>) => void
  info: Partial<InfoTypes>
  onComplete: () => void
}

const MatchingVesting = ({ updateInfo, info, onComplete }: MatchingVestingProps) => {
  const [activeTab, setActiveTab] = useState("matching")
  const [matchingCompleted, setMatchingCompleted] = useState(!!info.matchPlan)
  const [combinedInfo, setCombinedInfo] = useState<Partial<InfoTypes>>(info)
  const [showVesting, setShowVesting] = useState(info.matchCategory === "Yes" || false)

  // Matching state
  const [matchCategory, setMatchCategory] = useState<string>(info.matchCategory || "")
  const [matchType, setMatchType] = useState<string>(info.matchType || "")
  const [matchAmount, setMatchAmount] = useState<string>(info.matchAmount || "")
  const [matchLimit, setMatchLimit] = useState<string>(info.matchLimit || "")

  // Vesting state
  const [vestingSchedule, setVestingSchedule] = useState<string>(info.vestingSchedule || "")
  const [vestingYears, setVestingYears] = useState<string>(info.vestingYears || "")
  const [vestingCliff, setVestingCliff] = useState<boolean>(info.vestingCliff || false)
  const [vestingCliffYears, setVestingCliffYears] = useState<string>(info.vestingCliffYears || "")
  const [vestingDetails, setVestingDetails] = useState<string>(info.vestingDetails || "")

  const form = useForm<InfoTypes>({
    defaultValues: {
      matchPlan: info.matchPlan || "No",
      matchSafe: info.matchSafe || "No",
      matchType: info.matchType || "Dollar for Dollar Match",
      matchPercentage: info.matchPercentage || 0.5,
      customMatchDescription: info.customMatchDescription || "",
      safeHarborContribution: info.safeHarborContribution || "3%",
      showWaitingPeriod: info.showWaitingPeriod || false,
      waitingPeriodDuration: info.waitingPeriodDuration || "1,000 hours",
      waitingPeriodStart: info.waitingPeriodStart || "Immediate",
      waitingPeriodStartDate: info.waitingPeriodStartDate || "Next Payroll",
      safeHarborMatchType: info.safeHarborMatchType || "",
    },
  })

  const { handleSubmit, control, watch, setValue } = form
  const matchPlan = watch("matchPlan")
  const matchSafe = watch("matchSafe")

  useEffect(() => {
    // Update showVesting when matchCategory changes
    setShowVesting(matchCategory === "Yes")
  }, [matchCategory])

  const handleMatchingComplete = (data: InfoTypes) => {
    const updatedInfo = { ...combinedInfo, ...data }
    setCombinedInfo(updatedInfo)
    setMatchingCompleted(true)
    if (showVesting) {
      setActiveTab("vesting")
    } else {
      updateInfo(updatedInfo)
      onComplete()
    }
  }

  const handleVestingComplete = (data: InfoTypes) => {
    const updatedInfo = { ...combinedInfo, ...data }
    updateInfo(updatedInfo)
    onComplete()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Matching & Vesting</h2>
      <p className="text-muted-foreground">Configure employer matching contributions and vesting schedule.</p>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full  grid-cols-2`}>
              <TabsTrigger value="matching">Matching</TabsTrigger>
              {/* {showVesting && ( */}
                <TabsTrigger value="vesting" disabled={!matchingCompleted}>
                  Vesting
                </TabsTrigger>
              {/* )} */}
            </TabsList>
            <Separator className="my-4" />

            {/* Matching Tab Content */}
            <TabsContent value="matching">
              <Form {...form}>
                <form onSubmit={handleSubmit(handleMatchingComplete)} className="space-y-6">
                  <FormField
                    control={control}
                    name="matchPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match</FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            <div>
                              <FormLabel className="mt-2 mb-2">Does the plan have match?</FormLabel>
                              <div className="flex gap-4 mt-2">
                                {["Yes", "No"].map((item, index) => {
                                  return <Button
                                    key={index}
                                    type="button"
                                    className={`inline-flex gap-2 rounded-md ${field.value?.toLowerCase() === item.toLowerCase()
                                      ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 !text-gray-900 dark:!text-gray-100"
                                      : "bg-muted !text-black dark:!text-black hover:bg-muted"
                                      }`}
                                    onClick={() => setValue("matchPlan", item)}
                                  >
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full ${field.value?.toLowerCase() === item.toLowerCase()
                                        ? "bg-black"
                                        : "bg-transparent border-solid border border-black dark:border-black"
                                        }`}
                                    />
                                    <span className="">{item}</span>
                                  </Button>
                                })}
                              </div>
                            </div>

                            {field.value === "Yes" && matchSafe !== "Yes" && (
                              <div className="mt-4 space-y-4">
                                <div>
                                  <FormLabel>Match Type</FormLabel>
                                  <Select
                                    value={watch("matchType")}
                                    onValueChange={(value) => setValue("matchType", value)}
                                  >
                                    <SelectTrigger className="w-48">
                                      <SelectValue placeholder="Dollar for Dollar Match" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48">
                                      <SelectItem value="Dollar for Dollar">Dollar for Dollar</SelectItem>
                                      <SelectItem value="50%">50%</SelectItem>
                                      <SelectItem value="Custom">Custom</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {watch("matchType") === "Custom" && (
                                    <div className="mt-4 max-w-[260px]">
                                      <FormLabel>Custom Match Description</FormLabel>
                                      <Input
                                        type="text"
                                        placeholder="Enter custom match description"
                                        value={watch("customMatchDescription") || ""}
                                        maxLength={30}
                                        onChange={(e) => setValue("customMatchDescription", e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <FormLabel>Match Percentage Limit</FormLabel>
                                  <Select
                                    value={watch("matchPercentage")?.toString() || ""}
                                    onValueChange={(value) => setValue("matchPercentage", Number(value))}
                                  >
                                    <SelectTrigger className="w-48">
                                      <SelectValue placeholder="0.5%" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48">
                                      {[
                                        0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
                                        10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16,
                                      ].map((percentage) => (
                                        <SelectItem key={percentage} value={percentage.toString()}>
                                          {percentage}%
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="matchSafe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Safe Harbor</FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            <div>
                              <FormLabel className="mt-2 mb-2">Is it a safe harbor plan?</FormLabel>
                              <div className="flex gap-4 mt-2">
                                {["Yes", "No"].map((item, index) => (
                                  <Button
                                    key={index}
                                    type="button"
                                    className={`inline-flex gap-2 rounded-md ${field.value?.toLowerCase() === item.toLowerCase()
                                      ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 !text-gray-900 dark:!text-gray-100"
                                      : "bg-muted !text-black dark:!text-black hover:bg-muted"
                                      }`}
                                    onClick={() => setValue("matchSafe", item)}
                                  >
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full ${field.value?.toLowerCase() === item.toLowerCase()
                                        ? "bg-black"
                                        : "bg-transparent border-solid border border-black dark:border-black"
                                        }`}
                                    />
                                    <span>{item}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {field.value === "Yes" && (
                              <div className="mt-4 space-y-4">
                                <div>
                                  <div className="flex items-center gap-[10px]">
                                    <p className="text-sm">We will make a</p>
                                    <Select
                                      value={String(watch("safeHarborContribution") || "3%")}
                                      onValueChange={(value) => setValue("safeHarborContribution", value)}
                                    >
                                      <SelectTrigger className="w-auto mt-2">
                                        <SelectValue placeholder="3%" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        {[
                                          "1%", "1.5%", "2%", "2.5%", "3%", "3.5%", "4%", "4.5%", "5%", "5.5%", "6%",
                                          "6.5%", "7%", "7.5%", "8%", "8.5%", "9%", "9.5%", "10%", "10.5%", "11%",
                                          "11.5%", "12%", "12.5%", "13%", "13.5%", "14%", "14.5%", "15%", "15.5%", "16%"
                                        ].map((percentage) => (
                                          <SelectItem key={percentage} value={percentage}>
                                            {percentage}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="inline text-sm">contribution on your behalf.</p>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-[10px]">
                                    <p className="text-sm">SelectType </p>
                                    <Select
                                      value={String(watch("safeHarborMatchType") || "3%")}
                                      onValueChange={(value) => setValue("safeHarborMatchType", value)}
                                    >
                                      <SelectTrigger className="w-auto mt-2">
                                        <SelectValue placeholder="3%" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        {[
                                          "Basic Safe Harbor",
                                          "Enhanced Safe Harbor",
                                          "Non-Elective Safe Harbor",
                                          "QACA Safe Harbor",
                                        ].map((percentage) => (
                                          <SelectItem key={percentage} value={percentage}>
                                            {percentage}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(matchPlan === "Yes" || matchSafe === "Yes") && (
                    <FormField
                      control={control}
                      name="showWaitingPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => setValue("showWaitingPeriod", checked as boolean)}
                                />
                                <span className="text-sm">Waiting Period</span>
                              </div>

                              {field.value && (
                                <div className="mt-4">
                                  <div className="flex items-center gap-[10px]">
                                    <p className="text-sm">You must work for</p>
                                    <Select
                                      value={watch("waitingPeriodDuration")}
                                      onValueChange={(value) => setValue("waitingPeriodDuration", value)}
                                    >
                                      <SelectTrigger className="w-26">
                                        <SelectValue placeholder="1,000 hours" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        <SelectItem value="1,000 hours">1,000 hours</SelectItem>
                                        {Array.from({ length: 12 }, (_, i) => (
                                          <SelectItem key={i} value={`${i + 1} month${i > 0 ? 's' : ''}`}>
                                            {i + 1} month{i > 0 ? 's' : ''}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="inline text-sm">
                                      before we start to make contributions on your behalf.
                                    </p>
                                  </div>

                                  <div className="flex gap-[10px] mt-[10px]">
                                    <Button
                                      type="button"
                                      className={`inline-flex gap-[4px] rounded-md ${watch("waitingPeriodStart") === "Immediate"
                                        ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        : "bg-muted text-white hover:bg-muted"
                                        }`}
                                      onClick={() => setValue("waitingPeriodStart", "Immediate")}
                                    >
                                      <div
                                        className={`w-[10px] h-[10px] rounded-full ${watch("waitingPeriodStart") === "Immediate"
                                          ? "bg-black"
                                          : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                                          }`}
                                      />
                                      <span>Immediate</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      className={`inline-flex gap-[4px] rounded-md ${watch("waitingPeriodStart") === "Custom"
                                        ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        : "bg-muted text-white hover:bg-muted"
                                        }`}
                                      onClick={() => setValue("waitingPeriodStart", "Custom")}
                                    >
                                      <div
                                        className={`w-[10px] h-[10px] rounded-full ${watch("waitingPeriodStart") === "Custom"
                                          ? "bg-black"
                                          : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                                          }`}
                                      />
                                      <span>Custom</span>
                                    </Button>
                                  </div>

                                  {watch("waitingPeriodStart") === "Custom" && (
                                    <div className="mt-[10px] flex items-center gap-[10px]">
                                      <p className="text-sm">These contributions will begin on the</p>
                                      <Select
                                        value={watch("waitingPeriodStartDate")}
                                        onValueChange={(value) => setValue("waitingPeriodStartDate", value)}
                                      >
                                        <SelectTrigger className="w-auto min-w-32">
                                          <SelectValue placeholder="Next Payroll" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          <SelectItem value="Next Payroll">Next Payroll</SelectItem>
                                          <SelectItem value="Next Month">Next Month</SelectItem>
                                          <SelectItem value="Next Quarter">Next Quarter</SelectItem>
                                          <SelectItem value="Next Semi Annual Entry Date">
                                            Next Semi Annual Entry Date
                                          </SelectItem>
                                          <SelectItem value="Next Annual Entry Date">Next Annual Entry Date</SelectItem>
                                        </SelectContent>
                                      </Select>
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
                  )}

                  <div className="flex justify-end">
                    <Button type="submit">{showVesting ? 'Next: Vesting' : 'Continue'}</Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Vesting Tab Content */}
            {showVesting && (
              <TabsContent value="vesting">
                <Form {...form}>
                  <form onSubmit={handleSubmit(handleVestingComplete)} className="space-y-6">
                    <FormField
                      control={control}
                      name="vestingScheduleRadio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vesting Schedule</FormLabel>
                          <FormControl>
                            <div className="flex flex-wrap gap-[10px] mt-[16px]">
                              <RadioGroup
                                defaultValue="Immediate"
                                className="flex gap-[10px]"
                                onValueChange={(value: string) => {
                                  setValue("vestingScheduleRadio", value)
                                }}
                                value={field.value}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Immediate" id="r1" />
                                  <Label htmlFor="r1">Immediate</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="3-Year Cliff" id="r2" />
                                  <Label htmlFor="r2">3-Year Cliff</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="6-Year Graded" id="r3" />
                                  <Label htmlFor="r3">6-Year Graded</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Custom Schedule" id="r4" />
                                  <Label htmlFor="r4">Custom Schedule</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Custom Structure" id="r5" />
                                  <Label htmlFor="r5">Custom Structure</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watch("vestingScheduleRadio") === "Custom Schedule" && (
                      <FormField
                        control={control}
                        name="customScheduleYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={(value) => setValue("customScheduleYears", value)}
                              >
                                <SelectTrigger className="w-auto">
                                  <SelectValue placeholder="Select years" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {[1, 2, 3, 4, 5, 6].map((year) => (
                                    <SelectItem key={year} value={year.toString()}>
                                      {year}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {watch("vestingScheduleRadio") === "Custom Structure" && (
                      <FormField
                        control={control}
                        name="customStructureText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Structure</FormLabel>
                            <FormControl>
                              <Input type="text" {...field} placeholder="Enter your custom vesting structure" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={control}
                      name="vestingSchedules"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Options</FormLabel>
                          <FormControl>
                            <div className="space-y-4">
                              <div className="flex items-center gap-[10px]">
                                <Checkbox
                                  onCheckedChange={(checked: boolean) => {
                                    let newVestingSchedules: string[] = []
                                    if (checked) {
                                      newVestingSchedules = [...(field.value || []), "Include Vesting Information in Video"]
                                    } else {
                                      newVestingSchedules = (field.value || []).filter(
                                        (deferral: string) => deferral !== "Include Vesting Information in Video",
                                      )
                                    }
                                    setValue("vestingSchedules", newVestingSchedules)
                                  }}
                                  checked={field.value?.includes("Include Vesting Information in Video")}
                                />
                                <span className="text-sm">Include Vesting Information in Video</span>
                              </div>

                              <div className="flex items-center gap-[20px]">
                                {["Plan Allows Loans", "Include Loan Option"].map((item, index) => (
                                  <div className="inline-flex items-center gap-[10px]" key={index}>
                                    <Checkbox
                                      onCheckedChange={(checked: boolean) => {
                                        let newVestingSchedules: string[] = []
                                        if (checked) {
                                          newVestingSchedules = [...(field.value || []), item]
                                        } else {
                                          newVestingSchedules =
                                            (field.value || []).filter((deferral: string) => deferral !== item) || []
                                        }
                                        setValue("vestingSchedules", newVestingSchedules)
                                      }}
                                      checked={field.value?.includes(item)}
                                    />
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-[10px]">
                                <Checkbox
                                  onCheckedChange={(checked: boolean) => {
                                    let newVestingSchedules: string[] = []
                                    if (checked) {
                                      newVestingSchedules = [...(field.value || []), "Plan allows Hardships"]
                                    } else {
                                      newVestingSchedules =
                                        (field.value || []).filter(
                                          (deferral: string) => deferral !== "Plan allows Hardships",
                                        ) || []
                                    }
                                    setValue("vestingSchedules", newVestingSchedules)
                                  }}
                                  checked={field.value?.includes("Plan allows Hardships")}
                                />
                                <span>Plan Allows Hardships (Plan Specs only)</span>
                              </div>

                              <div className="flex items-center gap-[10px]">
                                <Checkbox
                                  onCheckedChange={(checked: boolean) => {
                                    let newVestingSchedules: string[] = []
                                    if (checked) {
                                      newVestingSchedules = [...(field.value || []), "Beneficiary Designation"]
                                    } else {
                                      newVestingSchedules =
                                        (field.value || []).filter(
                                          (deferral: string) => deferral !== "Beneficiary Designation",
                                        ) || []
                                    }
                                    setValue("vestingSchedules", newVestingSchedules)
                                  }}
                                  checked={field.value?.includes("Beneficiary Designation")}
                                />
                                <span>Beneficiary Designation</span>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button type="submit">Complete</Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default MatchingVesting
