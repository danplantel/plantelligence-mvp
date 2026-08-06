"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { Headshot } from "@/components/ui/headshot";
import { ContactType } from "@/types/new-client-wizard";
import { SupportHoursTimePicker } from "./support-hours-time-picker";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactFormFieldsProps {
  contactType: ContactType;
  // Individual fields
  firstName: string;
  lastName: string;
  title: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  // Team/Support fields
  displayName: string;
  departmentLabel: string;
  supportHours: string;
  onDisplayNameChange: (value: string) => void;
  onDepartmentLabelChange: (value: string) => void;
  onSupportHoursChange: (value: string) => void;
  // Headshot
  headshot: string;
  headshotFileName: string;
  onHeadshotChange: (value: string, fileName: string) => void;
  onHeadshotRemove: () => void;
  // Team Image
  teamImage?: string;
  teamImageFileName?: string;
  onTeamImageChange?: (value: string, fileName: string) => void;
  onTeamImageRemove?: () => void;
  onDefaultTeamImageClick?: () => void;
  // Refs
  firstNameRef?: React.RefObject<HTMLInputElement>;
  lastNameRef?: React.RefObject<HTMLInputElement>;
  titleRef?: React.RefObject<HTMLInputElement>;
  // Errors
  errorFields?: string[];
  // Disabled state
  disabled?: boolean;
  // Hide the circular headshot preview that appears to the right of the uploader
  hideHeadshotPreview?: boolean;
}

export function ContactFormFields({
  contactType,
  firstName,
  lastName,
  title,
  onFirstNameChange,
  onLastNameChange,
  onTitleChange,
  displayName,
  departmentLabel,
  supportHours,
  onDisplayNameChange,
  onDepartmentLabelChange,
  onSupportHoursChange,
  headshot,
  headshotFileName,
  onHeadshotChange,
  onHeadshotRemove,
  teamImage,
  teamImageFileName,
  onTeamImageChange,
  onTeamImageRemove,
  onDefaultTeamImageClick,
  firstNameRef,
  lastNameRef,
  titleRef,
  errorFields = [],
  disabled = false,
  hideHeadshotPreview = false,
}: ContactFormFieldsProps) {
  return (
    <>
      {/* Headshot (optional) - only for Individual contacts */}
      {contactType === "individual" && (
        <div className="space-y-2" data-field="headshot">
          <Label className="dark:text-gray-300">Headshot (optional)</Label>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
                <UniversalImageEditorModal
                  value={headshot || ""}
                  fileName={headshotFileName || ""}
                  onChange={(value, fileName) => {
                    if (!disabled) {
                      onHeadshotChange(value, fileName || "");
                    }
                  }}
                  onRemove={disabled ? () => { } : onHeadshotRemove}
                  placeholder="Upload Headshot"
                  modalTitle="Edit Headshot"
                  modalDescription="Upload a clear, front-facing photo. Keep the face inside the circle guide for best results."
                  saveButtonText="Save Headshot"
                  type="headshot"
                  autoSizeOnOpen={true}
                  forceCircularGuidelines={true}
                />
              </div>
            </div>
            {!hideHeadshotPreview && headshot && (
              <div className="-mt-2 h-16 w-16 rounded-full border border-gray-200 overflow-hidden dark:border-gray-600">
                <Headshot src={headshot} alt="Headshot preview" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual Contact Fields */}
      {contactType === "individual" && (
        <>
          {/* First Name */}
          <div className="space-y-2" data-field="firstName">
            <Label className="dark:text-gray-300">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              ref={firstNameRef}
              value={firstName}
              onChange={(e) => {
                if (!disabled) {
                  onFirstNameChange(e.target.value);
                }
              }}
              placeholder="First name"
              destructive={errorFields.some((field) =>
                field.includes("firstName"),
              )}
              className={cn(
                disabled ? "opacity-50 cursor-not-allowed" : "",
                "h-9 text-sm",
                "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
              )}
              disabled={disabled}
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2" data-field="lastName">
            <Label className="dark:text-gray-300">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              ref={lastNameRef}
              value={lastName}
              onChange={(e) => {
                if (!disabled) {
                  onLastNameChange(e.target.value);
                }
              }}
              placeholder="Last name"
              destructive={errorFields.some((field) =>
                field.includes("lastName"),
              )}
              className={cn(
                disabled ? "opacity-50 cursor-not-allowed" : "",
                "h-9 text-sm",
                "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
              )}
              disabled={disabled}
            />
          </div>

          {/* Title */}
          <div className="space-y-2" data-field="title">
            <Label className="dark:text-gray-300">
              Title <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                ref={titleRef}
                value={title}
                onChange={(e) => {
                  if (!disabled) {
                    const value = e.target.value.slice(0, 60);
                    onTitleChange(value);
                  }
                }}
                placeholder="Job title"
                maxLength={60}
                className={cn(
                  disabled && "opacity-50 cursor-not-allowed",
                  errorFields.some((field) => field.includes("title")) &&
                  "border-red-500",
                  "h-9 text-sm",
                  "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
                )}
                disabled={disabled}
              />
              <div
                className={cn(
                  "absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out",
                  title.length >= 35
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2 pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "text-xs transition-colors duration-300",
                    title.length >= 60
                      ? "text-red-500"
                      : "text-muted-foreground dark:text-gray-400",
                  )}
                >
                  {title.length}/60 characters
                </span>
              </div>
            </div>
            {errorFields.some((field) => field.includes("title")) && (
              <p className="text-xs text-red-500">Please enter a title</p>
            )}
          </div>
        </>
      )}

      {/* Team/Support Contact Fields */}
      {contactType === "team_support" && (
        <>
          {/* Team Image (optional) - only for Team/Support contacts */}
          <div className="space-y-2" data-field="teamImage">
            <Label className="dark:text-gray-300">Team Image (optional)</Label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className={cn("flex", disabled && "opacity-50 pointer-events-none")}>
                  <div className="flex-1 [&>div]:rounded-r-none [&>div]:border-r-0">
                    <UniversalImageEditorModal
                      value={teamImage || ""}
                      fileName={teamImageFileName || ""}
                      onChange={(value, fileName) => {
                        if (!disabled && onTeamImageChange) {
                          onTeamImageChange(value, fileName || "");
                        }
                      }}
                      onRemove={disabled || !onTeamImageRemove ? () => { } : onTeamImageRemove}
                      placeholder="Upload Team Image"
                      modalTitle="Edit Team Image"
                      modalDescription="Upload a clear image for your team or support line. Keep the image inside the circle guide for best results."
                      saveButtonText="Save Image"
                      type="headshot"
                      autoSizeOnOpen={true}
                      forceCircularGuidelines={true}
                    />
                  </div>
                  {onDefaultTeamImageClick && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onDefaultTeamImageClick}
                      disabled={disabled}
                      className="rounded-l-none border-l-0 h-9 px-3 text-accent-blue hover:text-accent-blue/80 bg-background dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-600 dark:border-gray-600"
                      title="Choose from gallery"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="ml-2 hidden sm:inline">Gallery</span>
                    </Button>
                  )}
                </div>
              </div>
              {teamImage && (
                <div className="-mt-2 h-16 w-16 rounded-full border border-gray-200 overflow-hidden dark:border-gray-600">
                  <Headshot src={teamImage} alt="Team image preview" />
                </div>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2" data-field="displayName">
            <Label className="dark:text-gray-300">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={displayName}
              onChange={(e) => {
                if (!disabled) {
                  onDisplayNameChange(e.target.value);
                }
              }}
              placeholder="e.g., HR Support Line"
              destructive={errorFields.some((field) =>
                field.includes("displayName"),
              )}
              className={cn(
                disabled ? "opacity-50 cursor-not-allowed" : "",
                "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
              )}
              disabled={disabled}
            />
          </div>

          {/* Department Label */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300">Department/Label (optional)</Label>
            <Input
              value={departmentLabel}
              onChange={(e) => {
                if (!disabled) {
                  onDepartmentLabelChange(e.target.value);
                }
              }}
              placeholder="e.g., Human Resources"
              className={cn(
                disabled ? "opacity-50 cursor-not-allowed" : "",
                "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
              )}
              disabled={disabled}
            />
          </div>

          {/* Support Hours */}
          <SupportHoursTimePicker
            value={supportHours}
            onChange={onSupportHoursChange}
            disabled={disabled}
          />
        </>
      )}
    </>
  );
}
