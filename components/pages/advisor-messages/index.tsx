"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PickerColor } from "@/components/ui/picker-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FileTextIcon } from "@radix-ui/react-icons";
import { useRef } from "react";
import { useForm, Controller } from "react-hook-form";

const AdvisorMessages = () => {
  const fileInputRef: any = useRef(null);
  const form = useForm({
    defaultValues: {
      video: null,
      useLogo: "Use My Profile Logo",
      showLogo: "Show Logo in Title Only",
      videoBackGroundMusic: "",
      includeNameAndTitle: true,
      title: "",
      description: "",
      name: "",
      company: "",
      useDisclaimer: "None",
      type: "Message",
      showOnAllPlans: true,
      color: "#EAEAEA", // Set the default value for color
      plan: "1",
    },
    mode: "onChange",
  });

  const { handleSubmit, control, setValue, watch } = form;
  const video: any = watch("video");
  const useLogo = watch("useLogo");
  const showLogo = watch("showLogo");
  const useDisclaimer = watch("useDisclaimer");
  const includeNameAndTitle = watch("includeNameAndTitle");
  const type = watch("type");
  const showOnAllPlans = watch("showOnAllPlans");

  const onSubmit = (data: any) => {};

  const handleUploadFile = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event: any) => {
    const file = event.target.files[0];
    setValue("video", file);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full space-y-4 pt-[10px]"
      >
        <FormField
          control={form.control}
          name="video"
          render={({ field }) => (
            <FormItem>
              <div>
                <FormLabel>Upload a video</FormLabel>
                <FormControl>
                  <Button
                    className="flex cursor-pointer items-center gap-[4px] justify-center rounded-[9999px] mt-[10px] w-fit"
                    type="button"
                    onClick={handleUploadFile}
                  >
                    <FileTextIcon />
                    <span>Select a video</span>
                    <Input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </Button>
                </FormControl>
                {video && (
                  <span className="mt-[4px] text-[12px]">{video?.name}</span>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="bg-[#fbf8e3] p-[8px] rounded-[2px] text-[12px] text-[#8e7341] max-w-[240px]">
          Only landscape videos are supported.
        </p>

        <FormField
          control={control}
          name="useLogo"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {["Use My Profile Logo", "Use Custom Logo", "No Logo"].map(
                    (item, index) => (
                      <Button
                        className={`inline-flex gap-[4px]  ${
                          useLogo?.toLowerCase() === item?.toLowerCase()
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        }`}
                        key={index}
                        type="button"
                        onClick={() => setValue("useLogo", item)}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            useLogo?.toLowerCase() === item?.toLowerCase()
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                          }`}
                        />
                        <span
                          className={`${
                            useLogo?.toLowerCase() === item?.toLowerCase()
                              ? "text-black"
                              : "text-black dark:text-white"
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

        <FormField
          control={control}
          name="showLogo"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {["Show Logo in Title Only", "Include in Video"].map(
                    (item, index) => (
                      <Button
                        className={`inline-flex gap-[4px]  ${
                          showLogo?.toLowerCase() === item?.toLowerCase()
                            ? "bg-white hover:bg-white"
                            : "bg-muted text-white hover:bg-muted"
                        }`}
                        key={index}
                        type="button"
                        onClick={() => setValue("showLogo", item)}
                      >
                        <div
                          className={`w-[10px] h-[10px] rounded-full ${
                            showLogo?.toLowerCase() === item?.toLowerCase()
                              ? "bg-black"
                              : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                          }`}
                        />
                        <span
                          className={`${
                            showLogo?.toLowerCase() === item?.toLowerCase()
                              ? "text-black"
                              : "text-black dark:text-white"
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

        <FormField
          control={control}
          name="includeNameAndTitle"
          render={({ field }) => (
            <FormItem className="mt-[12px]">
              <div className="inline-flex items-center gap-[10px]">
                <FormControl>
                  <Checkbox
                    onCheckedChange={(checked: boolean) =>
                      setValue("includeNameAndTitle", checked)
                    }
                    checked={includeNameAndTitle}
                  />
                </FormControl>
                <FormLabel>Include name and title in video</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="color"
          render={({ field }) => (
            <FormItem className="mt-[12px]">
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div>
                  <PickerColor color={field.value} onChange={field.onChange} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="View a message from the plan advisor"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (not displayed publicly)</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="useDisclaimer"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {[
                    "None",
                    "Use My Default Disclaimer",
                    "Use Custom Disclaimer",
                  ].map((item, index) => (
                    <Button
                      className={`inline-flex gap-[4px]  ${
                        useDisclaimer?.toLowerCase() === item?.toLowerCase()
                          ? "bg-white hover:bg-white"
                          : "bg-muted text-white hover:bg-muted"
                      }`}
                      key={index}
                      type="button"
                      onClick={() => setValue("useDisclaimer", item)}
                    >
                      <div
                        className={`w-[10px] h-[10px] rounded-full ${
                          useDisclaimer?.toLowerCase() === item?.toLowerCase()
                            ? "bg-black"
                            : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                        }`}
                      />
                      <span
                        className={`${
                          useDisclaimer?.toLowerCase() === item?.toLowerCase()
                            ? "text-black"
                            : "text-black dark:text-white"
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

        <FormField
          control={control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-[10px]">
                  {["Message", "Meeting"].map((item, index) => (
                    <Button
                      className={`inline-flex gap-[4px]  ${
                        type?.toLowerCase() === item?.toLowerCase()
                          ? "bg-white hover:bg-white"
                          : "bg-muted text-white hover:bg-muted"
                      }`}
                      key={index}
                      type="button"
                      onClick={() => setValue("type", item)}
                    >
                      <div
                        className={`w-[10px] h-[10px] rounded-full ${
                          type?.toLowerCase() === item?.toLowerCase()
                            ? "bg-black"
                            : "bg-transparent border-solid border-[1px] border-black dark:border-white"
                        }`}
                      />
                      <span
                        className={`${
                          type?.toLowerCase() === item?.toLowerCase()
                            ? "text-black"
                            : "text-black dark:text-white"
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

        <FormField
          control={control}
          name="showOnAllPlans"
          render={({ field }) => (
            <FormItem className="mt-[12px]">
              <div className="inline-flex items-center gap-[10px]">
                <FormControl>
                  <Checkbox
                    onCheckedChange={(checked: boolean) =>
                      setValue("showOnAllPlans", checked)
                    }
                    checked={showOnAllPlans}
                  />
                </FormControl>
                <FormLabel>Show on all plans</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Or show on these plans only</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue
                        defaultValue={field.value}
                        placeholder="Select plans"
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="w-[180px]">
                    {[{ id: "1", name: "Plan 1" }].map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="bg-[#ecf7f9] p-[8px] rounded-[2px] text-[12px] text-[#212529] max-w-[480px]">
          Poster images can be selected once the videos has completed
          processing. Use the button located next to the advisor message to
          select a poster image.
        </p>

        <Separator />
        <div className="w-full flex flex-col m-auto justify-center items-center mt-[16px]">
          <Button type="submit" className="m-auto rounded-[9999px]">
            Build Video
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AdvisorMessages;
