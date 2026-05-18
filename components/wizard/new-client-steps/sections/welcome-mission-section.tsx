"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WelcomeStatementData } from "@/types/new-client-wizard";

type MissionFields = {
  missionHeadline?: string | null;
  missionBody?: string | null;
};

interface WelcomeMissionSectionProps {
  welcomeData: WelcomeStatementData;
  companyData: MissionFields;
  onWelcomeDescriptionChange: (value: string) => void;
  onMissionFieldChange: (
    field: "missionHeadline" | "missionBody",
    value: string,
  ) => void;
  companyName?: string;
  onCompanyNameChange?: (value: string) => void;
  onGenerateStatement?: () => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
  useDefaultBody?: boolean;
  onToggleDefaultBody?: (checked: boolean) => void;
  defaultBodyText?: string;
  headlineCharCount?: number;
  bodyCharCount?: number;
  isHeadlineValid?: boolean;
  isBodyValid?: boolean;
  onGenerateMissionStatement?: () => void;
  onGenerateMissionHeadline?: () => void;
  onGenerateMissionBody?: () => void;
  missionGenerationLimitReached?: boolean;
  errorFields?: string[];
  useDefaultHeadline?: boolean;
  onToggleDefaultHeadline?: (checked: boolean) => void;
  defaultHeadline?: string;
}

export function WelcomeMissionSection({
  welcomeData,
  companyData,
  onWelcomeDescriptionChange,
  onMissionFieldChange,
  companyName,
  onCompanyNameChange,
  onGenerateStatement,
  onGenerateAI,
  isGenerating = false,
  useDefaultBody = false,
  onToggleDefaultBody,
  defaultBodyText,
  headlineCharCount,
  bodyCharCount,
  isHeadlineValid,
  isBodyValid,
  onGenerateMissionStatement,
  onGenerateMissionHeadline,
  onGenerateMissionBody,
  missionGenerationLimitReached,
  errorFields = [],
  useDefaultHeadline = false,
  onToggleDefaultHeadline,
  defaultHeadline,
}: WelcomeMissionSectionProps) {
  // Company Mission Statement uses its own independent data
  const missionHeadline = companyData.missionHeadline ?? "";
  const missionBody = companyData.missionBody ?? "";
  const [isEditCompanyNameOpen, setIsEditCompanyNameOpen] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState(companyName || "");

  // Sync editedCompanyName when companyName changes
  useEffect(() => {
    setEditedCompanyName(companyName || "");
  }, [companyName]);

  useEffect(() => {
    if (useDefaultBody) {
      onToggleDefaultBody?.(true);
    } else {
      onToggleDefaultBody?.(false);
    }
  }, []);

  // Scroll to top when component mounts (when navigating from previous step)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSaveCompanyName = () => {
    if (onCompanyNameChange) {
      onCompanyNameChange(editedCompanyName);
    }
    setIsEditCompanyNameOpen(false);
  };

  const computedHeadlineCount =
    headlineCharCount ?? welcomeData.headline.length;
  const computedBodyCount = bodyCharCount ?? welcomeData.bodyText.length;
  const computedHeadlineValid = isHeadlineValid ?? computedHeadlineCount <= 60;
  const computedBodyValid =
    isBodyValid ?? (computedBodyCount >= 250 && computedBodyCount <= 500);
  const handleBodyChange = (value: string) => {
    onToggleDefaultBody?.(false);
    onWelcomeDescriptionChange(value);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-blue" />
                Welcome Statement
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Banner Headline</Label>
                  {(onGenerateStatement || onGenerateAI) && (
                    <span className="text-sm text-muted-foreground">
                      This is the introduction on your Employee Benefits Hub
                    </span>
                  )}
                </div>
                {onCompanyNameChange && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedCompanyName(companyName || "");
                      setIsEditCompanyNameOpen(true);
                    }}
                    className="flex items-center gap-2 h-7 text-xs"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit Banner Headline
                  </Button>
                )}
              </div>
              <Input
                value={welcomeData.headline}
                readOnly
                disabled
                data-field="headline"
                destructive={errorFields.includes("headline")}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Label>
                    Welcome Message<span className="text-red-500">*</span>
                  </Label>
                  {onToggleDefaultBody && defaultBodyText && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useDefaultBody"
                        checked={useDefaultBody}
                        onCheckedChange={(checked) =>
                          onToggleDefaultBody(Boolean(checked))
                        }
                      />
                      <Label
                        htmlFor="useDefaultBody"
                        className="text-sm cursor-pointer"
                      >
                        Use default
                      </Label>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${computedBodyValid
                      ? "text-muted-foreground"
                      : "text-red-500"
                      }`}
                  >
                    {computedBodyCount}/500 characters
                  </span>
                  {!computedBodyValid && (
                    <Badge variant="destructive" className="text-xs">
                      {computedBodyCount < 250 ? "Too short" : "Too long"}
                    </Badge>
                  )}
                </div>
              </div>
              <Textarea
                value={welcomeData.bodyText}
                onChange={(e) => handleBodyChange(e.target.value)}
                rows={5}
                maxLength={500}
                placeholder="This is the introduction on your Employee Benefits Hub"
                data-field="bodyText"
                destructive={errorFields.includes("bodyText")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-blue" />
              Company Mission Statement
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Mission Headline *</Label>
                  {onToggleDefaultHeadline && defaultHeadline && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="useDefaultHeadline"
                        checked={useDefaultHeadline}
                        onCheckedChange={(checked) =>
                          onToggleDefaultHeadline(Boolean(checked))
                        }
                      />
                      <Label
                        htmlFor="useDefaultHeadline"
                        className="text-sm cursor-pointer"
                      >
                        Use default
                      </Label>
                    </div>
                  )}
                </div>
                {onGenerateMissionHeadline && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGenerateMissionHeadline}
                    className="flex items-center gap-2 h-7 text-xs"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate with AI
                  </Button>
                )}
              </div>
              <Input
                value={missionHeadline}
                onChange={(e) => {
                  onMissionFieldChange("missionHeadline", e.target.value);
                }}
                maxLength={60}
                placeholder="We care about people. We value teamwork. We deliver results."
                data-field="missionHeadline"
                destructive={errorFields.includes("missionHeadline")}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mission Statement *</Label>
                {onGenerateMissionBody && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGenerateMissionBody}
                    className="flex items-center gap-1.5 h-7 text-xs whitespace-nowrap"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate with AI
                  </Button>
                )}
              </div>
              <Textarea
                value={missionBody}
                onChange={(e) => {
                  onMissionFieldChange("missionBody", e.target.value);
                }}
                rows={6}
                maxLength={800}
                placeholder="Share the bigger mission behind your organization..."
                data-field="missionBody"
                destructive={errorFields.includes("missionBody")}
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${missionBody.length >= 250 && missionBody.length <= 800 ? "text-muted-foreground" : "text-red-500"}`}>
                  {missionBody.length}/800 characters
                </p>
                {missionBody.length > 0 && (missionBody.length < 250 || missionBody.length > 800) && (
                  <Badge variant="destructive" className="text-xs">
                    {missionBody.length < 250 ? "Too short (min 250)" : "Too long (max 800)"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {missionGenerationLimitReached && (
            <p className="text-xs text-amber-600">
              Generation limit reached. Cycling through previous selections.
            </p>
          )}
        </CardContent>

        <Dialog
          open={isEditCompanyNameOpen}
          onOpenChange={setIsEditCompanyNameOpen}
        >
          <DialogContent className="z-[52]">
            <DialogHeader>
              <DialogTitle>Edit Banner Headline</DialogTitle>
              <DialogDescription>
                Update the Benefits Hub name. This will automatically update the
                banner headline in preview.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Benefits Hub Name</Label>
                <Input
                  id="companyName"
                  value={editedCompanyName}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 65);
                    setEditedCompanyName(value);
                  }}
                  placeholder="Enter company name"
                  maxLength={65}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editedCompanyName.length}/65 characters
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditCompanyNameOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveCompanyName}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );
}
