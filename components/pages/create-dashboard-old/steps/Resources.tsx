"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { InfoTypes } from "@/types/InfoTypes";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResourcesProps {
  updateInfo: (info: Partial<InfoTypes>) => void;
  info: Partial<InfoTypes>;
  onComplete: (info: Partial<InfoTypes>) => void;
}

// Contact info schema
const contactInfoSchema = z.object({
  contact_title_1: z.string().min(1, "Title is required"),
  contact_name_1: z.string().min(1, "Name is required"),
  contact_info_1: z.string().min(1, "Contact information is required"),
  contact_info_2: z.string().optional(),

  contact2_title_1: z.string().optional(),
  contact2_name_1: z.string().optional(),
  contact2_info_1: z.string().optional(),
  contact2_info_2: z.string().optional(),

  contact3_title_1: z.string().optional(),
  contact3_name_1: z.string().optional(),
  contact3_info_1: z.string().optional(),
  contact3_info_2: z.string().optional(),

  contact4_title_1: z.string().optional(),
  contact4_name_1: z.string().optional(),
  contact4_info_1: z.string().optional(),
  contact4_info_2: z.string().optional(),

  contact5_title_1: z.string().optional(),
  contact5_name_1: z.string().optional(),
  contact5_info_1: z.string().optional(),
  contact5_info_2: z.string().optional(),
});

// Disclaimer schema
const disclaimerSchema = z.object({
  disclaimer: z
    .string()
    .max(5000, "Disclaimer must be less than 5000 characters")
    .min(1, "Disclaimer is required"),
});

type ContactInfoFormValues = z.infer<typeof contactInfoSchema>;
type DisclaimerFormValues = z.infer<typeof disclaimerSchema>;

const Resources = ({ updateInfo, info, onComplete }: ResourcesProps) => {
  const [activeTab, setActiveTab] = useState("contactInfo");
  const [contactInfoCompleted, setContactInfoCompleted] = useState(
    !!(info.contact_title_1 && info.contact_name_1 && info.contact_info_1),
  );
  const [combinedInfo, setCombinedInfo] = useState<Partial<InfoTypes>>(info);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contactInfoForm = useForm<ContactInfoFormValues>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      contact_title_1: info.contact_title_1 || "",
      contact_name_1: info.contact_name_1 || "",
      contact_info_1: info.contact_info_1 || "",
      contact_info_2: info.contact_info_2 || "",

      contact2_title_1: info.contact2_title_1 || "",
      contact2_name_1: info.contact2_name_1 || "",
      contact2_info_1: info.contact2_info_1 || "",
      contact2_info_2: info.contact2_info_2 || "",

      contact3_title_1: info.contact3_title_1 || "",
      contact3_name_1: info.contact3_name_1 || "",
      contact3_info_1: info.contact3_info_1 || "",
      contact3_info_2: info.contact3_info_2 || "",

      contact4_title_1: info.contact4_title_1 || "",
      contact4_name_1: info.contact4_name_1 || "",
      contact4_info_1: info.contact4_info_1 || "",
      contact4_info_2: info.contact4_info_2 || "",

      contact5_title_1: info.contact5_title_1 || "",
      contact5_name_1: info.contact5_name_1 || "",
      contact5_info_1: info.contact5_info_1 || "",
      contact5_info_2: info.contact5_info_2 || "",
    },
  });

  const disclaimerForm = useForm<DisclaimerFormValues>({
    resolver: zodResolver(disclaimerSchema),
    defaultValues: {
      disclaimer: info.disclaimer || "",
    },
  });

  const handleContactInfoSubmit = (data: ContactInfoFormValues) => {
    setCombinedInfo((prev) => ({ ...prev, ...data }));
    updateInfo(data);
    setContactInfoCompleted(true);
    setActiveTab("disclaimer");
  };

  const handleDisclaimerSubmit = async (data: DisclaimerFormValues) => {
    setIsSubmitting(true);

    try {
      // Parse the disclaimer text into lines with max 200 characters
      const disclaimerLines = parseDisclaimerIntoLines(data.disclaimer);

      // Create an object with disclaimer_line1 through disclaimer_line25
      const disclaimerData: Record<string, string> = {};
      disclaimerLines.forEach((line, index) => {
        if (index < 25) {
          disclaimerData[`disclaimer_line${index + 1}`] = line;
        }
      });

      const disclaimers = data.disclaimer?.split("\n");
      if (disclaimers?.length > 25) {
      }

      const finalData = {
        ...combinedInfo,
        ...disclaimerData,
        disclaimer: data.disclaimer,
      };

      updateInfo(finalData);
      await onComplete(finalData);
    } catch (error) {
      console.error("Error submitting disclaimer:", error);
      toast.error("Failed to submit disclaimer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to parse disclaimer text into lines with max 200 characters
  const parseDisclaimerIntoLines = (text: string): string[] => {
    const maxLineLength = 200;
    const words = text.split(/[\s\n\r]+/);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      if ((currentLine + " " + word).length <= maxLineLength) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Resources</h2>
      <p className="text-muted-foreground">
        Provide contact information and disclaimer for your plan.
      </p>

      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contactInfo">Contact Information</TabsTrigger>
              <TabsTrigger value="disclaimer" disabled={!contactInfoCompleted}>
                Disclaimer
              </TabsTrigger>
            </TabsList>
            <Separator className="my-4" />
            <TabsContent value="contactInfo">
              <Form {...contactInfoForm}>
                <form
                  onSubmit={contactInfoForm.handleSubmit(
                    handleContactInfoSubmit,
                  )}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Primary Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={contactInfoForm.control}
                        name="contact_title_1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select title" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Mr.">Mr.</SelectItem>
                                <SelectItem value="Mrs.">Mrs.</SelectItem>
                                <SelectItem value="Ms.">Ms.</SelectItem>
                                <SelectItem value="Dr.">Dr.</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactInfoForm.control}
                        name="contact_name_1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={contactInfoForm.control}
                        name="contact_info_1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactInfoForm.control}
                        name="contact_info_2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter phone number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Additional contacts can be added here if needed */}

                  <div className="flex justify-center mt-6">
                    <Button type="submit" className="rounded-full px-8">
                      Continue to Disclaimer
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="disclaimer">
              <Form {...disclaimerForm}>
                <form
                  onSubmit={disclaimerForm.handleSubmit(handleDisclaimerSubmit)}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Disclaimer</h3>
                    <p className="text-muted-foreground">
                      Enter your disclaimer text below. The text will be
                      automatically parsed into lines with a maximum of 200
                      characters each.
                    </p>
                  </div>

                  <FormField
                    control={disclaimerForm.control}
                    name="disclaimer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disclaimer Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your disclaimer text here..."
                            className="min-h-[200px]"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-2">
                          Maximum 5,000 characters. Your text will be
                          automatically formatted into lines with a maximum of
                          200 characters each.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-center mt-6">
                    <Button
                      type="submit"
                      className="rounded-full px-8"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Creating Plan..." : "Create Plan"}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Resources;
