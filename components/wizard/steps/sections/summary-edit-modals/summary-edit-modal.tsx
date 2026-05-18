"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { UploadInput } from "@/components/ui/upload-input";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { OrganizationType, ServiceType } from "@/types/wizard";
import { getTitleOptionsByOrgType } from "../user-setup-section/user-setup-section.funcs";
import { Edit, User, Briefcase, Palette, Settings } from "lucide-react";
import { deleteFromR2 } from "@/lib/upload-to-r2";

interface SummaryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData: {
    clientProfile?: any;
    teamSize?: any;
    services?: any;
    insuranceLicensing?: any;
    branding?: any;
    userSetup?: any;
  };
}

export function SummaryEditModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SummaryEditModalProps) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [editData, setEditData] = useState({
    // User Profile
    organizationType:
      initialData.clientProfile?.organizationType ||
      OrganizationType.INDEPENDENT,
    customOrganization: initialData.clientProfile?.customOrganization || "",
    teamSize: initialData.teamSize?.teamSize || "",

    // Services
    services: initialData.services?.services || [],
    customService: initialData.services?.customService || "",

    // Branding
    brandColor: initialData.branding?.brandColor || "#1F3A60",
    organizationName:
      initialData.clientProfile?.organizationName ||
      initialData.branding?.organizationName ||
      "",
    website:
      initialData.clientProfile?.website || initialData.branding?.website || "",
    missionStatement: initialData.branding?.missionStatement || "",
    logo: initialData.branding?.logo || "",
    backgroundImage: initialData.branding?.backgroundImage || "",
    useDefaultWelcomeStatement: true,

    // User Setup
    name: initialData.userSetup?.name || "",
    email: initialData.userSetup?.email || "",
    phone: initialData.userSetup?.phone || "",
    title: initialData.userSetup?.title || "",
    designations: initialData.userSetup?.designations || [],
    headshot: initialData.userSetup?.headshot || "",
    headshotData: initialData.userSetup?.headshotData || null,
    userBackgroundImage: initialData.userSetup?.backgroundImage || "",
  });

  const DEFAULT_WELCOME_STATEMENT = `Welcome to <Organization_Name>

We are committed to providing you with comprehensive benefits and resources to support your well-being and success.

At <Organization_Name>, we understand that your benefits are more than just perks—they're essential tools that help you thrive both personally and professionally.

We hope to inspire confidence and peace of mind as you navigate your benefits journey with us.`;

  const designationOptions = [
    "CFP",
    "CFA",
    "CPA",
    "ChFC",
    "CLU",
    "CIMA",
    "CIMC",
    "PFS",
    "AIF",
    "CPFA",
    "CRPS",
    "CRPC",
    "CRC",
    "CDFA",
    "CFF",
    "CKA",
    "CTFA",
    "CWS",
    "PFS",
    "QKA",
    "QPA",
    "QKA",
    "QPA",
    "QKA",
    "QPA",
  ];

  const serviceOptions = [
    { value: ServiceType.RETIREMENT, label: "Retirement", description: "" },
    { value: ServiceType.GROUP_LIFE_DISABILITY, label: "Group Life", description: "" },
    { value: ServiceType.GROUP_HEALTH, label: "Group Health", description: "" },
    { value: ServiceType.OTHER, label: "Other", description: "" },
  ];

  useEffect(() => {
    setEditData({
      organizationType:
        initialData.clientProfile?.organizationType ||
        OrganizationType.INDEPENDENT,
      customOrganization: initialData.clientProfile?.customOrganization || "",
      teamSize: initialData.teamSize?.teamSize || "",
      services: initialData.services?.services || [],
      customService: initialData.services?.customService || "",
      brandColor: initialData.branding?.brandColor || "#1F3A60",
      organizationName:
        initialData.clientProfile?.organizationName ||
        initialData.branding?.organizationName ||
        "",
      website:
        initialData.clientProfile?.website ||
        initialData.branding?.website ||
        "",
      missionStatement: initialData.branding?.missionStatement || "",
      logo: initialData.branding?.logo || "",
      backgroundImage: initialData.branding?.backgroundImage || "",
      useDefaultWelcomeStatement: true,
      name: initialData.userSetup?.name || "",
      email: initialData.userSetup?.email || "",
      phone: initialData.userSetup?.phone || "",
      title: initialData.userSetup?.title || "",
      designations: initialData.userSetup?.designations || [],
      headshot: initialData.userSetup?.headshot || "",
      headshotData: initialData.userSetup?.headshotData || null,
      userBackgroundImage: initialData.userSetup?.backgroundImage || "",
    });
  }, [initialData]);

  const handleSave = () => {
    onSave(editData);
    onClose();
  };

  const handleCancel = () => {
    setEditData({
      organizationType:
        initialData.clientProfile?.organizationType ||
        OrganizationType.INDEPENDENT,
      customOrganization: initialData.clientProfile?.customOrganization || "",
      teamSize: initialData.teamSize?.teamSize || "",
      services: initialData.services?.services || [],
      customService: initialData.services?.customService || "",
      brandColor: initialData.branding?.brandColor || "#1F3A60",
      organizationName:
        initialData.clientProfile?.organizationName ||
        initialData.branding?.organizationName ||
        "",
      website:
        initialData.clientProfile?.website ||
        initialData.branding?.website ||
        "",
      missionStatement: initialData.branding?.missionStatement || "",
      logo: initialData.branding?.logo || "",
      backgroundImage: initialData.branding?.backgroundImage || "",
      useDefaultWelcomeStatement: true,
      name: initialData.userSetup?.name || "",
      email: initialData.userSetup?.email || "",
      phone: initialData.userSetup?.phone || "",
      title: initialData.userSetup?.title || "",
      designations: initialData.userSetup?.designations || [],
      headshot: initialData.userSetup?.headshot || "",
      headshotData: initialData.userSetup?.headshotData || null,
      userBackgroundImage: initialData.userSetup?.backgroundImage || "",
    });
    onClose();
  };

  const updateField = (field: string, value: any) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleServiceToggle = (service: ServiceType) => {
    setEditData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s: ServiceType) => s !== service)
        : [...prev.services, service],
      customService:
        service === ServiceType.OTHER && prev.services.includes(service)
          ? ""
          : prev.customService,
    }));
  };

  const replacePlaceholders = (text: string) => {
    return text
      .replace(
        /<Organization_Name>/g,
        editData.organizationName || "Your Organization",
      )
      .replace(/<Client_Name>/g, "Your Company");
  };

  const handleWelcomeStatementChange = (value: string) => {
    if (value === "default") {
      updateField("useDefaultWelcomeStatement", true);
      updateField(
        "missionStatement",
        replacePlaceholders(DEFAULT_WELCOME_STATEMENT),
      );
    } else {
      updateField("useDefaultWelcomeStatement", false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit organization & profile
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="user-profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger
              value="user-profile"
              className="flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="user-setup" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              User
            </TabsTrigger>
          </TabsList>

          {/* User Profile Tab */}
          <TabsContent value="user-profile" className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="organizationType">
                Organization Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={editData.organizationType}
                onValueChange={(value) =>
                  updateField("organizationType", value as OrganizationType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OrganizationType.INDEPENDENT}>
                    Independent Advisor
                  </SelectItem>
                  <SelectItem value={OrganizationType.BROKER}>
                    Broker
                  </SelectItem>
                  <SelectItem value={OrganizationType.RIA}>
                    RIA (Registered Investment Advisor)
                  </SelectItem>
                  <SelectItem value={OrganizationType.HYBRID}>
                    Hybrid
                  </SelectItem>
                  <SelectItem value={OrganizationType.INSURANCE}>
                    Insurance
                  </SelectItem>
                  <SelectItem value={OrganizationType.RECORDKEEPER}>
                    Recordkeeper
                  </SelectItem>
                  <SelectItem value={OrganizationType.PLAN_SPONSOR}>
                    Plan Sponsor
                  </SelectItem>
                  <SelectItem value={OrganizationType.OTHER}>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editData.organizationType === OrganizationType.OTHER && (
              <div className="space-y-2">
                <Label htmlFor="customOrganization">
                  Describe Your Organization *
                </Label>
                <Input
                  id="customOrganization"
                  value={editData.customOrganization}
                  onChange={(e) =>
                    updateField("customOrganization", e.target.value)
                  }
                  placeholder="Please describe your organization"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="teamSize">
                Team Size <span className="text-red-500">*</span>
              </Label>
              <Select
                value={editData.teamSize}
                onValueChange={(value) => updateField("teamSize", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="just_me">Just me</SelectItem>
                  <SelectItem value="2_5">2-5 people</SelectItem>
                  <SelectItem value="6_20">6-20 people</SelectItem>
                  <SelectItem value="enterprise">
                    Enterprise (20+ people)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6 py-4">
            <div className="space-y-4">
              <Label>
                Which service do you offer to employers? (Select all that apply)
              </Label>
              <div className="space-y-3">
                {serviceOptions.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-start space-x-3"
                  >
                    <Checkbox
                      id={option.value}
                      checked={editData.services.includes(option.value)}
                      onCheckedChange={() => handleServiceToggle(option.value)}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor={option.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </Label>
                      {option.description ? (
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {editData.services.includes(ServiceType.OTHER) && (
              <div className="space-y-2">
                <Label htmlFor="customService">
                  Other Benefits (Custom Input) *
                </Label>
                <Input
                  id="customService"
                  value={editData.customService}
                  onChange={(e) => updateField("customService", e.target.value)}
                  placeholder="Please specify other benefits"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  {editData.customService.length}/50 characters
                </p>
              </div>
            )}
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="organizationName"
                value={editData.organizationName}
                onChange={(e) =>
                  updateField("organizationName", e.target.value)
                }
                placeholder="Enter your organization name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">
                Organization Website <span className="text-red-500">*</span>
              </Label>
              <Input
                id="website"
                value={editData.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="Enter organization website"
                type="text"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Brand Color <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center space-x-2 relative">
                <Input
                  value={editData.brandColor}
                  onChange={(e) => updateField("brandColor", e.target.value)}
                  placeholder="#1F3A60"
                  className="max-w-32"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className="h-10 px-3"
                >
                  <div
                    className="w-6 h-6 rounded border"
                    style={{
                      backgroundColor: editData.brandColor || "#1F3A60",
                    }}
                  />
                </Button>
                <ColorPicker
                  value={editData.brandColor}
                  onChange={(color) => updateField("brandColor", color)}
                  isOpen={isColorPickerOpen}
                  onOpenChange={setIsColorPickerOpen}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>
                Benefits Hub Welcome Statement{" "}
                <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                This message introduces your firm to employers and participants
                via the branded benefits hub. Keep it clear, welcoming, and
                aligned with your brand voice.
              </p>

              <RadioGroup
                value={
                  editData.useDefaultWelcomeStatement ? "default" : "custom"
                }
                onValueChange={handleWelcomeStatementChange}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="default" id="default" />
                  <Label htmlFor="default">Use default welcome statement</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom">Write custom welcome statement</Label>
                </div>
              </RadioGroup>

              <Textarea
                value={editData.missionStatement}
                onChange={(e) =>
                  updateField("missionStatement", e.target.value)
                }
                placeholder="Enter your welcome statement..."
                rows={6}
                disabled={editData.useDefaultWelcomeStatement}
              />
            </div>

            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <UploadInput
                id="logo"
                value={editData.logo}
                onChange={(value) => updateField("logo", value)}
                accept="image/*"
                placeholder="Upload organization logo"
                fileName=""
                onRemove={async () => {
                  await deleteFromR2(editData.logo);
                  updateField("logo", "");
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Background Image</Label>
              <UploadInput
                id="backgroundImage"
                value={editData.backgroundImage}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const result = e.target?.result as string;
                      updateField("backgroundImage", result);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                accept="image/*"
                placeholder="Upload background image"
                fileName=""
                onRemove={() => updateField("backgroundImage", "")}
              />
            </div>
          </TabsContent>

          {/* User Setup Tab */}
          <TabsContent value="user-setup" className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={editData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editData.phone}
                  onChange={(e) => {
                    // Format phone number as user types
                    let value = e.target.value.replace(/\D/g, ""); // Remove non-digits
                    if (value.length >= 6) {
                      value = value.replace(
                        /(\d{3})(\d{3})(\d{4})/,
                        "($1) $2-$3",
                      );
                    } else if (value.length >= 3) {
                      value = value.replace(/(\d{3})(\d{0,3})/, "($1) $2");
                    }
                    updateField("phone", value);
                  }}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editData.title}
                  onValueChange={(value) => updateField("title", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your title" />
                  </SelectTrigger>
                  <SelectContent>
                    {getTitleOptionsByOrgType(editData.organizationType).map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Designations (Optional)</Label>
              <MultiSelectDropdown
                options={designationOptions}
                selectedValues={editData.designations}
                onSelectionChange={(values) =>
                  updateField("designations", values)
                }
                placeholder="Select designations..."
                allowCustomInput={true}
                customInputPlaceholder="Add custom designation"
              />
            </div>

            <div className="space-y-2">
              <Label>Headshot</Label>
              <div className="flex items-start gap-3">
                <UniversalImageEditorModal
                  type="headshot"
                  value={editData.headshot || ""}
                  fileName=""
                  onChange={(value, fileName) => {
                    updateField("headshot", value);
                  }}
                  onRemove={() => {
                    updateField("headshot", "");
                  }}
                  placeholder="Upload Headshot"
                />
                <div className="pt-1">
                  <div className="w-12 h-12 rounded-full overflow-hidden border relative">
                    <Headshot
                      src={
                        editData.headshotData?.avatar?.["64"] ||
                        editData.headshotData?.circle?.["400"] ||
                        editData.headshotData?.square?.["400"] ||
                        (typeof editData.headshot === "string"
                          ? editData.headshot
                          : editData.headshot?.original_url) ||
                        undefined
                      }
                      monogramName={editData.name}
                      alt="Headshot preview"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Background Image (Optional)</Label>
              <UniversalImageEditorModal
                type="logo"
                value={editData.userBackgroundImage || ""}
                fileName=""
                onChange={(value, fileName) => {
                  updateField("userBackgroundImage", value);
                }}
                onRemove={() => {
                  updateField("userBackgroundImage", "");
                }}
                placeholder="Upload Background Image"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
