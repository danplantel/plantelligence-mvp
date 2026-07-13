"use client";

import { useState, useEffect } from "react";
import {
  RetirementDocumentsAccordion,
  RetirementDocumentItem,
} from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { Document } from "../types";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { toast } from "sonner";

interface DocumentsCardsViewProps {
  documents: RetirementDocumentItem[];
  onEdit?: (doc: RetirementDocumentItem) => void;
  onDelete: (documentId: string, title: string) => void;
  onDownload: (documentId: string, fileName: string) => void;
  onDocumentsChange?: () => void;
  onSaveEdit?: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => Promise<void>;
  brandColor?: string;
  accentColor?: string;
}

export function DocumentsCardsView({
  documents,
  onEdit,
  onDelete,
  onDownload,
  onDocumentsChange,
  onSaveEdit: customOnSaveEdit,
  brandColor = "#002B5B",
  accentColor = "#6B7280",
}: DocumentsCardsViewProps) {
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const handleStartEdit = (docId: string) => {
    setEditingDocId(docId);
  };

  const handleSaveEdit = async (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => {
    // Use custom onSaveEdit if provided, otherwise use default API call
    if (customOnSaveEdit) {
      try {
        await (customOnSaveEdit as any)(docId, title, description, file, category);
      } catch (err) {
        console.error('🃏 customOnSaveEdit FAILED:', err);
      }
      setEditingDocId(null);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("shortDescription", description);
      if (category) {
        formData.append("category", category);
      }

      if (file) {
        formData.append("file", file);
      }

      const response = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Document updated successfully");
        setEditingDocId(null);
        if (onDocumentsChange) {
          // Add a small delay to ensure server has processed the update
          setTimeout(() => {
            onDocumentsChange();
          }, 300);
        }
      } else {
        toast.error(result.error || "Failed to update document");
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error("An error occurred while updating the document");
    }
  };

  const handleCancelEdit = () => {
    setEditingDocId(null);
  };

  // Listen for editDocument event to auto-open edit mode
  useEffect(() => {
    const handleEditDocument = (event: CustomEvent) => {
      const { documentId } = event.detail;
      if (documentId && documents.some((doc) => doc.id === documentId)) {
        setEditingDocId(documentId);
      }
    };

    window.addEventListener("editDocument" as any, handleEditDocument);
    return () => {
      window.removeEventListener("editDocument" as any, handleEditDocument);
    };
  }, [documents]);

  return (
    <RetirementDocumentsAccordion
      brandColor={brandColor}
      accentColor={accentColor}
      retirementDocs={documents}
      mode="editable"
      showMetadata={false}
      hideHeader={true}
      editingDocId={editingDocId}
      onStartEdit={handleStartEdit}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelEdit}
      onEdit={(doc) => {
        if (onEdit) {
          onEdit(doc);
        } else {
          toast.info("Edit functionality coming soon");
        }
      }}
      onOrderChange={() => {
        // Don't save order - just visual reordering
      }}
    />
  );
}
