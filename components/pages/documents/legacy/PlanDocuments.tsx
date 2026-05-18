"use client";

import FileUpload from "@/components/file-upload";
import { Icons } from "@/components/icons";
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
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";
import { videos } from "@/constants/data";
import React, { useState } from "react";
import { useForm } from "react-hook-form";

interface IPlanDocuments {
  isOpen: boolean;
  onClose: () => void;
}

const PlanDocuments = ({ isOpen, onClose }: IPlanDocuments) => {
  const form = useForm({
    defaultValues: {
      imgUrl: [],
      plans: [] as string[],
      showOnAllPlans: true,
    },
  });

  const [keyword, setKeyword] = useState("");

  const { handleSubmit, control, watch, setValue } = form;

  const showOnAllPlans = watch("showOnAllPlans");
  const plans = watch("plans") || [];
  const imgUrl = watch("imgUrl") || [];

  const onSubmit = (data: any) => {
    onClose();
  };

  const selectAll = () => {
    const allIds = videos.map((video) => video.videoId);
    setValue("plans", allIds);
  };

  const selectNone = () => {
    setValue("plans", []);
  };

  const filterPlans = videos.filter(
    (video) =>
      video?.clientName?.toLowerCase()?.includes(keyword?.toLowerCase()),
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Plan Documents">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 w-full">
          <FormField
            control={control}
            name="imgUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FileUpload
                    onChange={field.onChange}
                    value={field.value}
                    onRemove={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {imgUrl.length > 0 && (
            <>
              <FormField
                control={control}
                name="showOnAllPlans"
                render={({ field }) => (
                  <FormItem className="!mt-[12px]">
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
                name="plans"
                render={({ field }) => (
                  <FormItem className="!mt-[12px]">
                    <FormLabel>Or show on these plans only</FormLabel>
                    <FormControl>
                      <>
                        <FormLabel className="!mt-[0px] font-bold text-bold block">
                          {plans.length} of {videos.length} selected
                        </FormLabel>
                        <div className="w-full mt-[12px]">
                          <Input
                            className=""
                            placeholder="Enter Keywords"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                          />
                          <div className="flex items-center gap-[12px] mt-[4px]">
                            <div className="inline-flex items-center gap-[4px] cursor-pointer">
                              <Icons.check className="w-[20px] h-[20px] text-green-400" />
                              <p
                                className="cursor-pointer font-bold text-[14px]"
                                onClick={selectAll}
                              >
                                Check All
                              </p>
                            </div>
                            <div className="inline-flex items-center gap-[4px] cursor-pointer">
                              <Icons.close className="w-[20px] h-[20px] text-red-400" />
                              <p
                                className="cursor-pointer font-bold text-[14px]"
                                onClick={selectNone}
                              >
                                Uncheck All
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="h-[200px] overflow-auto">
                          {filterPlans.map((plan, index) => {
                            return (
                              <div
                                className="flex items-center gap-[10px] cursor-pointer mb-[12px]"
                                key={plan.videoId}
                              >
                                <Checkbox
                                  checked={plans?.includes(plan.videoId)}
                                  onCheckedChange={(checked: boolean) => {
                                    let newPlans: string[] = [];
                                    if (checked) {
                                      newPlans = [...plans, plan.videoId];
                                    } else {
                                      newPlans = plans.filter(
                                        (deferral) => deferral !== plan.videoId,
                                      );
                                    }
                                    setValue("plans", newPlans);
                                  }}
                                />
                                <span className="whitespace-nowrap text-[13px]">
                                  {plan.clientName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Separator />

          <div className="w-full flex justify-end items-center mt-[16px] gap-[12px]">
            <Button
              type="button"
              className="rounded-[9999px]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-[9999px]">
              Save
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  );
};

export default PlanDocuments;
