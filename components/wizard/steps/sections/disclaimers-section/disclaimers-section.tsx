"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, FileText, Edit2, Trash2 } from "lucide-react";

interface DisclaimersSectionProps {
  disclaimers: string[];
  onDisclaimersChange: (disclaimers: string[]) => void;
}

type DisclaimerType =
  | "benefits_hub"
  | "open_enrollment_video"
  | "marketing_materials"
  | "other";

interface DisclaimerOption {
  type: DisclaimerType;
  label: string;
  required?: boolean;
}

export function DisclaimersSection({
  disclaimers,
  onDisclaimersChange,
}: DisclaimersSectionProps) {
  const [selectedTypes, setSelectedTypes] = useState<DisclaimerType[]>([]);
  const [customDisclaimer, setCustomDisclaimer] = useState("");
  const [addTiming, setAddTiming] = useState<"now" | "later" | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const disclaimerOptions: DisclaimerOption[] = [
    { type: "benefits_hub", label: "Benefits Hub / Client Website Disclaimer" },
    {
      type: "open_enrollment_video",
      label: "Open Enrollment Video Disclaimer",
      required: true,
    },
    {
      type: "marketing_materials",
      label: "Marketing Materials Disclaimer",
      required: true,
    },
    { type: "other", label: "Other (please specify)" },
  ];

  const handleTypeToggle = (type: DisclaimerType) => {
    const newSelectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];

    setSelectedTypes(newSelectedTypes);
  };

  const validateSelection = () => {
    const hasRequired =
      selectedTypes.includes("open_enrollment_video") &&
      selectedTypes.includes("marketing_materials");

    if (!hasRequired) {
      toast.error(
        "Open Enrollment Video Disclaimer, Marketing Materials Disclaimer needed",
      );
      return false;
    }
    return true;
  };

  const handleAddNow = () => {
    if (!validateSelection()) return;

    setAddTiming("now");
    // Add selected disclaimers
    const newDisclaimers = [...disclaimers];
    selectedTypes.forEach((type) => {
      if (type === "other" && customDisclaimer.trim()) {
        newDisclaimers.push(customDisclaimer.trim());
      } else if (type !== "other") {
        const option = disclaimerOptions.find((opt) => opt.type === type);
        if (option) {
          newDisclaimers.push(option.label);
        }
      }
    });
    onDisclaimersChange(newDisclaimers);

    toast.success(`${selectedTypes.length} disclaimer(s) added successfully`);

    // Reset selection after adding
    setSelectedTypes([]);
    setCustomDisclaimer("");
  };

  const handleAddLater = () => {
    if (!validateSelection()) return;

    setAddTiming("later");

    toast.info(
      "Disclaimers skipped - you can add them later in your profile settings",
    );
  };

  const updateDisclaimer = (index: number, value: string) => {
    const newDisclaimers = [...disclaimers];
    newDisclaimers[index] = value;
    onDisclaimersChange(newDisclaimers);
  };

  const removeDisclaimer = (index: number) => {
    const newDisclaimers = disclaimers.filter((_, i) => i !== index);
    onDisclaimersChange(newDisclaimers);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(disclaimers[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      updateDisclaimer(editingIndex, editText);
      setEditingIndex(null);
      setEditText("");
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">Add Disclaimers</CardTitle>
        <p className="text-muted-foreground">
          Provide the compliance language that should appear on participant and
          client-facing materials.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection Section */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Select all that apply</Label>

          <div className="space-y-3">
            {disclaimerOptions.map((option) => (
              <div key={option.type} className="flex items-start space-x-3">
                <Checkbox
                  id={option.type}
                  checked={selectedTypes.includes(option.type)}
                  onCheckedChange={() => handleTypeToggle(option.type)}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor={option.type}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                    {option.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Input */}
          {selectedTypes.includes("other") && (
            <div className="space-y-2">
              <Input
                value={customDisclaimer}
                onChange={(e) => setCustomDisclaimer(e.target.value)}
                placeholder="Please specify other disclaimer"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {customDisclaimer.length}/50 characters
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {selectedTypes.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={handleAddNow} className="w-auto">
                Add Now
              </Button>
              <Button
                variant="outline"
                onClick={handleAddLater}
                className="w-auto"
              >
                Add Later
              </Button>
            </div>
          </div>
        )}

        {/* Existing Disclaimers */}
        {disclaimers.length > 0 && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Added Disclaimers</h4>
              <div className="space-y-3">
                {disclaimers.map((disclaimer, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md">
                    {editingIndex === index ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder="Enter disclaimer text..."
                          rows={3}
                          className="resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            className="text-xs w-auto"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            className="text-xs w-auto"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <p className="text-sm flex-1">{disclaimer}</p>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(index)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeDisclaimer(index)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
