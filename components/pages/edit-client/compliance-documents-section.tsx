"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  CheckCircle,
  Save,
} from "lucide-react";
import { DragDropUpload } from "@/components/ui/drag-drop-upload";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import {
  RetirementDocumentsAccordion,
  type RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { recordKeepers } from "@/constants/data";
import { ComplianceDocumentsData, Document } from "@/types/new-client-wizard";
import {
  detectDocumentType,
  getDocumentDescription,
  guessLanguageFromDocument,
} from "@/lib/compliance-document-utils";

interface ComplianceDocumentsSectionProps {
  documentsData: ComplianceDocumentsData;
  onDataChange: (field: keyof ComplianceDocumentsData, value: any) => void;
  isOpen: boolean;
  onToggle: () => void;
  validationErrors?: Record<string, string[]>;
  /** When set, SPD and Replace file uploads go to R2 and store key instead of base64. */
  clientId?: string;
}

export function ComplianceDocumentsSection({
  documentsData,
  onDataChange,
  isOpen,
  onToggle,
  validationErrors = {},
  clientId,
}: ComplianceDocumentsSectionProps) {
  const spdFile = documentsData.spdFile;
  const retirementPlanDocuments = documentsData.retirementPlanDocuments || [];

  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editingDocumentSource, setEditingDocumentSource] = useState<
    "spd" | "retirement" | null
  >(null);
  const editSectionRef = useRef<HTMLDivElement>(null);

  const [selectedRecordkeeper, setSelectedRecordkeeper] = useState<string>(
    documentsData.recordkeeper || "",
  );
  const [isCustomRecordkeeper, setIsCustomRecordkeeper] = useState(false);
  const [customRecordkeeperValue, setCustomRecordkeeperValue] = useState("");
  const [recordkeeperSearch, setRecordkeeperSearch] = useState("");
  const [isRecordkeeperPopoverOpen, setIsRecordkeeperPopoverOpen] =
    useState(false);

  useEffect(() => {
    const recordkeeper = documentsData.recordkeeper || "";
    if (!recordkeeper) {
      setSelectedRecordkeeper("");
      setIsCustomRecordkeeper(false);
      setCustomRecordkeeperValue("");
      return;
    }

    const isInList = recordKeepers.some(
      (rk) => rk.name === recordkeeper && rk.name !== "Custom",
    );

    if (!isInList) {
      setIsCustomRecordkeeper(true);
      setCustomRecordkeeperValue(recordkeeper);
      setSelectedRecordkeeper("Custom");
    } else {
      setSelectedRecordkeeper(recordkeeper);
      setIsCustomRecordkeeper(recordkeeper === "Custom");
      if (recordkeeper !== "Custom") {
        setCustomRecordkeeperValue("");
      }
    }
  }, [documentsData.recordkeeper]);

  const filteredRecordKeepers = useMemo(() => {
    const query = recordkeeperSearch.trim().toLowerCase();
    if (!query) return recordKeepers;
    return recordKeepers.filter((rk) => rk.name.toLowerCase().includes(query));
  }, [recordkeeperSearch]);

  const documentsPreview = useMemo<RetirementDocumentItem[]>(() => {
    const items: RetirementDocumentItem[] = [];

    if (spdFile) {
      const spdDocument = spdFile as Document;
      const language =
        spdDocument.language &&
        (spdDocument.language === "ES" || spdDocument.language === "EN")
          ? spdDocument.language
          : "EN";
      const docType = detectDocumentType(
        spdDocument.originalFileName || spdDocument.name,
      );
      items.push({
        id: spdDocument.id || "spd-document",
        title: spdDocument.name,
        description: getDocumentDescription(spdDocument),
        href: spdDocument.file,
        language,
        meta: {
          source: "spd",
          id: spdDocument.id || "spd-document",
          type: docType,
        },
      });
    }

    retirementPlanDocuments.forEach((doc) => {
      const docLanguage =
        doc.language && (doc.language === "ES" || doc.language === "EN")
          ? doc.language
          : "EN";
      const docType = detectDocumentType(doc.originalFileName || doc.name);

      items.push({
        id: doc.id,
        title: doc.name,
        description: getDocumentDescription(doc),
        href: doc.file,
        language: docLanguage,
        meta: {
          source: "retirement",
          id: doc.id,
          type: docType,
        },
      });
    });

    return items;
  }, [spdFile, retirementPlanDocuments]);

  const hasDocumentsPreview = documentsPreview.length > 0;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSPDFileUpload = async (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF and Word documents are allowed");
      return;
    }

    try {
      if (clientId) {
        const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
        const key = await uploadFileToR2({
          file,
          purpose: "document",
          clientId,
          fileName: file.name,
          category: "other",
        });
        if (key) {
          const updatedSPD: Document = {
            id: spdFile?.id || `spd-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            file: "r2:stored",
            type: "spd",
            size: file.size,
            status: "success",
            shortDescription: spdFile?.shortDescription,
            originalFileName: file.name,
            storageKey: key,
          };
          onDataChange("spdFile", updatedSPD);
          return;
        }
      }
      const base64 = await fileToBase64(file);
      const updatedSPD: Document = {
        id: spdFile?.id || `spd-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        file: base64,
        type: "spd",
        size: file.size,
        status: "success",
        shortDescription: spdFile?.shortDescription,
        originalFileName: file.name,
      };

      onDataChange("spdFile", updatedSPD);
    } catch (error) {
      console.error("Error converting SPD file:", error);
      alert("Failed to process SPD file");
    }
  };

  const handleSPDFileRemove = () => {
    onDataChange("spdFile", null);
  };

  const handleSPDNameChange = (newName: string) => {
    if (!spdFile) return;
    onDataChange("spdFile", { ...spdFile, name: newName });
  };

  const handleEditPreviewDoc = (docItem: RetirementDocumentItem) => {
    const source = docItem.meta?.source === "retirement" ? "retirement" : "spd";
    const docId = docItem.meta?.id || docItem.id;

    if (source === "spd" && spdFile) {
      setEditingDocument(spdFile);
      setEditingDocumentSource("spd");
    } else if (source === "retirement") {
      const doc = retirementPlanDocuments.find((d) => d.id === docId);
      if (doc) {
        setEditingDocument(doc);
        setEditingDocumentSource("retirement");
      }
    }

    setTimeout(() => {
      editSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const handleSaveEditedDocument = (updatedDoc: Document) => {
    if (!editingDocumentSource) return;

    if (editingDocumentSource === "spd") {
      onDataChange("spdFile", updatedDoc);
    } else {
      const updatedDocuments = retirementPlanDocuments.map((doc) =>
        doc.id === updatedDoc.id ? updatedDoc : doc,
      );
      onDataChange("retirementPlanDocuments", updatedDocuments);
    }

    setEditingDocument(null);
    setEditingDocumentSource(null);
  };

  const handleCancelEdit = () => {
    setEditingDocument(null);
    setEditingDocumentSource(null);
  };

  const handleRecordkeeperChange = (value: string) => {
    setSelectedRecordkeeper(value);
    if (value === "Custom") {
      setIsCustomRecordkeeper(true);
      if (!customRecordkeeperValue && documentsData.recordkeeper) {
        const isInList = recordKeepers.some(
          (rk) => rk.name === documentsData.recordkeeper,
        );
        if (!isInList) {
          setCustomRecordkeeperValue(documentsData.recordkeeper);
        }
      }
    } else {
      setIsCustomRecordkeeper(false);
      setCustomRecordkeeperValue("");
      onDataChange("recordkeeper", value || "");
    }
  };

  const handleCustomRecordkeeperChange = (value: string) => {
    setCustomRecordkeeperValue(value);
    onDataChange("recordkeeper", value);
  };

  const handleRetirementDocumentsChange = (docs: Document[]) => {
    onDataChange("retirementPlanDocuments", docs);
  };

  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Compliance Documents</CardTitle>
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
                <FileText className="w-5 h-5 text-red-600" />
                SPD / Plan Highlights <span className="text-red-500">*</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Summary Plan Description or Plan Highlights document (required)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <DragDropUpload
                id="edit-spd-upload"
                title="Upload SPD/Plan Highlights Document"
                value={spdFile?.file || ""}
                fileName={spdFile?.name || ""}
                file={undefined}
                onChange={handleSPDFileUpload}
                onRemove={handleSPDFileRemove}
                accept=".pdf,.doc,.docx"
                required
              />

              {spdFile && (
                <div className="space-y-2">
                  <Label htmlFor="edit-spd-name">Document Name</Label>
                  <Input
                    id="edit-spd-name"
                    value={spdFile.name}
                    onChange={(e) => handleSPDNameChange(e.target.value)}
                    placeholder="Enter document name"
                    className="font-medium"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize the display name for this document
                  </p>
                </div>
              )}

              {validationErrors.spdFile && (
                <p className="text-red-500 text-xs">
                  {validationErrors.spdFile[0]}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-blue" />
                Recordkeeper <span className="text-red-500">*</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the recordkeeper for this retirement plan
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recordkeeper-select">
                  Recordkeeper <span className="text-red-500">*</span>
                </Label>
                <Popover
                  open={isRecordkeeperPopoverOpen}
                  onOpenChange={(open) => setIsRecordkeeperPopoverOpen(open)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full justify-between ${
                        validationErrors.recordkeeper ? "border-red-500" : ""
                      }`}
                    >
                      <span className="truncate">
                        {selectedRecordkeeper || "Select a recordkeeper"}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(320px,90vw)] p-3 space-y-3"
                    align="start"
                  >
                    <Input
                      autoFocus
                      placeholder="Type to filter recordkeepers..."
                      value={recordkeeperSearch}
                      onChange={(e) => setRecordkeeperSearch(e.target.value)}
                      onFocus={() => setIsRecordkeeperPopoverOpen(true)}
                    />
                    <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                      {filteredRecordKeepers.length > 0 ? (
                        filteredRecordKeepers.map((recordkeeper) => (
                          <button
                            key={recordkeeper.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
                              selectedRecordkeeper === recordkeeper.name
                                ? "bg-accent/50"
                                : ""
                            }`}
                            onClick={() => {
                              handleRecordkeeperChange(recordkeeper.name);
                              setIsRecordkeeperPopoverOpen(false);
                              setRecordkeeperSearch("");
                            }}
                          >
                            {recordkeeper.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground px-3 py-6 text-center">
                          No recordkeepers match your search
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {validationErrors.recordkeeper && (
                  <p className="text-sm text-red-500">
                    {validationErrors.recordkeeper[0]}
                  </p>
                )}
              </div>

              {isCustomRecordkeeper && (
                <div className="space-y-2">
                  <Label htmlFor="custom-recordkeeper">
                    Custom Recordkeeper Name{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="custom-recordkeeper"
                    value={customRecordkeeperValue}
                    onChange={(e) =>
                      handleCustomRecordkeeperChange(e.target.value)
                    }
                    placeholder="Enter custom recordkeeper name"
                    className={
                      validationErrors.recordkeeper ? "border-red-500" : ""
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {editingDocument && editingDocumentSource && (
            <div ref={editSectionRef}>
              {editingDocumentSource === "spd" ? (
                <Card className="border-blue-300 bg-blue-50/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-accent-blue" />
                      Edit SPD / Plan Highlights Document
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Update the document name, description, or replace the file
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4 p-4 border rounded-lg bg-white">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-accent-blue" />
                          <div>
                            <p className="text-sm font-medium">
                              {editingDocument.originalFileName ||
                                editingDocument.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Math.round(editingDocument.size / 1024)} KB
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-spd-name-input">
                          Document Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="edit-spd-name-input"
                          value={editingDocument.name}
                          onChange={(e) =>
                            setEditingDocument({
                              ...editingDocument,
                              name: e.target.value,
                            })
                          }
                          placeholder="Enter document name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-spd-description">
                          Short Description{" "}
                          <span className="text-gray-400">(optional)</span>
                        </Label>
                        <Textarea
                          id="edit-spd-description"
                          value={editingDocument.shortDescription || ""}
                          onChange={(e) =>
                            setEditingDocument({
                              ...editingDocument,
                              shortDescription: e.target.value,
                            })
                          }
                          placeholder="Add a brief description"
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Replace File (optional)</Label>
                        <DragDropUpload
                          id="replace-spd-file"
                          title="Upload New SPD/Plan Highlights Document"
                          value=""
                          fileName=""
                          file={undefined}
                          onChange={async (file: File) => {
                            try {
                              if (clientId) {
                                const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
                                const key = await uploadFileToR2({
                                  file,
                                  purpose: "document",
                                  clientId,
                                  fileName: file.name,
                                  category: "other",
                                });
                                if (key) {
                                  setEditingDocument({
                                    ...editingDocument,
                                    file: "r2:stored",
                                    size: file.size,
                                    originalFileName: file.name,
                                    storageKey: key,
                                  });
                                  return;
                                }
                              }
                              const base64 = await fileToBase64(file);
                              setEditingDocument({
                                ...editingDocument,
                                file: base64,
                                size: file.size,
                                originalFileName: file.name,
                              });
                            } catch (error) {
                              console.error("Error converting file:", error);
                              alert("Failed to process file");
                            }
                          }}
                          onRemove={() => {}}
                          accept=".pdf,.doc,.docx"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            handleSaveEditedDocument(editingDocument)
                          }
                          className="flex-1"
                          disabled={!editingDocument.name.trim()}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <DocumentsUploadSection
                  documents={retirementPlanDocuments}
                  onDocumentsChange={handleRetirementDocumentsChange}
                  title="Edit Retirement Plan Document"
                  description="Update the document name, description, or replace the file"
                  editingDocument={editingDocument}
                  onSaveEdit={handleSaveEditedDocument}
                  onCancelEdit={handleCancelEdit}
                />
              )}
            </div>
          )}

          {!editingDocument && (
            <DocumentsUploadSection
              documents={retirementPlanDocuments}
              onDocumentsChange={handleRetirementDocumentsChange}
              title="Retirement Plan Documents"
              description="Upload multiple documents with editable names and descriptions (optional)"
            />
          )}

          {hasDocumentsPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-blue" />
                  Documents Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RetirementDocumentsAccordion
                  mode="editable"
                  showInsuranceSection={false}
                  retirementDocs={documentsPreview}
                  insuranceDocs={[]}
                  brandColor="#002B5B"
                  accentColor="#E6C47A"
                  onEdit={handleEditPreviewDoc}
                  onOrderChange={(reorderedDocs) => {
                    const orderMap = new Map<string, number>();
                    reorderedDocs.forEach((doc, index) => {
                      const docId = doc.meta?.id || doc.id;
                      orderMap.set(docId, index);
                    });

                    const sortedDocs = [...retirementPlanDocuments].sort(
                      (a, b) => {
                        const orderA = orderMap.get(a.id) ?? Infinity;
                        const orderB = orderMap.get(b.id) ?? Infinity;
                        return orderA - orderB;
                      },
                    );

                    const orderChanged = sortedDocs.some(
                      (doc, index) =>
                        doc.id !== retirementPlanDocuments[index]?.id,
                    );

                    if (orderChanged) {
                      onDataChange("retirementPlanDocuments", sortedDocs);
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card
            className={
              spdFile
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {spdFile ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <h4
                    className={`font-medium ${
                      spdFile ? "text-green-900" : "text-amber-900"
                    } mb-1`}
                  >
                    {spdFile ? "Ready to Continue" : "SPD Document Required"}
                  </h4>
                  <p
                    className={`text-sm ${
                      spdFile ? "text-green-700" : "text-amber-700"
                    }`}
                  >
                    {spdFile
                      ? "All required documents have been uploaded. You can proceed to the next step."
                      : "Please upload the SPD/Plan Highlights document to continue."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}
