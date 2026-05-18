"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, Edit2, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { DocumentsUploadSection } from "@/components/wizard/new-client-steps/sections/documents-upload-section";
import { Document as WizardDocument } from "@/types/new-client-wizard";
import { isCategoryVisibleInPortal } from "@/lib/portal-category-visibility";
import {
  compareDocumentCategoriesHubOrder,
  resolvePersistedDocumentCategory,
} from "@/lib/document-category";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";

interface Document {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  type?: string;
  shortDescription?: string;
  category?: string;
  expirationDate?: string;
  storageKey?: string;
}

interface DocumentsSectionProps {
  brandColor?: string;
  secondaryColor?: string;
  clientId?: string;
  enableEditing?: boolean;
  /** Hide documents whose category is not visible in portal */
  categoryPortalVisibility?: Record<string, boolean> | null;
  /** If set, only list documents in this hub category (matches resolvePersistedDocumentCategory). */
  documentHubCategory?: string;
}

function DocumentCard({
  document,
  brandColor,
  secondaryColor,
  enableEditing = false,
  onUpdate,
}: {
  document: Document;
  brandColor?: string;
  secondaryColor?: string;
  enableEditing?: boolean;
  onUpdate?: (updatedDocument: Document) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(
    document.title || document.fileName,
  );
  const [editedDescription, setEditedDescription] = useState(
    document.shortDescription || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const expiringSoon = (() => {
    if (!document.expirationDate) return false;
    const d = new Date(document.expirationDate);
    if (Number.isNaN(d.getTime())) return false;
    const ms = d.getTime() - Date.now();
    const days = ms / (86400 * 1000);
    return days >= 0 && days <= 30;
  })();

  // Sync state when document prop changes
  useEffect(() => {
    setEditedTitle(document.title || document.fileName);
    setEditedDescription(document.shortDescription || "");
  }, [document.title, document.fileName, document.shortDescription]);

  const canOpenInModal = Boolean(
    document.id || (document.fileUrl && String(document.fileUrl).trim()),
  );

  const handleView = () => {
    if (canOpenInModal) {
      setIsModalOpen(true);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canOpenInModal) {
      setIsModalOpen(true);
    }
  };

  const handleDownload = async () => {
    const urlString = document.id
      ? `/api/documents/${document.id}/view`
      : (document.fileUrl && String(document.fileUrl).trim()) || "";
    if (!urlString) return;

    const doc = document; // Store document reference to avoid type conflict
    const domDocument = window.document; // Use DOM document

    // If it's an API endpoint, fetch and download
    if (urlString.startsWith("/api/") || urlString.startsWith("http")) {
      try {
        const response = await fetch(urlString);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = domDocument.createElement("a");
        link.href = url;
        link.download = doc.title || doc.fileName || "document.pdf";
        domDocument.body.appendChild(link);
        link.click();
        domDocument.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading document:", error);
        // Fallback to opening in new tab
        window.open(urlString, "_blank");
      }
    } else {
      // For data URLs, use direct download
      const link = domDocument.createElement("a");
      link.href = urlString;
      link.download = doc.title || doc.fileName || "document.pdf";
      domDocument.body.appendChild(link);
      link.click();
      domDocument.body.removeChild(link);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedTitle(document.title || document.fileName);
    setEditedDescription(document.shortDescription || "");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTitle(document.title || document.fileName);
    setEditedDescription(document.shortDescription || "");
  };

  const handleSave = async () => {
    if (!editedTitle.trim()) {
      alert("Document name is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editedTitle.trim(),
          shortDescription: editedDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsEditing(false);
        if (onUpdate) {
          onUpdate({
            ...document,
            title: editedTitle.trim(),
            shortDescription: editedDescription.trim() || undefined,
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update document");
      }
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Failed to update document");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow relative flex flex-col">
      {/* Edit Button (only if editing is enabled) */}
      {enableEditing && !isEditing && (
        <button
          onClick={handleEdit}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
          title="Edit document"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 flex flex-col space-y-4">
        {/* Document Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#F5F5DC] rounded-lg flex items-center justify-center">
            <FileText className="w-8 h-8 text-[#002B5B]" />
          </div>
        </div>

        {/* Document Name */}
        <div>
          {isEditing ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Document name (required)"
              className="text-center font-bold text-[#002B5B] text-base"
              disabled={isSaving}
            />
          ) : (
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#002B5B] text-center">
                {document.title || document.fileName}
              </h3>
              {expiringSoon && (
                <p className="text-center text-xs font-semibold text-amber-700">
                  Expires soon
                </p>
              )}
            </div>
          )}
        </div>

        {/* Short Description */}
        {isEditing ? (
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="text-sm text-gray-600 text-center min-h-[3rem] resize-none"
            disabled={isSaving}
          />
        ) : (
          document.shortDescription && (
            <p className="text-sm text-[#6B6B6B] text-center leading-relaxed">
              {document.shortDescription}
            </p>
          )
        )}
      </div>

      {/* Download Button - Always at bottom */}
      <div className="flex flex-col gap-2 pt-4 mt-auto">
        <Button
          onClick={handleButtonClick}
          variant="outline"
          className="w-full font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 border-2 hover:opacity-90"
          style={{
            borderColor: brandColor || "#002B5B",
            color: brandColor || "#002B5B",
          }}
        >
          <Download className="w-4 h-4" />
          <span>VIEW/DOWNLOAD PDF</span>
        </Button>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentUrl={
          document.id ? `/api/documents/${document.id}/view` : document.fileUrl
        }
        documentName={document.title || document.fileName}
        documentType="application/pdf"
      />
    </div>
  );
}

function hasClientDocumentFile(doc: { fileUrl?: string; storageKey?: string }) {
  const u = (doc.fileUrl && String(doc.fileUrl).trim()) || "";
  const k = (doc.storageKey && String(doc.storageKey).trim()) || "";
  return u !== "" || k !== "";
}

export function DocumentsSection({
  brandColor,
  secondaryColor,
  clientId,
  enableEditing = false,
  categoryPortalVisibility,
  documentHubCategory,
}: DocumentsSectionProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDocuments, setShowAddDocuments] = useState(false);
  const [retirementPlanDocuments, setRetirementPlanDocuments] = useState<
    WizardDocument[]
  >([]);
  const [isSavingDocuments, setIsSavingDocuments] = useState(false);

  const handleDocumentUpdate = (updatedDocument: Document) => {
    setDocuments((prevDocs) =>
      prevDocs.map((doc) =>
        doc.id === updatedDocument.id ? updatedDocument : doc,
      ),
    );
  };

  // Save retirement plan documents to optional-documents API
  const handleSaveRetirementPlanDocuments = async () => {
    if (retirementPlanDocuments.length === 0) {
      alert("Please add at least one document");
      return;
    }

    setIsSavingDocuments(true);
    try {
      // Convert Document[] to OptionalDocumentsFormData format
      const optionalFiles = retirementPlanDocuments.map((doc) => {
        // Extract base64 from file (handle both data URL and plain base64)
        let fileData = doc.file;
        if (fileData.startsWith("data:")) {
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64Index = fileData.indexOf(",");
          fileData =
            base64Index !== -1 ? fileData.substring(base64Index + 1) : fileData;
        }

        // Extract file type from originalFileName or default to pdf
        const fileType =
          doc.originalFileName?.split(".").pop()?.toLowerCase() || "pdf";

        return {
          fileName: doc.name, // Use editable name as fileName
          fileData: fileData, // Base64 string without data URL prefix
          fileType: fileType,
          description: doc.shortDescription || "",
        };
      });

      const response = await fetch(
        "/api/new-client-wizard/optional-documents",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            optionalFiles,
            provideSpanishVersions: false,
          }),
        },
      );

      if (response.ok) {
        alert("Documents saved successfully!");
        setShowAddDocuments(false);
        setRetirementPlanDocuments([]);

        // Reload documents - try both wizard session and client documents
        const allDocuments: Document[] = [];

        // First, try wizard session (for documents that haven't been saved to client yet)
        const optionalDocumentsResponse = await fetch(
          `/api/new-client-wizard/optional-documents`,
        );

        if (optionalDocumentsResponse.ok) {
          const optionalData = await optionalDocumentsResponse.json();
          const optionalDocuments = optionalData.optionalDocuments;

          if (optionalDocuments && optionalDocuments.retirementPlanDocuments) {
            const retirementDocs = Array.isArray(
              optionalDocuments.retirementPlanDocuments,
            )
              ? optionalDocuments.retirementPlanDocuments
              : [];

            const convertedDocs = retirementDocs.map(
              (doc: any, index: number) =>
                convertOptionalDocumentToDocument(doc, index),
            );
            allDocuments.push(...convertedDocs);
          }
        }

        // Then, fetch from client documents if clientId is available
        if (clientId) {
          try {
            const clientDocs = (await fetchPlanDocumentsForClient(
              clientId,
            )) as any[];

            if (clientDocs.length > 0) {
                // Filter out SPD and SBC documents, keep only "Document" type
                // Also exclude documents with empty fileUrl
                const retirementPlanDocs = clientDocs.filter((doc: any) => {
                  // Must have fileUrl
                  if (!doc.fileUrl || doc.fileUrl.trim() === "") {
                    return false;
                  }

                  // First check by type - if type is explicitly "SPD" or "SBC", exclude
                  if (doc.type === "SPD" || doc.type === "SBC") {
                    return false;
                  }

                  // If type is "Document" or no type, include it (even if title contains SPD/SBC)
                  // This is because retirement plan documents can have "SPD" in their name
                  if (doc.type === "Document" || !doc.type) {
                    return true;
                  }

                  // For any other type, exclude
                  return false;
                });

                // Convert client documents to Document format
                const convertedClientDocs = retirementPlanDocs.map(
                  (doc: any, index: number) => {
                    const convertedDoc: Document = {
                      id: doc.id,
                      title:
                        doc.title || doc.fileName || `Document ${index + 1}`,
                      fileName:
                        doc.fileName || doc.title || `Document ${index + 1}`,
                      fileUrl: doc.fileUrl || "",
                      type: doc.type || "Document",
                      shortDescription: doc.shortDescription || undefined,
                      category: doc.category || undefined,
                      expirationDate: doc.expirationDate
                        ? new Date(doc.expirationDate).toISOString()
                        : undefined,
                    };
                    return convertedDoc;
                  },
                );

                // Merge documents, avoiding duplicates by id
                const existingIds = new Set(allDocuments.map((d) => d.id));
                const newDocs = convertedClientDocs.filter(
                  (doc: Document) => !existingIds.has(doc.id),
                );
                allDocuments.push(...newDocs);
            }
          } catch (clientError) {
            console.error(
              "Error fetching client documents after save:",
              clientError,
            );
          }
        }

        setDocuments(allDocuments);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save documents");
      }
    } catch (error) {
      console.error("Error saving retirement plan documents:", error);
      alert("Failed to save documents");
    } finally {
      setIsSavingDocuments(false);
    }
  };

  // Helper function to convert optional documents format to Document format
  const convertOptionalDocumentToDocument = (
    doc: any,
    index: number,
  ): Document => {
    // Handle both formats: OptionalFiles format and Document format
    let fileUrl = "";
    let title = "";
    let fileName = "";
    let shortDescription = "";

    // Check if it's in OptionalFiles format (fileName, fileData, fileType, description)
    if (doc.fileName && doc.fileData) {
      // Convert fileData to data URL if needed
      fileUrl = doc.fileData;
      if (!fileUrl.startsWith("data:")) {
        // If it's base64 without data URL prefix, add it
        const mimeType =
          doc.fileType === "pdf"
            ? "application/pdf"
            : doc.fileType === "doc" || doc.fileType === "docx"
              ? "application/msword"
              : "application/pdf";
        fileUrl = `data:${mimeType};base64,${fileUrl}`;
      }
      // Use fileName as title (this is the editable name from documents-upload-section)
      title = doc.fileName || `Document ${index + 1}`;
      fileName = doc.fileName || `Document ${index + 1}`;
      // Use description as shortDescription (this is the editable description from documents-upload-section)
      shortDescription = doc.description || "";
    }
    // Check if it's in Document format (id, name, file, type, size, status, shortDescription, originalFileName)
    else if (doc.name && doc.file) {
      fileUrl = doc.file;
      if (!fileUrl.startsWith("data:") && !fileUrl.startsWith("http")) {
        // If it's base64 without data URL prefix, add it
        const mimeType = "application/pdf";
        fileUrl = `data:${mimeType};base64,${fileUrl}`;
      }
      title = doc.name;
      fileName = doc.originalFileName || doc.name;
      shortDescription = doc.shortDescription || "";
    }
    // Fallback
    else {
      title = doc.title || doc.fileName || doc.name || `Document ${index + 1}`;
      fileName = doc.fileName || doc.originalFileName || title;
      fileUrl = doc.fileUrl || doc.file || "";
      shortDescription = doc.shortDescription || doc.description || "";
    }

    const convertedDoc: Document = {
      id: doc.id || `optional-doc-${Date.now()}-${index}`,
      title: title.trim(),
      fileName: fileName.trim(),
      fileUrl: fileUrl,
      type: doc.type || "Document",
      shortDescription: shortDescription.trim() || undefined,
    };

    return convertedDoc;
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!clientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const allDocuments: Document[] = [];

        // First, try to fetch from wizard session (for documents that haven't been saved to client yet)
        const optionalDocumentsResponse = await fetch(
          `/api/new-client-wizard/optional-documents`,
        );

        if (optionalDocumentsResponse.ok) {
          const optionalData = await optionalDocumentsResponse.json();

          const optionalDocuments = optionalData.optionalDocuments;

          if (optionalDocuments) {
            // Check for retirementPlanDocuments field
            if (optionalDocuments.retirementPlanDocuments) {
              const retirementDocs = Array.isArray(
                optionalDocuments.retirementPlanDocuments,
              )
                ? optionalDocuments.retirementPlanDocuments
                : [];

              const convertedDocs = retirementDocs.map(
                (doc: any, index: number) => {
                  return convertOptionalDocumentToDocument(doc, index);
                },
              );
              allDocuments.push(...convertedDocs);
            }
          }
        }

        // Then, fetch documents from client's document table (for completed wizard)
        try {
          const clientDocs = (await fetchPlanDocumentsForClient(
            clientId,
          )) as any[];

          if (clientDocs.length > 0) {
              // R2: fileUrl may be "r2:stored" or empty; storageKey must be present to open.
              // Category: DB may store R2 slugs (e.g. "retirement") — use resolvePersistedDocumentCategory.
              const retirementPlanDocs = clientDocs.filter((doc: any) => {
                if (!hasClientDocumentFile(doc)) {
                  return false;
                }
                const effective = resolvePersistedDocumentCategory(
                  doc.type,
                  doc.category,
                  doc.storageKey,
                );
                if (documentHubCategory) {
                  const want = resolvePersistedDocumentCategory(
                    "Document",
                    documentHubCategory,
                  );
                  return effective === want;
                }
                if (doc.type === "SPD" || doc.type === "SBC") {
                  return false;
                }
                if (doc.type === "Document" || !doc.type) {
                  return true;
                }
                return false;
              });

              // Convert client documents to Document format
              const convertedClientDocs = retirementPlanDocs.map(
                (doc: any, index: number) => {
                  const convertedDoc: Document = {
                    id: doc.id,
                    title: doc.title || doc.fileName || `Document ${index + 1}`,
                    fileName:
                      doc.fileName || doc.title || `Document ${index + 1}`,
                    fileUrl: doc.fileUrl || "",
                    type: doc.type || "Document",
                    shortDescription: doc.shortDescription || undefined,
                    category: doc.category || undefined,
                    expirationDate: doc.expirationDate
                      ? new Date(doc.expirationDate).toISOString()
                      : undefined,
                    storageKey: doc.storageKey || undefined,
                  };

                  return convertedDoc;
                },
              );

              // Merge documents, avoiding duplicates by id
              const existingIds = new Set(allDocuments.map((d) => d.id));
              const newDocs = convertedClientDocs.filter(
                (doc: Document) => !existingIds.has(doc.id),
              );
              allDocuments.push(...newDocs);
            }
        } catch (clientError) {
          console.error(
            "DocumentsSection: Error fetching client documents:",
            clientError,
          );
        }

        setDocuments(allDocuments);
      } catch (error) {
        console.error("DocumentsSection: Error fetching documents:", error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [clientId, documentHubCategory]);

  if (!clientId) {
    return null;
  }

  const visibleDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => {
      // Dedicated hub routes (e.g. /health-insurance) pass `documentHubCategory` and
      // already restricted the fetch to that category. Do not also hide every doc
      // when the same label is turned off in Edit Panel — that toggle is for benefit
      // cards/contacts; plan documents for this hub should still list here.
      if (documentHubCategory) {
        return true;
      }
      return isCategoryVisibleInPortal(
        resolvePersistedDocumentCategory(
          doc.type,
          doc.category,
          (doc as { storageKey?: string }).storageKey,
        ),
        categoryPortalVisibility,
      );
    });
    return [...filtered].sort((a, b) => {
      const byCat = compareDocumentCategoriesHubOrder(
        resolvePersistedDocumentCategory(
          a.type,
          a.category,
          (a as { storageKey?: string }).storageKey,
        ),
        resolvePersistedDocumentCategory(
          b.type,
          b.category,
          (b as { storageKey?: string }).storageKey,
        ),
      );
      if (byCat !== 0) return byCat;
      return (a.title || a.fileName || "").localeCompare(
        b.title || b.fileName || "",
      );
    });
  }, [documents, categoryPortalVisibility, documentHubCategory]);

  const visibleDocumentsByCategory = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const doc of visibleDocuments) {
      const key = resolvePersistedDocumentCategory(
        doc.type ?? "Document",
        doc.category,
        (doc as { storageKey?: string }).storageKey,
      );
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      compareDocumentCategoriesHubOrder(a, b),
    );
    return keys.map((category) => ({
      category,
      docs: map.get(category)!,
    }));
  }, [visibleDocuments]);

  return (
    <section className="bg-white px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="font-dm-serif text-[40px] leading-tight mb-4"
            style={{ color: brandColor || "#002B5B" }}
          >
            Insurance Benefit Documents &amp; Forms
          </h2>
          <p className="text-[16px] font-red-hat max-w-2xl mx-auto">
            Access all your important insurance documents, forms, and notices in
            one convenient location.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#002B5B]"></div>
              <span className="text-[16px] font-red-hat">
                Loading documents...
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Add Documents Button */}
            {enableEditing && (
              <div className="max-w-5xl mx-auto mb-6">
                {!showAddDocuments ? (
                  <Button
                    onClick={() => setShowAddDocuments(true)}
                    className="flex items-center gap-2"
                    style={{
                      background: brandColor || "#002B5B",
                      color: "white",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Retirement Plan Documents
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <DocumentsUploadSection
                      documents={retirementPlanDocuments}
                      onDocumentsChange={setRetirementPlanDocuments}
                      title="Add Retirement Plan Documents"
                      description="Upload multiple documents with editable names and descriptions"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveRetirementPlanDocuments}
                        disabled={
                          isSavingDocuments ||
                          retirementPlanDocuments.length === 0
                        }
                        className="flex items-center gap-2"
                        style={{
                          background: brandColor || "#002B5B",
                          color: "white",
                        }}
                      >
                        {isSavingDocuments ? "Saving..." : "Save Documents"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddDocuments(false);
                          setRetirementPlanDocuments([]);
                        }}
                        disabled={isSavingDocuments}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Documents grouped by benefit category (canonical Hub order) */}
            {visibleDocuments.length > 0 ? (
              <div className="max-w-5xl mx-auto space-y-12">
                {visibleDocumentsByCategory.map(({ category, docs }) => (
                  <div key={category}>
                    <h3
                      className="text-xl font-bold font-red-hat mb-6 text-center md:text-left"
                      style={{ color: brandColor || "#002B5B" }}
                    >
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {docs.map((document) => (
                        <DocumentCard
                          key={document.id}
                          document={document}
                          brandColor={brandColor}
                          secondaryColor={secondaryColor}
                          enableEditing={enableEditing}
                          onUpdate={handleDocumentUpdate}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-[16px] font-red-hat">
                  No documents available at this time.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
