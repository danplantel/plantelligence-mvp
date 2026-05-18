"use client";

import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DragDropUpload } from "@/components/ui/drag-drop-upload";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { InfoBlock } from "@/components/ui/info-block";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DocumentData, SbcFile } from "@/types/new-client-wizard";
import { ServiceType } from "@/types/wizard";

interface DocumentDataWithFiles {
  spdFile: any; // Json object
  otherDocuments: any[]; // Array of Json objects
  spdFileObj: File | null;
}

// Helper function to get dynamic helper text based on service type
const getHelperText = (serviceType: string | null): string => {
  switch (serviceType) {
    case ServiceType.RETIREMENT:
      return "Upload your SPD (Summary Plan Description) or Plan Highlights Document here. Additional documents are optional.";
    case ServiceType.GROUP_HEALTH:
    case ServiceType.GROUP_LIFE_DISABILITY:
      return "Upload your SBC (Summary of Benefits & Coverage), COC/EOC (Certificate/Evidence of Coverage), Wrap SPD, or other benefits documents here. Additional documents are optional.";
    case ServiceType.OTHER:
      return "Upload the required documents for this client. Additional documents are optional.";
    default:
      return "Upload the required documents for this client. Additional documents are optional.";
  }
};

// Helper function to get dynamic SPD label based on service type
const getSPDLabel = (serviceType: string | null): string => {
  switch (serviceType) {
    case ServiceType.RETIREMENT:
      return "SPD (Summary Plan Description) or Plan Highlights Document";
    case ServiceType.GROUP_HEALTH:
    case ServiceType.GROUP_LIFE_DISABILITY:
      return "SBC (Summary of Benefits & Coverage), COC/EOC (Certificate/Evidence of Coverage), or Wrap SPD";
    case ServiceType.OTHER:
      return "Required documents for this client";
    default:
      return "SPD (Summary Plan Description)";
  }
};

// Helper function to get default SPD title based on service type
const getDefaultSPDTitle = (serviceType: string | null): string => {
  switch (serviceType) {
    case ServiceType.RETIREMENT:
      return "SPD (Summary Plan Description)";
    case ServiceType.GROUP_HEALTH:
    case ServiceType.GROUP_LIFE_DISABILITY:
      return "SBC (Summary of Benefits & Coverage)";
    case ServiceType.OTHER:
      return "Required Document";
    default:
      return "SPD (Summary Plan Description)";
  }
};

export function NewClientStep2() {
  const { stepData, saveStepDataLocally, loadOnboardingData } =
    useNewClientWizardStore();

  const [documentData, setDocumentData] = useState<DocumentDataWithFiles>({
    spdFile: null,
    otherDocuments: [],
    spdFileObj: null,
  });

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isLoadingService, setIsLoadingService] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      // Only load data if it exists, otherwise start with empty data
      if (stepData?.documentData) {
        setDocumentData({
          ...stepData.documentData,
          spdFileObj: null,
        });
      } else {
        // Start with empty document data for new client
        setDocumentData({
          spdFile: null,
          otherDocuments: [],
          spdFileObj: null,
        });
      }
      initialized.current = true;
    }
  }, [stepData?.documentData]);

  // Save document data to stepData for validation (but not to server)
  useEffect(() => {
    if (initialized.current) {
      saveStepDataLocally("documentData", documentData);
    }
  }, [documentData, saveStepDataLocally]);

  // Load onboarding service data
  useEffect(() => {
    const loadService = async () => {
      try {
        const onboardingData = await loadOnboardingData();

        // Fallback: if no service found, use 'retirement' as default
        if (!onboardingData) {
          setSelectedService("retirement");
        } else {
          // Handle both old format (string) and new format (object with service property)
          const service = typeof onboardingData === 'string' 
            ? onboardingData 
            : onboardingData.service;
          setSelectedService(service);
        }

        setIsLoadingService(false);
      } catch (error) {
        console.error("Failed to load onboarding service:", error);
        // Fallback on error
        setSelectedService("retirement");
        setIsLoadingService(false);
      }
    };

    loadService();
  }, [loadOnboardingData]);

  const handleFileUpload = (field: "spdFile" | "sbcFile", file: File) => {
    // Check for duplicates
    if (field === "spdFile") {
      // For SPD file, check if it's the same as current one
      if (
        documentData.spdFileObj?.name === file.name &&
        documentData.spdFileObj?.size === file.size
      ) {
        return; // Silently ignore duplicate
      }
    } else if (field === "sbcFile") {
      // For SBC files, check if file already exists
      const existingFiles = documentData.otherDocuments || [];
      const isDuplicate = existingFiles.some(
        (existingFile) =>
          existingFile.fileName === file.name &&
          existingFile.fileObj?.size === file.size,
      );

      if (isDuplicate) {
        return; // Silently ignore duplicate
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;

      // Keep the full data URL (don't extract base64 part)
      // This ensures proper format when saving to database
      const fileData = result;

      if (field === "spdFile") {
        setDocumentData((prev) => ({
          ...prev,
          spdFile: {
            file: fileData,
            fileName: file.name,
            title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default title
          },
          spdFileObj: file,
        }));
      } else if (field === "sbcFile") {
        // Add new SBC file to array
        const newSbcFile: SbcFile = {
          file: fileData,
          fileName: file.name,
          title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default title
          fileObj: file,
        };

        setDocumentData((prev) => ({
          ...prev,
          otherDocuments: [...(prev.otherDocuments || []), newSbcFile],
        }));
      }
    };

    reader.onerror = (e) => {
      console.error("❌ FileReader error:", e);
    };

    reader.readAsDataURL(file);
  };

  const handleMultipleFilesUpload = (files: File[]) => {
    const maxFiles = 5;
    const currentFileCount = documentData.otherDocuments?.length || 0;
    const availableSlots = maxFiles - currentFileCount;

    if (availableSlots <= 0) {
      return; // Silently ignore if no slots available
    }

    // Filter out duplicate files
    const existingFiles = documentData.otherDocuments || [];
    const uniqueFiles = files.filter((newFile) => {
      // Check if file with same name and size already exists
      return !existingFiles.some(
        (existingFile) =>
          existingFile.fileName === newFile.name &&
          existingFile.fileObj?.size === newFile.size,
      );
    });

    // Take only the number of unique files that fit within the limit
    const filesToProcess = uniqueFiles.slice(0, availableSlots);

    // Process each file
    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Extract base64 part from data URL (remove "data:mime/type;base64," prefix)
        const base64Data = result.split(",")[1] || result;
        const newSbcFile: SbcFile = {
          file: base64Data,
          fileName: file.name,
          title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default title
          fileObj: file,
        };

        setDocumentData((prev) => ({
          ...prev,
          otherDocuments: [...(prev.otherDocuments || []), newSbcFile],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileRemove = (field: "spdFile" | "sbcFile", index?: number) => {
    if (field === "spdFile") {
      setDocumentData((prev) => ({
        ...prev,
        spdFile: null,
        spdFileObj: null,
      }));
    } else if (field === "sbcFile" && index !== undefined) {
      setDocumentData((prev) => ({
        ...prev,
        otherDocuments: (prev.otherDocuments || []).filter(
          (_, i) => i !== index,
        ),
      }));
    }
  };

  const handleSbcTitleChange = (index: number, title: string) => {
    setDocumentData((prev) => ({
      ...prev,
      otherDocuments: prev.otherDocuments.map((file, i) =>
        i === index ? { ...file, title } : file,
      ),
    }));
  };

  if (isLoadingService) {
    return (
      <div className="space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Required Documents</CardTitle>
            <p className="text-muted-foreground">
              Loading service information...
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Required Documents</CardTitle>
          <p className="text-muted-foreground">
            {getHelperText(selectedService)}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SPD Field - Always visible */}
          <DragDropUpload
            id="spd-upload"
            title={getSPDLabel(selectedService)}
            value={documentData.spdFile}
            fileName={(documentData.spdFile as any)?.fileName || ""}
            file={documentData.spdFileObj || undefined}
            onChange={(file) => handleFileUpload("spdFile", file)}
            onRemove={() => handleFileRemove("spdFile")}
            accept=".pdf,.doc,.docx"
            required
          />

          {/* SPD Title Field */}
          {documentData.spdFile && (
            <div className="space-y-2">
              <Label htmlFor="spd-title">Document Title</Label>
              <Input
                id="spd-title"
                value={(documentData.spdFile as any)?.title || ""}
                onChange={(e) =>
                  setDocumentData((prev) => ({
                    ...prev,
                    spdFile: prev.spdFile
                      ? {
                          ...(prev.spdFile as any),
                          title: e.target.value,
                        }
                      : null,
                  }))
                }
                placeholder="Enter document title"
              />
            </div>
          )}

          {/* Other Documents - Multiple files support */}
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium text-sm">
                Other Documents
              </label>
              <p className="mb-4 text-muted-foreground text-xs">
                Upload up to 5 additional documents (PDF, DOC, DOCX)
              </p>

              {/* Upload area */}
              {(documentData.otherDocuments?.length || 0) < 5 && (
                <MultiFileUpload
                  id="sbc-upload"
                  title="Add Other Documents"
                  onFilesChange={handleMultipleFilesUpload}
                  accept=".pdf,.doc,.docx"
                  maxFiles={5}
                  currentFileCount={documentData.otherDocuments?.length || 0}
                  required={false}
                />
              )}

              {/* Display uploaded files */}
              {(documentData.otherDocuments?.length || 0) > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="font-medium text-sm">
                    Uploaded Other Documents (
                    {documentData.otherDocuments?.length || 0}/5):
                  </p>
                  {(documentData.otherDocuments || []).map((sbcFile, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {sbcFile.fileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileRemove("sbcFile", index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`sbc-title-${index}`}>
                          Document Title
                        </Label>
                        <Input
                          id={`sbc-title-${index}`}
                          value={sbcFile.title}
                          onChange={(e) =>
                            handleSbcTitleChange(index, e.target.value)
                          }
                          placeholder="Enter document title"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Block */}
      <InfoBlock
        variant="default"
        title="Automatic Organization"
        description="Files uploaded here will automatically be tagged and organized into your portal's 'Plan Materials' library by type for easy participant access."
      />
    </div>
  );
}
