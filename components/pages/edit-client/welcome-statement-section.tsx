"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Edit3,
} from "lucide-react";

interface WelcomeStatementData {
  headline: string;
  bodyText: string;
  isAIGenerated: boolean;
}

interface WelcomeStatementSectionProps {
  welcomeData: WelcomeStatementData;
  onDataChange: (field: keyof WelcomeStatementData, value: any) => void;
  companyData: any; // CompanyBasicsData
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
}

export function WelcomeStatementSection({
  welcomeData,
  onDataChange,
  companyData,
  isOpen,
  onToggle,
  validationErrors = {},
}: WelcomeStatementSectionProps) {
  const [useDefaultHeadline, setUseDefaultHeadline] = useState(false);
  const [useDefaultBody, setUseDefaultBody] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);

  // Default text
  const defaultHeadline =
    "We care about people. We build trust. We deliver results.";
  const defaultBodyText =
    "At our core, we believe people are the heart of every success. We're committed to creating a workplace where every individual feels valued, supported, and inspired to thrive. Together, we celebrate teamwork, growth, and shared purpose—because when our people succeed, we all do.";

  const headlineRef = useRef<HTMLInputElement>(null);

  // Handle default text logic
  const handleUseDefaultHeadline = (checked: boolean) => {
    setUseDefaultHeadline(checked);
    if (checked) {
      onDataChange("headline", defaultHeadline);
    }
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      onDataChange("bodyText", defaultBodyText);
    }
  };

  // Handle input changes
  const handleHeadlineChange = (value: string) => {
    onDataChange("headline", value);
    if (useDefaultHeadline && value !== defaultHeadline) {
      setUseDefaultHeadline(false);
    }
  };

  const handleBodyChange = (value: string) => {
    onDataChange("bodyText", value);
    if (useDefaultBody && value !== defaultBodyText) {
      setUseDefaultBody(false);
    }
  };

  // Validation
  const isHeadlineValid = welcomeData.headline.length >= 10;
  const isBodyValid =
    welcomeData.bodyText.length >= 250 && welcomeData.bodyText.length <= 2000;

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Welcome Statement</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-accent-blue" />
                Welcome Message
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Create a personalized welcome message for your employees
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="headline" className="text-sm font-medium">
                    Headline *
                  </Label>
                  <Checkbox
                    id="use-default-headline"
                    checked={useDefaultHeadline}
                    onCheckedChange={handleUseDefaultHeadline}
                  />
                  <Label
                    htmlFor="use-default-headline"
                    className="text-sm text-gray-600"
                  >
                    Use default
                  </Label>
                </div>
                <Input
                  id="headline"
                  ref={headlineRef}
                  value={welcomeData.headline}
                  onChange={(e) => handleHeadlineChange(e.target.value)}
                  placeholder={
                    useDefaultHeadline ? defaultHeadline : "Enter your headline"
                  }
                  maxLength={100}
                  className={`mt-2 ${
                    useDefaultHeadline &&
                    welcomeData.headline === defaultHeadline
                      ? "text-gray-500"
                      : ""
                  } ${
                    validationErrors.headline
                      ? "border-red-500 focus:border-red-500"
                      : ""
                  }`}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {welcomeData.headline.length}/100 characters
                </div>
                {validationErrors.headline && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.headline[0]}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {isHeadlineValid ? (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-200"
                    >
                      ✓ Valid
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-red-600 border-red-200"
                    >
                      Minimum 10 characters
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="bodyText" className="text-sm font-medium">
                    Body Text *
                  </Label>
                  <Checkbox
                    id="use-default-body"
                    checked={useDefaultBody}
                    onCheckedChange={handleUseDefaultBody}
                  />
                  <Label
                    htmlFor="use-default-body"
                    className="text-sm text-gray-600"
                  >
                    Use default
                  </Label>
                </div>
                <Textarea
                  id="bodyText"
                  value={welcomeData.bodyText}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder={
                    useDefaultBody ? defaultBodyText : "Enter your message"
                  }
                  maxLength={2000}
                  className={`mt-2 min-h-[120px] ${
                    useDefaultBody && welcomeData.bodyText === defaultBodyText
                      ? "text-gray-500"
                      : ""
                  } ${
                    validationErrors.bodyText
                      ? "border-red-500 focus:border-red-500"
                      : ""
                  }`}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {welcomeData.bodyText.length}/2000 characters (250-2000
                  recommended)
                </div>
                {validationErrors.bodyText && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.bodyText[0]}
                  </p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    {isBodyValid ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-200"
                      >
                        ✓ Valid
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-red-600 border-red-200"
                      >
                        {welcomeData.bodyText.length < 250
                          ? `Minimum 250 characters (${welcomeData.bodyText.length}/250)`
                          : `Maximum 2000 characters (${welcomeData.bodyText.length}/2000)`}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {welcomeData.bodyText.length}/2000 characters
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}
