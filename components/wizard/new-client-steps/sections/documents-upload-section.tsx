"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { FileText, Upload, X, Plus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Document, BenefitsCategory } from "@/types/new-client-wizard";
import { guessLanguageFromDocument, detectBenefitsCategory, analyzeDocumentCategory, extractTextFromPDF } from "@/lib/compliance-document-utils";
import { getDocumentCategoryDisplayLabel } from "@/lib/service-categories";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { uploadFileToR2 } from "@/lib/upload-to-r2";
import { CheckCircle2, Loader2, AlertCircle, Circle, Sparkles } from "lucide-react";
import { toCanonicalCategory } from "@/lib/r2";
import { suggestDocumentNamesBatch } from "@/lib/gemini-suggest-doc-name";
import {
  computeBulkCategoryAssignmentHint,
  type BulkCategoryAssignmentHint,
  type BulkSuggestInputDoc,
} from "@/lib/document-bulk-category-suggest";

const MAX_BATCH_FILE_COUNT = 15;
const MAX_BATCH_PDF_COUNT = 25;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

interface DocumentsUploadSectionProps {
  documents: Document[];
  onDocumentsChange: (documents: Document[]) => void;
  title?: string;
  description?: string;
  editingDocument?: Document | null;
  onSaveEdit?: (document: Document) => void;
  onCancelEdit?: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  fixedCategory?: BenefitsCategory;
  /** When true, loading overlay has no dark backdrop (used in wizard step 4) */
  hideUploadBackdrop?: boolean;
  /** When set, uploads go direct-to-R2 (presign → PUT → store key); otherwise legacy base64. */
  clientId?: string;
  /** When true, only PDF files are accepted (3b.2 Benefits Hub batch). */
  pdfOnly?: boolean;
  /** 3b.2: after a multi-file batch, emit majority / mixed AI hint for parent modal or banners. */
  onBulkCategoryAssignmentHint?: (hint: BulkCategoryAssignmentHint) => void;
  /** Shorter dropzone (Step 3 Add Contact Details) so upload does not dominate the viewport. */
  compactDropzone?: boolean;
}

export function DocumentsUploadSection({
  documents,
  onDocumentsChange,
  description = "Upload multiple documents",
  editingDocument = null,
  onSaveEdit,
  onCancelEdit,
  secondaryAction,
  fixedCategory,
  hideUploadBackdrop = false,
  clientId,
  pdfOnly = false,
  onBulkCategoryAssignmentHint,
  compactDropzone = false,
}: DocumentsUploadSectionProps) {
  const [currentDocumentName, setCurrentDocumentName] = useState("");
  const [currentDocumentDescription, setCurrentDocumentDescription] =
    useState("");
  const [currentDocumentCategory, setCurrentDocumentCategory] =
    useState<BenefitsCategory>(fixedCategory || "Other Benefits");
  const [currentDocumentExpirationDate, setCurrentDocumentExpirationDate] =
    useState("");
  const [currentDocumentFile, setCurrentDocumentFile] = useState<File | null>(
    null,
  );
  const [currentDocumentFileUrl, setCurrentDocumentFileUrl] = useState<
    string | null
  >(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isAddingRef = useRef(false);
  const [batchCategoryDialogOpen, setBatchCategoryDialogOpen] = useState(false);
  const [pendingBatchFiles, setPendingBatchFiles] = useState<File[]>([]);
  const [batchCategory, setBatchCategory] = useState<BenefitsCategory>("Retirement");
  const [reviewDocuments, setReviewDocuments] = useState<Document[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAnalyzingNames, setIsAnalyzingNames] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    currentFile: string | null;
    /** Bytes sent for the file currently uploading to R2 */
    currentFileBytes?: { loaded: number; total: number };
    fileStatuses: {
      fileName: string;
      status: "pending" | "uploading" | "analyzing" | "ready" | "error";
    }[];
  } | null>(null);
  const [failedBatchFiles, setFailedBatchFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAutoCategorized = useMemo(() => {
    return (
      (currentDocumentFile as any)?._autoDetection?.confidence >= 70 &&
      currentDocumentCategory === (currentDocumentFile as any)?._autoDetection?.category
    );
  }, [currentDocumentFile, currentDocumentCategory]);

  const ALLOWED_FILE_TYPES = pdfOnly
    ? ["application/pdf"]
    : [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

  // Load editing document data when editingDocument changes
  useEffect(() => {
    if (editingDocument) {
      setCurrentDocumentName(editingDocument.name);
      setCurrentDocumentDescription(editingDocument.shortDescription || "");
      setCurrentDocumentCategory(editingDocument.category || fixedCategory || "Other Benefits");
      setCurrentDocumentExpirationDate(
        editingDocument.expirationDate
          ? new Date(editingDocument.expirationDate).toISOString().split("T")[0]
          : "",
      );
      setCurrentDocumentFileUrl(editingDocument.file);
      setCurrentDocumentFile(null); // Reset file input, use existing file URL
    } else {
      // Reset form when not editing
      setCurrentDocumentName("");
      setCurrentDocumentDescription("");
      setCurrentDocumentCategory(fixedCategory || "Other Benefits");
      setCurrentDocumentExpirationDate("");
      setCurrentDocumentFile(null);
      setCurrentDocumentFileUrl(null);
    }
  }, [editingDocument]);

  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Extract filename without extension for default name
  const getFileNameWithoutExtension = (fileName: string) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  // Auto-detect document type from filename
  const detectDocumentType = (fileName: string): string => {
    const nameLower = fileName.toLowerCase();
    if (
      nameLower.includes("spd") ||
      nameLower.includes("summary plan description") ||
      nameLower.includes("plan highlights")
    ) {
      return "SPD";
    }
    if (
      nameLower.includes("sbc") ||
      nameLower.includes("summary of benefits")
    ) {
      return "SBC";
    }
    if (nameLower.includes("enrollment")) {
      return "Enrollment";
    }
    if (nameLower.includes("qdia")) {
      return "QDIA";
    }
    if (nameLower.includes("fee disclosure")) {
      return "Fee Disclosure";
    }
    if (nameLower.includes("beneficiary")) {
      return "Beneficiary";
    }
    return "Document";
  };

  // Get description based on document type
  const getDescriptionByType = (docType: string): string => {
    switch (docType) {
      case "SPD":
        return "Comprehensive plan benefits and features";
      case "SBC":
        return "Summary of benefits and coverage information";
      case "Enrollment":
        return "Complete guide to your retirement plan options";
      case "QDIA":
        return "Qualified Default Investment Alternative information";
      case "Fee Disclosure":
        return "Participant fee disclosure and plan expenses";
      case "Beneficiary":
        return "Beneficiary designation form and instructions";
      default:
        return "Complete guide to your retirement plan options";
    }
  };

  const detectLanguageFromMetadata = (
    name: string,
    fileName: string,
    desc: string | null,
  ): "EN" | "ES" => {
    const source = `${name} ${fileName} ${desc || ""}`.toLowerCase();

    if (
      source.includes("[es]") ||
      source.includes("(es)") ||
      source.includes("español") ||
      source.includes("espanol")
    ) {
      return "ES";
    }
    if (
      source.includes("[en]") ||
      source.includes("(en)") ||
      source.includes("english")
    ) {
      return "EN";
    }

    const spanishWords = [
      "aquí",
      "puedes",
      "guía",
      "jubilación",
      "descripción",
      "información",
      "participante",
      "inscripción",
      "formulario",
      "folleto",
      "notificación",
      "solicitud",
    ];
    const hasSpanishWords = spanishWords.some((word) => source.includes(word));
    if (hasSpanishWords) {
      return "ES";
    }

    if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(source)) {
      return "ES";
    }

    return "EN";
  };

  const resetCurrentFormState = () => {
    setCurrentDocumentFile(null);
    setCurrentDocumentFileUrl(null);
    setCurrentDocumentName("");
    setCurrentDocumentDescription("");
    setCurrentDocumentExpirationDate("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateFile = (file: File) => {
    const nameLower = file.name.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || nameLower.endsWith(".pdf");
    if (pdfOnly) {
      if (!isPdf) {
        alert(
          `File ${file.name} is not supported. Only PDF files are allowed.`,
        );
        return false;
      }
      return true;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert(
        `File ${file.name} is not supported. Only PDF and Word documents are allowed.`,
      );
      return false;
    }

    return true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFilesSelected(files);
  };

  const processFile = async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    const toastId = toast.loading("Analyzing document...");

    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

    setCurrentDocumentFile(file);
    setCurrentDocumentName(getFileNameWithoutExtension(file.name));
    const docType = detectDocumentType(file.name);
    setCurrentDocumentDescription(getDescriptionByType(docType));

    let pdfText = "";
    if (file.name.toLowerCase().endsWith(".pdf")) {
      pdfText = await extractTextFromPDF(base64);
    }

    const { category, confidence } = analyzeDocumentCategory(file.name, pdfText);

    const detectedCategory = (fixedCategory || (confidence >= 70 ? category : "Other Benefits")) as BenefitsCategory;
    setCurrentDocumentCategory(detectedCategory);

    const defaultExpirationDate = new Date();
    defaultExpirationDate.setFullYear(defaultExpirationDate.getFullYear() + 1);
    setCurrentDocumentExpirationDate(defaultExpirationDate.toISOString().split("T")[0]);

    (file as any)._autoDetection = { category, confidence };

    toast.dismiss(toastId);
    if (confidence >= 70) {
      toast.success(`Auto-categorized as ${category}`, { duration: 5000 });
    } else {
      toast.info("Document analysis complete", {
        description: "Please manually select a category if not detected.",
        duration: 5000
      });
    }
  };

  const addDocumentsFromFiles = async (
    files: File[],
    groupCategory?: BenefitsCategory,
  ) => {
    const validFiles = files.filter((file) => validateFile(file));
    if (validFiles.length === 0) {
      return;
    }

    if (pdfOnly) {
      if (validFiles.length > MAX_BATCH_PDF_COUNT) {
        toast.error(
          `You can upload up to ${MAX_BATCH_PDF_COUNT} PDFs at once.`,
        );
        return;
      }
      const tooBig = validFiles.filter((f) => f.size > MAX_PDF_BYTES);
      if (tooBig.length > 0) {
        toast.error(
          `Each PDF must be under ${MAX_PDF_BYTES / 1024 / 1024} MB: ${tooBig.map((f) => f.name).join(", ")}`,
        );
        return;
      }
    }

    setFailedBatchFiles([]);
    const failedFiles: File[] = [];
    setIsUploading(true);
    setUploadProgress({
      total: validFiles.length,
      completed: 0,
      currentFile: null,
      fileStatuses: validFiles.map((f) => ({ fileName: f.name, status: "pending" as const })),
    });
    const newDocuments: Document[] = [];
    /** Parallel arrays mapping to newDocuments for Gemini name suggestion */
    const geminiInputs: Array<{ pdfText: string; originalFileName: string; category: string; pdfBase64?: string }> = [];
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                currentFile: file.name,
                fileStatuses: prev.fileStatuses.map((s, j) =>
                  j === i ? { ...s, status: "uploading" as const } : s
                ),
              }
            : null
        );

        try {
          const docType = detectDocumentType(file.name);
          const defaultName = getFileNameWithoutExtension(file.name);
          const defaultDescription = getDescriptionByType(docType);
          const category = (groupCategory || fixedCategory || "Other Benefits") as string;
          const canonicalCategory = toCanonicalCategory(category);

          let filePayload: string;
          let storageKeyPayload: string | undefined;
          const base64ForAnalysis = await fileToBase64(file);

          if (clientId) {
            try {
              const key = await uploadFileToR2({
                file,
                purpose: "document",
                clientId,
                fileName: file.name,
                category: canonicalCategory,
                type: docType,
                onProgress: (loaded, total) => {
                  setUploadProgress((prev) =>
                    prev
                      ? {
                          ...prev,
                          currentFileBytes: { loaded, total },
                          currentFile: file.name,
                        }
                      : null,
                  );
                },
              });
              if (key) {
                filePayload = "r2:stored";
                storageKeyPayload = key;
              } else {
                filePayload = base64ForAnalysis;
              }
            } catch {
              filePayload = base64ForAnalysis;
            }
          } else {
            filePayload = base64ForAnalysis;
          }

          setUploadProgress((prev) =>
            prev
              ? {
                  ...prev,
                  currentFileBytes: undefined,
                  fileStatuses: prev.fileStatuses.map((s, j) =>
                    j === i ? { ...s, status: "analyzing" as const } : s,
                  ),
                }
              : null,
          );

          const tempDoc: Document = {
            id: `temp-${Date.now()}-${Math.random()}`,
            name: defaultName,
            file: base64ForAnalysis,
            type: "other",
            size: file.size,
            status: "success",
            shortDescription: defaultDescription,
            originalFileName: file.name,
          };

          const detectedLanguage = await guessLanguageFromDocument(tempDoc);
          let pdfText = "";
          if (file.name.toLowerCase().endsWith(".pdf")) {
            pdfText = await extractTextFromPDF(base64ForAnalysis);
          }
          const { category: suggestedCategory, confidence } = analyzeDocumentCategory(file.name, pdfText);
          // Multi-file: require explicit category per file unless fixedCategory,
          // groupCategory (batch dialog), or high-confidence auto-detect (3b.2).
          const detectedCategory = (
            fixedCategory
              ? fixedCategory
              : groupCategory
                ? groupCategory
                : confidence >= 70
                  ? suggestedCategory
                  : undefined
          ) as BenefitsCategory | undefined;

          // Default expiration date: 1 year from now
          const defaultExpirationDate = new Date();
          defaultExpirationDate.setFullYear(defaultExpirationDate.getFullYear() + 1);

          newDocuments.push({
            ...tempDoc,
            id: `doc-${Date.now()}-${Math.random()}`,
            file: filePayload,
            ...(storageKeyPayload && { storageKey: storageKeyPayload }),
            language: detectedLanguage,
            category: detectedCategory,
            categorySuggested: suggestedCategory,
            categoryConfidence: confidence,
            expirationDate: defaultExpirationDate.toISOString(),
          });

          // Pass the raw base64 data URL so Gemini can read the PDF directly (handles both text and image-based PDFs)
          const isPdf = file.name.toLowerCase().endsWith(".pdf");
          geminiInputs.push({
            pdfText,
            originalFileName: file.name,
            category: (detectedCategory || groupCategory || fixedCategory || "Other Benefits") as string,
            pdfBase64: isPdf ? base64ForAnalysis : undefined,
          });

          setUploadProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: prev.completed + 1,
                  currentFile: i + 1 < validFiles.length ? validFiles[i + 1].name : null,
                  fileStatuses: prev.fileStatuses.map((s, j) =>
                    j === i ? { ...s, status: "ready" as const } : s
                  ),
                }
              : null
          );
        } catch (error) {
          console.error(`Error converting file ${file.name}:`, error);
          failedFiles.push(file);
          setUploadProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: prev.completed + 1,
                  fileStatuses: prev.fileStatuses.map((s, j) =>
                    j === i ? { ...s, status: "error" as const } : s
                  ),
                }
              : null
          );
          toast.error(`Failed to process: ${file.name}`);
        }
      }

      if (newDocuments.length > 0) {
        // ── Gemini LLM: suggest document names for the batch ──
        if (geminiInputs.length > 0) {
          try {
            setIsAnalyzingNames(true);
            setUploadProgress((prev) => prev ? {
              ...prev,
              currentFile: "AI naming in progress...",
              fileStatuses: prev.fileStatuses.map((s) => ({ ...s, status: "ready" as const })),
            } : null);
            const suggestedNames = await suggestDocumentNamesBatch(geminiInputs);
            if (suggestedNames.length === newDocuments.length) {
              let applied = 0;
              for (let i = 0; i < newDocuments.length; i++) {
                if (suggestedNames[i] && suggestedNames[i].trim()) {
                  newDocuments[i] = {
                    ...newDocuments[i],
                    name: suggestedNames[i].trim(),
                  };
                  applied++;
                }
              }
              // Gemini suggestions applied silently to document names
            }
          } catch (err) {
            console.error("[gemini] Name suggestion failed:", err);
            // Gemini naming failed silently — filenames used as fallback
          }
        }

        const existingNames = new Set(
          documents.map((d) => (d.originalFileName || d.name || "").toLowerCase()),
        );
        const toAdd = newDocuments.filter(
          (d) => !existingNames.has((d.originalFileName || d.name || "").toLowerCase()),
        );
        toAdd.forEach((d) =>
          existingNames.add((d.originalFileName || d.name || "").toLowerCase()),
        );
        if (toAdd.length < newDocuments.length) {
          toast.info("Some files were skipped as duplicates.");
        }
        if (toAdd.length > 0) {
          // Show review UI for uploads without fixed category (single + multi-file)
          if (!fixedCategory) {
            setReviewDocuments(toAdd);
            setIsReviewing(true);
          } else {
            onDocumentsChange([...documents, ...toAdd]);
            const needsCategory = toAdd.filter((d) => !d.category?.trim());
            if (needsCategory.length > 0) {
              toast.info("Category required", {
                description: `Pick a category for ${needsCategory.length} file(s) (use "Apply to all" or each row).`,
              });
              if (
                pdfOnly &&
                onBulkCategoryAssignmentHint &&
                !fixedCategory &&
                needsCategory.length > 1
              ) {
                const hint = computeBulkCategoryAssignmentHint(
                  needsCategory as BulkSuggestInputDoc[],
                );
                if (hint) {
                  onBulkCategoryAssignmentHint(hint);
                }
              }
            }
          }
        }
        resetCurrentFormState();
      }
    } finally {
      if (pdfOnly && failedFiles.length > 0) {
        setFailedBatchFiles(failedFiles);
      }
      setIsUploading(false);
      setIsAnalyzingNames(false);
      setUploadProgress(null);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;

    if (editingDocument) {
      processFile(files[0]);
      return;
    }

    if (files.length === 1) {
      // Route single file through the same flow as multi-file (category dialog + AI naming + review UI)
      if (!fixedCategory) {
        setBatchCategory("Retirement");
        setPendingBatchFiles(files);
        setBatchCategoryDialogOpen(true);
        return;
      }
      void addDocumentsFromFiles(files);
      return;
    }

    // Enforce batch limit
    if (files.length > MAX_BATCH_FILE_COUNT) {
      toast.error(
        `You can upload up to ${MAX_BATCH_FILE_COUNT} files at once. ${files.length} files were selected.`,
      );
      return;
    }

    // Multiple files — show category dialog before processing
    if (!fixedCategory) {
      setBatchCategory("Retirement");
      setPendingBatchFiles(files);
      setBatchCategoryDialogOpen(true);
      return;
    }

    void addDocumentsFromFiles(files);
  };

  const handleAddDocument = async () => {
    // Prevent double-clicks / duplicate submissions
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    try {
      if (!currentDocumentName.trim()) {
        alert("Document name is required");
        return;
      }

      // Validate character limits
      if (currentDocumentName.length > 60) {
        alert("Document name cannot exceed 60 characters");
        return;
      }

      if (currentDocumentDescription.length > 200) {
        alert("Description cannot exceed 200 characters");
        return;
      }

      // In edit mode, file can be existing (from URL) or new (from File)
      if (editingDocument) {
        if (!currentDocumentFile && !currentDocumentFileUrl) {
          alert("Please select a file");
          return;
        }

        // Validate character limits
        if (currentDocumentName.length > 60) {
          alert("Document name cannot exceed 60 characters");
          return;
        }

        if (currentDocumentDescription.length > 200) {
          alert("Description cannot exceed 200 characters");
          return;
        }

        try {
          let fileData = currentDocumentFileUrl || "";
          let fileSize = editingDocument.size;
          let originalFileName = editingDocument.originalFileName || "";
          let storageKeyPayload: string | undefined;

          // If new file is selected: try R2 when clientId set, else base64
          if (currentDocumentFile) {
            if (clientId) {
              try {
                const category = (currentDocumentCategory || fixedCategory || "Other Benefits") as string;
                const key = await uploadFileToR2({
                  file: currentDocumentFile,
                  purpose: "document",
                  clientId,
                  fileName: currentDocumentFile.name,
                  category: toCanonicalCategory(category),
                });
                if (key) {
                  fileData = "r2:stored";
                  storageKeyPayload = key;
                } else {
                  fileData = await fileToBase64(currentDocumentFile);
                }
              } catch {
                fileData = await fileToBase64(currentDocumentFile);
              }
            } else {
              fileData = await fileToBase64(currentDocumentFile);
            }
            fileSize = currentDocumentFile.size;
            originalFileName = currentDocumentFile.name;
          }

          // Truncate to limits if somehow exceeded
          const truncatedName = currentDocumentName.trim().substring(0, 60);
          const truncatedDescription = currentDocumentDescription
            .trim()
            .substring(0, 200);

          const updatedDocument: Document = {
            ...editingDocument,
            name: truncatedName,
            file: fileData,
            size: fileSize,
            shortDescription: truncatedDescription || undefined,
            originalFileName,
            expirationDate: currentDocumentExpirationDate
              ? new Date(currentDocumentExpirationDate).toISOString()
              : undefined,
            category: currentDocumentCategory,
            ...(storageKeyPayload && { storageKey: storageKeyPayload }),
          };

          if (onSaveEdit) {
            onSaveEdit(updatedDocument);
          }

          resetCurrentFormState();
        } catch (error) {
          console.error("Error processing file:", error);
          alert("Failed to process file");
        }
      } else {
        // Add new document mode
        if (!currentDocumentFile) {
          alert("Please select a file");
          return;
        }

        const fileName = currentDocumentFile.name;
        setIsUploading(true);
        setUploadProgress({
          total: 1,
          completed: 0,
          currentFile: fileName,
          fileStatuses: [{ fileName, status: "uploading" as const }],
        });

        try {
          const base64ForAnalysis = await fileToBase64(currentDocumentFile);
          let filePayload: string = base64ForAnalysis;
          let storageKeyPayload: string | undefined;

          if (clientId) {
            try {
              const category = (currentDocumentCategory || fixedCategory || "Other Benefits") as string;
              const key = await uploadFileToR2({
                file: currentDocumentFile,
                purpose: "document",
                clientId,
                fileName: currentDocumentFile.name,
                category: toCanonicalCategory(category),
                onProgress: (loaded, total) => {
                  setUploadProgress((prev) =>
                    prev
                      ? {
                          ...prev,
                          currentFileBytes: { loaded, total },
                          currentFile: currentDocumentFile.name,
                        }
                      : null,
                  );
                },
              });
              if (key) {
                filePayload = "r2:stored";
                storageKeyPayload = key;
              }
            } catch {
              // keep filePayload as base64
            }
          }

          const tempDoc: Document = {
            id: `temp-${Date.now()}-${Math.random()}`,
            name: currentDocumentName.trim(),
            file: base64ForAnalysis,
            type: "other",
            size: currentDocumentFile.size,
            status: "success",
            shortDescription: currentDocumentDescription.trim() || undefined,
            originalFileName: currentDocumentFile.name,
          };

          const detectedLanguage = await guessLanguageFromDocument(tempDoc);

          const truncatedName = currentDocumentName.trim().substring(0, 60);
          const truncatedDescription = currentDocumentDescription
            .trim()
            .substring(0, 200);

          const newDocument: Document = {
            ...tempDoc,
            id: `doc-${Date.now()}-${Math.random()}`,
            name: truncatedName,
            file: filePayload,
            ...(storageKeyPayload && { storageKey: storageKeyPayload }),
            shortDescription: truncatedDescription || undefined,
            language: detectedLanguage, // Store detected language
            expirationDate: currentDocumentExpirationDate
              ? new Date(currentDocumentExpirationDate).toISOString()
              : undefined,
            category: currentDocumentCategory,
            categorySuggested: (currentDocumentFile as any)?._autoDetection?.category,
            categoryConfidence: (currentDocumentFile as any)?._autoDetection?.confidence,
          };

          const sameFile = documents.some(
            (d) => {
              const sameName =
                (d.originalFileName || d.name || "").toLowerCase() ===
                (newDocument.originalFileName || newDocument.name || "").toLowerCase();
              if (!sameName) return false;
              // When fixedCategory is set (e.g. create benefits for Group Health), only treat as duplicate if same category
              if (fixedCategory) return (d.category || "") === fixedCategory;
              return true;
            },
          );
          if (!sameFile) {
            onDocumentsChange([...documents, newDocument]);
          } else {
            toast.info("A document with this file name already exists in this category.");
          }

          setUploadProgress({
            total: 1,
            completed: 1,
            currentFile: null,
            currentFileBytes: undefined,
            fileStatuses: [{ fileName, status: "ready" }],
          });
          resetCurrentFormState();
        } catch (error) {
          console.error("Error processing file:", error);
          setUploadProgress({
            total: 1,
            completed: 1,
            currentFile: null,
            currentFileBytes: undefined,
            fileStatuses: [{ fileName, status: "error" }],
          });
          toast.error("Failed to process file");
        } finally {
          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(null);
          }, 400);
        }
      }
    } finally {
      isAddingRef.current = false;
    }
  };

  const handleDocumentRemove = (id: string) => {
    onDocumentsChange(documents.filter((doc) => doc.id !== id));
  };

  // Review UI handlers
  const handleReviewFieldUpdate = (
    docId: string,
    field: "name" | "shortDescription" | "expirationDate",
    value: string,
  ) => {
    setReviewDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, [field]: value } : d)),
    );
  };

  const handleReviewRemoveOne = (docId: string) => {
    setReviewDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleReviewConfirm = () => {
    const existingNames = new Set(
      documents.map((d) => (d.originalFileName || d.name || "").toLowerCase()),
    );
    const unique = reviewDocuments.filter(
      (d) => !existingNames.has((d.originalFileName || d.name || "").toLowerCase()),
    );
    if (unique.length === 0) {
      toast.info("All files are duplicates of existing documents.");
      setReviewDocuments([]);
      setIsReviewing(false);
      return;
    }
    if (unique.length < reviewDocuments.length) {
      toast.info(
        `${reviewDocuments.length - unique.length} duplicate file(s) skipped.`,
      );
    }
    onDocumentsChange([...documents, ...unique]);
    toast.success(`${unique.length} document(s) added`);
    setReviewDocuments([]);
    setIsReviewing(false);
  };

  const handleReviewCancel = () => {
    setReviewDocuments([]);
    setIsReviewing(false);
  };

  const formatDateForInput = (isoDate?: string): string => {
    if (!isoDate) return "";
    try {
      return isoDate.split("T")[0];
    } catch {
      return "";
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700 pt-6">
      <CardContent className={compactDropzone ? "space-y-3 pt-0" : "space-y-4"}>
        {pdfOnly && failedBatchFiles.length > 0 && !isUploading && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-red-800/40 dark:bg-red-900/10">
            <p className="text-sm text-destructive font-medium">
              {failedBatchFiles.length} file
              {failedBatchFiles.length === 1 ? "" : "s"} could not be uploaded or
              analyzed.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive shrink-0 dark:border-red-800 dark:text-red-400"
              onClick={() => void addDocumentsFromFiles(failedBatchFiles)}
            >
              Retry failed
            </Button>
          </div>
        )}
        {/* Upload Loading Overlay - hidden when progress bar is shown (multi-file) */}
        <LoadingOverlay
          isLoading={isUploading && !uploadProgress}
          message="Uploading documents..."
          hideBackdrop={hideUploadBackdrop}
        />
        {/* Upload progress: bar + per-file status (multi-file only) */}
        {uploadProgress && uploadProgress.total > 0 && (
          <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/5 p-4 space-y-3 dark:border-accent-blue/20 dark:bg-accent-blue/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-accent-blue flex items-center gap-2">
                {isAnalyzingNames && (
                  <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-accent-blue border-t-transparent" />
                )}
                {isAnalyzingNames ? "Naming" : "Uploading"} {uploadProgress.completed} of {uploadProgress.total}
                {uploadProgress.currentFile ? ` — ${uploadProgress.currentFile}` : ""}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%
              </span>
            </div>
            <Progress value={(uploadProgress.completed / uploadProgress.total) * 100} className="h-2" />
            {uploadProgress.currentFileBytes &&
              uploadProgress.currentFileBytes.total > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Current file transfer</span>
                    <span className="tabular-nums">
                      {Math.round(
                        (uploadProgress.currentFileBytes.loaded /
                          uploadProgress.currentFileBytes.total) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      (uploadProgress.currentFileBytes.loaded /
                        uploadProgress.currentFileBytes.total) *
                      100
                    }
                    className="h-1.5"
                  />
                </div>
              )}
            <ul className="space-y-1.5 max-h-32 overflow-y-auto">
              {uploadProgress.fileStatuses.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {(f.status === "ready" || (f.status as string) === "done") && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  )}
                  {f.status === "uploading" && (
                    <Loader2 className="h-4 w-4 text-accent-blue animate-spin flex-shrink-0" />
                  )}
                  {f.status === "analyzing" && (
                    <Loader2 className="h-4 w-4 text-violet-600 animate-spin flex-shrink-0" />
                  )}
                  {f.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  {f.status === "pending" && (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={f.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                    {f.fileName}
                    {f.status === "analyzing" && (
                      <span className="text-violet-600/80 ml-1.5 text-xs">Analyzing</span>
                    )}
                    {f.status === "ready" && (
                      <span className="text-green-700/80 ml-1.5 text-xs">Ready</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* AI Naming in progress indicator — shown while Gemini processes names */}
        {isAnalyzingNames && !isUploading && !isReviewing && (
          <div className="rounded-lg border border-violet-300 bg-violet-50 p-5 flex items-center gap-4 dark:border-violet-700 dark:bg-violet-900/20">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent dark:border-violet-400 dark:border-t-transparent" />
            <div>
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                Generating document names with AI
              </p>
              <p className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5">
                Gemini is reading each document and suggesting a descriptive name...
              </p>
            </div>
          </div>
        )}

        {/* Batch Review UI — shown after multi-file upload processing before committing */}
        {isReviewing && reviewDocuments.length > 0 && !isUploading && (
          <div className="rounded-lg border border-accent-blue/40 bg-accent-blue/5 p-4 space-y-4 dark:border-accent-blue/30 dark:bg-accent-blue/10">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-accent-blue">
                Review {reviewDocuments.length} file
                {reviewDocuments.length !== 1 ? "s" : ""} before adding
              </h4>
              <Badge className="bg-accent-blue/10 text-accent-blue border-transparent text-[10px] dark:bg-accent-blue/20 dark:text-accent-blue dark:bg-accent-blue-light">
                {batchCategory || "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Adjust file names, descriptions, and expiration dates below. Click
              &ldquo;Add all documents&rdquo; when ready.
            </p>
            <Accordion
              type="multiple"
              defaultValue={[reviewDocuments[0]?.id].filter(Boolean)}
              className="space-y-3 max-h-[400px] overflow-y-auto pr-1"
            >
              {reviewDocuments.map((doc, idx) => (
                <AccordionItem
                  key={doc.id}
                  value={doc.id}
                  className="rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden"
                >
                  {/* File info header with prominent index badge — acts as accordion trigger */}
                  <AccordionTrigger className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100 hover:no-underline hover:bg-gray-100/80 dark:bg-gray-700/50 dark:border-gray-700 dark:hover:bg-gray-700/80 [&>svg]:text-gray-400 [&>svg]:dark:text-gray-500">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent-blue text-white text-xs font-bold shrink-0 shadow-sm dark:bg-accent-blue">
                      {idx + 1}
                    </span>
                    <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <FileText className="h-4 w-4 text-accent-blue flex-shrink-0" />
                      <span className="text-xs font-medium truncate dark:text-gray-200">
                        {doc.originalFileName || doc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {(doc as any).language === "ES" ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          ES
                        </span>
                      ) : (doc as any).language === "EN" ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                          EN
                        </span>
                      ) : (doc as any).language ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {(doc as any).language}
                        </span>
                      ) : null}
                      {doc.size && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {Math.round(doc.size / 1024)} KB
                        </span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => handleReviewRemoveOne(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleReviewRemoveOne(doc.id);
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </AccordionTrigger>

                  {/* Editable fields — shown when expanded */}
                  <AccordionContent className="px-4 pb-4 pt-3 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        Document Name
                      </Label>
                      <Input
                        value={doc.name}
                        onChange={(e) =>
                          handleReviewFieldUpdate(doc.id, "name", e.target.value)
                        }
                        maxLength={60}
                        className="h-8 text-xs dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        Description{" "}
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </Label>
                      <Textarea
                        value={doc.shortDescription || ""}
                        onChange={(e) =>
                          handleReviewFieldUpdate(
                            doc.id,
                            "shortDescription",
                            e.target.value,
                          )
                        }
                        maxLength={200}
                        rows={2}
                        className="text-xs dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        Expiration Date{" "}
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="date"
                        value={formatDateForInput(doc.expirationDate)}
                        onChange={(e) =>
                          handleReviewFieldUpdate(
                            doc.id,
                            "expirationDate",
                            e.target.value
                              ? new Date(e.target.value).toISOString()
                              : "",
                          )
                        }
                        className="h-8 text-xs dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                onClick={handleReviewConfirm}
                className="flex-1"
              >
                Add all {reviewDocuments.length} document
                {reviewDocuments.length !== 1 ? "s" : ""}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReviewCancel}
                className="flex-1 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Drag & Drop Upload Area - shown when no file selected and not editing */}
        {!currentDocumentFile &&
          !currentDocumentFileUrl &&
          !editingDocument && (
            <div
              className={`relative border-2 mt-6 border-dashed rounded-lg transition-colors ${
                compactDropzone
                  ? "p-4 sm:p-5"
                  : "p-6 sm:p-8 md:p-12"
              } ${isDragOver
                ? "border-accent-blue bg-accent-blue/5"
                : "border-gray-300 hover:border-accent-blue dark:border-gray-600 dark:hover:border-accent-blue"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <Upload
                  className={`mx-auto text-gray-400 dark:text-gray-500 ${compactDropzone ? "w-7 h-7 sm:w-8 sm:h-8 mb-2" : "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mb-3 sm:mb-4"}`}
                />
                <p
                  className={
                    compactDropzone
                      ? "text-gray-700 font-medium mb-1.5 text-sm dark:text-gray-300"
                      : "text-gray-700 font-medium mb-2 text-sm sm:text-base dark:text-gray-300"
                  }
                >
                  Drag & Drop Files Here
                </p>
                <p
                  className={
                    compactDropzone
                      ? "text-gray-500 text-xs mb-2 dark:text-gray-400"
                      : "text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4 dark:text-gray-400"
                  }
                >
                  or
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleButtonClick}
                    className="border-accent-blue text-accent-blue hover:bg-accent-blue/10 w-full sm:w-auto"
                  >
                    Choose Files
                  </Button>
                  {secondaryAction && !editingDocument && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={secondaryAction.onClick}
                      disabled={secondaryAction.disabled}
                      className="text-accent-blue hover:text-accent-blue/80 w-full sm:w-auto"
                    >
                      {secondaryAction.label}
                    </Button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                id="document-file"
                type="file"
                className="hidden"
                accept={pdfOnly ? ".pdf" : ".pdf,.doc,.docx"}
                multiple
                onChange={handleFileSelect}
              />
            </div>
          )}

        {/* Document Form - shown after file is selected or when editing */}
        {(currentDocumentFile || currentDocumentFileUrl || editingDocument) && (
          <div className="space-y-4 p-3 sm:p-4 border rounded-lg dark:border-gray-600">
            {/* File Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2 dark:bg-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent-blue flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium truncate dark:text-gray-300">
                      {currentDocumentFile
                        ? currentDocumentFile.name
                        : editingDocument?.originalFileName ||
                        editingDocument?.name ||
                        "Current file"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {currentDocumentFile
                        ? `${Math.round(currentDocumentFile.size / 1024)} KB`
                        : editingDocument
                          ? `${Math.round(editingDocument.size / 1024)} KB`
                          : ""}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetCurrentFormState();
                    if (onCancelEdit && editingDocument) {
                      onCancelEdit();
                    }
                  }}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Replace file option when editing */}
              {editingDocument && !currentDocumentFile && (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-4 sm:p-6 transition-colors ${isDragOver
                    ? "border-accent-blue bg-accent-blue/5"
                    : "border-gray-300 hover:border-accent-blue dark:border-gray-600 dark:hover:border-accent-blue"
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <Upload className="mx-auto w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-2 dark:text-gray-500" />
                    <p className="text-gray-700 text-xs sm:text-sm font-medium mb-2 dark:text-gray-300">
                      Replace file (optional)
                    </p>
                    <p className="text-gray-500 text-xs mb-3 dark:text-gray-400">
                      Drag & drop or click to upload a new file
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleButtonClick}
                      className="border-accent-blue text-accent-blue hover:bg-accent-blue/10 w-full sm:w-auto"
                    >
                      Choose New File
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Category - Always show, even if fixed, to give feedback */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between dark:text-gray-300">
                <span>Category</span>
                {isAutoCategorized && (
                  <Badge className="bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/10 border-none px-2 py-0 h-5 text-[11px] font-bold">
                    Auto-categorized
                  </Badge>
                )}
              </Label>
              <Select
                value={currentDocumentCategory}
                onValueChange={(val: any) => setCurrentDocumentCategory(val)}
                disabled={!!fixedCategory} // Category is locked if passed as fixed
              >
                <SelectTrigger className="w-full bg-white border-gray-200 h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retirement">{getDocumentCategoryDisplayLabel("Retirement")}</SelectItem>
                  <SelectItem value="Group Life">{getDocumentCategoryDisplayLabel("Group Life")}</SelectItem>
                  <SelectItem value="Group Health">{getDocumentCategoryDisplayLabel("Group Health")}</SelectItem>
                  <SelectItem value="Other Benefits">{getDocumentCategoryDisplayLabel("Other Benefits")}</SelectItem>
                </SelectContent>
              </Select>
              {fixedCategory && (
                <p className="text-[10px] text-muted-foreground italic">
                  * Locked for this category
                </p>
              )}
            </div>

            {/* Document Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="document-name" className="dark:text-gray-300">
                  Document Name <span className="text-red-500">*</span>
                </Label>
                <span
                  className={`text-xs ${currentDocumentName.length > 60
                    ? "text-red-500"
                    : currentDocumentName.length > 50
                      ? "text-amber-500"
                      : "text-gray-500 dark:text-gray-400"
                    }`}
                >
                  {currentDocumentName.length}/60
                </span>
              </div>
              <Input
                id="document-name"
                value={currentDocumentName}
                onChange={(e) => {
                  if (e.target.value.length <= 60) {
                    setCurrentDocumentName(e.target.value);
                  }
                }}
                placeholder="Document name will be pre-filled from PDF"
                required
                maxLength={60}
                className={`dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${
                  currentDocumentName.length > 60
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }`}
              />
            </div>

            {/* Short Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="document-description" className="dark:text-gray-300">
                  Short Description{" "}
                  <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                </Label>
                <span
                  className={`text-xs ${currentDocumentDescription.length > 200
                    ? "text-red-500"
                    : currentDocumentDescription.length > 180
                      ? "text-amber-500"
                      : "text-gray-500 dark:text-gray-400"
                    }`}
                >
                  {currentDocumentDescription.length}/200
                </span>
              </div>
              <Textarea
                id="document-description"
                value={currentDocumentDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 200) {
                    setCurrentDocumentDescription(e.target.value);
                  }
                }}
                placeholder="Add a brief description to help employees understand this document (optional)"
                rows={3}
                maxLength={200}
                className={`dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${
                  currentDocumentDescription.length > 200
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }`}
              />
            </div>


            {/* Expiration Date */}
            <div className="space-y-2">
              <Label htmlFor="document-expiration-date" className="dark:text-gray-300">
                Expiration Date{" "}
                <span className="text-gray-400 dark:text-gray-500">(optional)</span>
              </Label>
              <Input
                id="document-expiration-date"
                type="date"
                value={currentDocumentExpirationDate}
                onChange={(e) =>
                  setCurrentDocumentExpirationDate(e.target.value)
                }
                min={new Date().toISOString().split("T")[0]}
                className="dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Set an expiration date to receive notifications when this
                document expires
              </p>
            </div>

            {/* Add/Save Document Button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                onClick={handleAddDocument}
                className="flex-1 w-full sm:w-auto"
                disabled={
                  isAddingRef.current ||
                  !currentDocumentName.trim() ||
                  currentDocumentName.length > 60 ||
                  currentDocumentDescription.length > 200
                }
              >
                {editingDocument ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">
                      Add Document
                    </span>
                    <span className="sm:hidden">Add Document</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCurrentFormState();
                  if (onCancelEdit && editingDocument) {
                    onCancelEdit();
                  }
                }}
                className="w-full sm:w-auto dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

    {/* Batch category selection dialog — shown when multiple files are dropped */}
    <AlertDialog
      open={batchCategoryDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setBatchCategoryDialogOpen(false);
          setPendingBatchFiles([]);
        }
      }}
    >
      <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="dark:text-gray-100">
            Assign a category
          </AlertDialogTitle>
          <AlertDialogDescription className="dark:text-gray-400">
            <span className="block mb-3">
              You&rsquo;re uploading{" "}
              <span className="font-semibold text-foreground">
                {pendingBatchFiles.length} files
              </span>{" "}
              at once. Which category should be assigned to this group of
              documents?
            </span>
            <span className="block text-muted-foreground text-xs">
              You can change individual categories later in the review list.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label
            htmlFor="batch-category"
            className="text-sm font-medium mb-2 block dark:text-gray-300"
          >
            Category
          </Label>
          <Select
            value={batchCategory}
            onValueChange={(v: any) => setBatchCategory(v)}
          >
            <SelectTrigger
              id="batch-category"
              className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Retirement">Retirement</SelectItem>
              <SelectItem value="Group Life">Group Life</SelectItem>
              <SelectItem value="Group Health">Group Health</SelectItem>
              <SelectItem value="Other Benefits">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            className="dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={() => {
              setBatchCategoryDialogOpen(false);
              setPendingBatchFiles([]);
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setBatchCategoryDialogOpen(false);
              void addDocumentsFromFiles(pendingBatchFiles, batchCategory);
              setPendingBatchFiles([]);
            }}
          >
            Start uploading {pendingBatchFiles.length} file
            {pendingBatchFiles.length !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>
);
}
