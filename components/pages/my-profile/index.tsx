"use client";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import React, { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";

export type ProfileData = {
  name: string;
  company: string;
  phone: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  disclaimer: string;
  advisorLogoUrl: File | null;
  complianceEmail: string;
  advisorLink: string;
  additionalAdvisorLink: string;
  recordkeeperContactLabel: string;
  title: string;
  displayAdvisorInfoHeader: boolean;
  displayAdvisorContactButton: boolean;
  advisorLogo: string;
  showAdvancedCompliance: boolean;
};

const MyProfile = () => {
  const fileInputRef: any = useRef(null);
  const [base64File, setBase64File] = useState<any>("");

  const form = useForm<ProfileData>({
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      advisorName: "",
      advisorEmail: "",
      advisorPhone: "",
      disclaimer: "",
      advisorLogoUrl: null,
      complianceEmail: "",
      advisorLink: "Email",
      additionalAdvisorLink: "Email",
      recordkeeperContactLabel: "Account Access / Enroll",
      title: "Plan Investment Advisor",
      displayAdvisorInfoHeader: true,
      displayAdvisorContactButton: false,
      advisorLogo: "Use Existing Logo",
      showAdvancedCompliance: true,
    },
  });

  const { handleSubmit, setValue, watch, control } = form;
  const title = watch("title");
  const displayAdvisorInfoHeader = watch("displayAdvisorInfoHeader");
  const displayAdvisorContactButton = watch("displayAdvisorContactButton");
  const advisorLogo = watch("advisorLogo");
  const showAdvancedCompliance = watch("showAdvancedCompliance");
  const advisorLink = watch("advisorLink");
  const additionalAdvisorLink = watch("additionalAdvisorLink");
  const recordkeeperContactLabel = watch("recordkeeperContactLabel");
  const clientLogo: any = watch("advisorLogoUrl");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await axios.get("/api/profile");
        const profileData: ProfileData = response.data;
        (Object.keys(profileData) as (keyof ProfileData)[]).forEach((key) => {
          setValue(key, profileData[key]);
        });
      } catch (error) {
        console.error("Failed to fetch profile data", error);
      }
    }
    fetchProfile();
  }, [setValue]);

  const handleFileChange = (event: any) => {
    const file = event.target.files[0];

    try {
      setValue("advisorLogoUrl", file);
      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onload = () => {
        setBase64File(reader.result);
      };
    } catch (error) {
      console.error("error :>> ", error);
    }
  };

  const onSubmit = async (data: ProfileData) => {
    try {
      const response = await axios.post("/api/profile", data);
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4">
        {/* User Information */}
        <p className="text-sm font-semibold">User Information</p>
        <div className="p-[12px] border-solid border-[1px] border-input mt-[6px] rounded-[8px]">
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-bold">Name</p>
            <Input
              {...form.register("name")}
              className="border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-bold">Company</p>
            <Input
              {...form.register("company")}
              className="border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-bold">Phone</p>
            <Input
              {...form.register("phone")}
              className="border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
        </div>

        {/* Advisor Information */}
        <p className="text-sm font-semibold mt-[12px]">Advisor Information</p>
        <div className="p-[12px] border-solid border-[1px] border-input mt-[6px] rounded-[8px]">
          <p className="text-sm font-semibold">Title</p>
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem className="mt-[12px]">
                <FormControl>
                  <div className="flex flex-wrap gap-[10px]">
                    {[
                      "Plan Investment Advisor",
                      "Plan Support Contact",
                      "Plan Account Manager",
                      "Other",
                    ].map((item, index) => (
                      <Button
                        className={`inline-flex gap-[4px]  ${
                          title === item
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        }`}
                        key={index}
                        type="button"
                        onClick={() => setValue("title", item)}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            title === item
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                          }`}
                        />
                        <span
                          className={`${
                            title === item ? "text-black" : "text-black"
                          }`}
                        >
                          {item}
                        </span>
                      </Button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-semibold">Advisor Name</p>
            <Input
              {...form.register("advisorName")}
              className="  border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-semibold">Advisor Email</p>
            <Input
              {...form.register("advisorEmail")}
              className="  border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-semibold">Advisor Phone</p>
            <Input
              {...form.register("advisorPhone")}
              className="  border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="mt-[12px]" />
          <div className="flex items-center text-[12px] mt-[12px]">
            <p className="min-w-[100px] font-semibold">Disclaimer</p>
            <Textarea
              {...form.register("disclaimer")}
              placeholder="Enter your disclaimer here"
              className="w-full h-[200px]"
            />
          </div>

          <FormField
            control={control}
            name="displayAdvisorInfoHeader"
            render={({ field }) => (
              <FormItem className="mt-[12px]">
                <div className="inline-flex items-center gap-[10px]">
                  <FormControl>
                    <Checkbox
                      onCheckedChange={(checked: boolean) =>
                        setValue("displayAdvisorInfoHeader", checked)
                      }
                      checked={displayAdvisorInfoHeader}
                    />
                  </FormControl>
                  <FormLabel className="text-[12px]">
                    Display Advisor Info Header
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="displayAdvisorContactButton"
            render={({ field }) => (
              <FormItem className="mt-[12px]">
                <div className="inline-flex items-center gap-[10px]">
                  <FormControl>
                    <Checkbox
                      onCheckedChange={(checked: boolean) =>
                        setValue("displayAdvisorContactButton", checked)
                      }
                      checked={displayAdvisorContactButton}
                    />
                  </FormControl>
                  <FormLabel className="text-[12px]">
                    Display Advisor Contact Button
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Advisor Logo */}
        <p className="mt-[12px] text-sm font-semibold">Advisor Logo</p>
        <div className="p-[12px] border-solid border-[1px] border-input mt-[12px] rounded-[8px]">
          <FormField
            control={control}
            name="advisorLogo"
            render={({ field }) => (
              <FormItem className="">
                <FormControl>
                  <div className="flex flex-wrap gap-[10px]">
                    {["Use Existing Logo", "Upload New Logo"].map(
                      (item, index) => (
                        <Button
                          className={`inline-flex gap-[4px]  ${
                            advisorLogo === item
                              ? "bg-white hover:bg-white"
                              : "bg-muted text-white hover:bg-muted"
                          }`}
                          key={index}
                          type="button"
                          onClick={() => {
                            if (item === "Upload New Logo") {
                              fileInputRef.current.click();
                            } else {
                              setBase64File("");
                            }
                            setValue("advisorLogo", item);
                          }}
                        >
                          <div
                            className={`w-[10px] h-[10px] rounded-full ${
                              advisorLogo === item
                                ? "bg-black"
                                : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                            }`}
                          />
                          <span
                            className={`${
                              advisorLogo === item ? "text-black" : "text-black"
                            }`}
                          >
                            {item}
                          </span>
                        </Button>
                      ),
                    )}
                    <Input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="max-w-[136px] mt-[12px]">
            {base64File ? (
              <img src={base64File} className="max-h-[136px] object-contain" />
            ) : (
              <img src="/logo-2.png" alt="Waypoint Financial Advisors" />
            )}
          </div>
        </div>

        {/* Compliance */}
        <p className="mt-[12px] text-sm font-semibold">Compliance</p>
        <div className="p-[12px] border-solid border-[1px] border-input mt-[12px] rounded-[8px]">
          <div className="flex items-center text-[12px] mt-[12px] gap-2">
            <p className="min-w-[100px] font-bold">Email address</p>
            <Input
              {...form.register("complianceEmail")}
              className="  border-transparent focus:!ring-0 focus:ring-offset-0"
            />
          </div>
          <Separator className="my-[12px]" />
          <div className="flex items-center justify-center gap-[4px]">
            <InfoCircledIcon className="inline-flex" />
            <span className="text-[12px]">
              This email will automatically be BCC on all system emails
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[4px]">
          <p className="text-[12px]">Advanced</p>
          {!showAdvancedCompliance ? (
            <Icons.arrowDown
              className="cursor-pointer rotate-180 mt-[2px] w-4 h-4"
              onClick={() =>
                setValue("showAdvancedCompliance", !showAdvancedCompliance)
              }
            />
          ) : (
            <Icons.arrowDown
              className="cursor-pointer mt-[2px] w-4 h-4"
              onClick={() =>
                setValue("showAdvancedCompliance", !showAdvancedCompliance)
              }
            />
          )}
        </div>
        {showAdvancedCompliance && (
          <>
            <p className="text-sm font-semibold">Customize Resource Contacts</p>
            <div className="p-[12px] border-solid border-[1px] border-input mt-[12px] rounded-[8px]">
              <div className="flex items-start gap-[12px] mt-[12px]">
                <p className="text-[12px] w-[25%] text-right pt-[10px]">
                  Advisor Link
                </p>
                <FormField
                  control={control}
                  name="advisorLink"
                  render={({ field }) => (
                    <FormItem className="">
                      <FormControl>
                        <>
                          <div className="flex flex-wrap gap-[10px]">
                            {["Email", "External Url"].map((item, index) => (
                              <Button
                                className={`inline-flex gap-[4px] w-[220px] justify-start ${
                                  advisorLink === item
                                    ? "bg-white hover:bg-white"
                                    : "bg-muted text-white hover:bg-muted"
                                }`}
                                key={index}
                                type="button"
                                onClick={() => setValue("advisorLink", item)}
                              >
                                <div
                                  className={`w-[10px] h-[10px] rounded-full ${
                                    advisorLink === item
                                      ? "bg-black"
                                      : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                                  }`}
                                />
                                <span
                                  className={`${
                                    advisorLink === item
                                      ? "text-black"
                                      : "text-black"
                                  }`}
                                >
                                  {item}
                                </span>
                              </Button>
                            ))}
                          </div>
                          {advisorLink === "External Url" && (
                            <div className="flex flex-wrap gap-[10px]">
                              <Input
                                {...form.register("advisorLink")}
                                className="w-[220px]"
                                placeholder="https://"
                              />
                            </div>
                          )}
                        </>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-start gap-[12px] mt-[12px]">
                <p className="text-[12px] w-[25%] text-right pt-[10px]">
                  Additional Advisor Link
                </p>
                <FormField
                  control={control}
                  name="additionalAdvisorLink"
                  render={({ field }) => (
                    <FormItem className="">
                      <FormControl>
                        <>
                          <div className="flex flex-wrap gap-[10px]">
                            {["Email", "External Url"].map((item, index) => (
                              <Button
                                className={`inline-flex gap-[4px] w-[220px] justify-start  ${
                                  additionalAdvisorLink === item
                                    ? "bg-white hover:bg-white"
                                    : "bg-muted text-white hover:bg-muted"
                                }`}
                                key={index}
                                type="button"
                                onClick={() =>
                                  setValue("additionalAdvisorLink", item)
                                }
                              >
                                <div
                                  className={`w-[10px] h-[10px] rounded-full ${
                                    additionalAdvisorLink === item
                                      ? "bg-black"
                                      : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                                  }`}
                                />
                                <span
                                  className={`${
                                    additionalAdvisorLink === item
                                      ? "text-black"
                                      : "text-black"
                                  }`}
                                >
                                  {item}
                                </span>
                              </Button>
                            ))}
                          </div>
                          {additionalAdvisorLink === "External Url" && (
                            <div className="flex flex-wrap gap-[10px]">
                              <Input
                                {...form.register("additionalAdvisorLink")}
                                className="w-[220px]"
                                placeholder="https://"
                              />
                            </div>
                          )}
                        </>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-start gap-[12px] mt-[12px]">
                <p className="text-[12px] w-[25%] text-right pt-[10px]">
                  Record Keeper Contact Label
                </p>
                <FormField
                  control={control}
                  name="recordkeeperContactLabel"
                  render={({ field }) => (
                    <FormItem className="">
                      <FormControl>
                        <>
                          <div className="flex flex-wrap gap-[10px]">
                            {["Account Access / Enroll", "Custom"].map(
                              (item, index) => (
                                <Button
                                  className={`inline-flex gap-[4px] w-[220px] justify-start ${
                                    recordkeeperContactLabel === item
                                      ? "bg-white hover:bg-white"
                                      : "bg-muted text-white hover:bg-muted"
                                  }`}
                                  key={index}
                                  type="button"
                                  onClick={() =>
                                    setValue("recordkeeperContactLabel", item)
                                  }
                                >
                                  <div
                                    className={`w-[10px] h-[10px] rounded-full ${
                                      recordkeeperContactLabel === item
                                        ? "bg-black"
                                        : "bg-transparent border-solid border-[1px] border-black dark:border-black"
                                    }`}
                                  />
                                  <span
                                    className={`${
                                      recordkeeperContactLabel === item
                                        ? "text-black"
                                        : "text-black"
                                    }`}
                                  >
                                    {item}
                                  </span>
                                </Button>
                              ),
                            )}
                          </div>
                          {recordkeeperContactLabel === "Custom" && (
                            <div className="flex flex-wrap gap-[10px]">
                              <Input
                                {...form.register("recordkeeperContactLabel")}
                                className="w-[220px]"
                                placeholder=""
                              />
                            </div>
                          )}
                        </>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="w-full flex justify-center m-auto items-center mt-[16px] gap-[16px]">
          <Button type="submit" className="rounded-[9999px]">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default MyProfile;
