"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileText,
  Minus,
  Plus,
  Pencil,
  GripVertical,
  Building,
  Calendar,
  Trash2,
  Eye,
  MoreHorizontal,
  X,
  Save,
  XCircle,
  Upload,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BenefitsCategory } from "@/types/new-client-wizard";
import { formatUsDate } from "@/lib/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QRCodeSVG } from "qrcode.react";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";

/**
 * Derive a user-facing accordion header title from a benefit category.
 */
function deriveAccordionHeaderTitle(category?: string): string {
  switch (category) {
    case "Group Health":
      return "Health Plan Documents";
    case "Group Life":
      return "Life Insurance Documents";
    case "Company / Plan Sponsor":
      return "Wellness Program Documents";
    default:
      return "Retirement Plan Documents";
  }
}

function isPersistedMongoDocumentId(id: string): boolean {
  if (typeof id !== "string" || id.length !== 24) return false;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return false;
  if (
    id.startsWith("doc-") ||
    id.startsWith("plan-doc-") ||
    id.startsWith("optional-doc-") ||
    id.startsWith("temp-")
  ) {
    return false;
  }
  return true;
}

export type RetirementDocumentLanguage = "EN" | "ES";

export type RetirementDocumentItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  language: RetirementDocumentLanguage;
  meta?: {
    source?: string;
    id?: string;
    type?: string;
    client?: {
      id: string;
      companyName: string;
    };
    uploadedAt?: string;
  };
  category?: BenefitsCategory;
  categorySuggested?: BenefitsCategory;
  categoryConfidence?: number;
  /** When false, QR is hidden (default: treat undefined as on). */
  showQrCode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onToggleShowQrCode?: (next: boolean) => void;
  onArchive?: () => void;
};

interface RetirementDocumentsAccordionProps {
  brandColor?: string;
  accentColor?: string;
  retirementDocs?: RetirementDocumentItem[];
  mode?: "page" | "embedded" | "editable";
  className?: string;
  onEdit?: (doc: RetirementDocumentItem) => void;
  onOrderChange?: (docs: RetirementDocumentItem[]) => void;
  showMetadata?: boolean;
  hideHeader?: boolean;
  title?: string;
  description?: string;
  editingDocId?: string | null;
  onStartEdit?: (docId: string) => void;
  onSaveEdit?: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => void;
  onCancelEdit?: () => void;
  // Language selection (controlled from parent)
  language?: RetirementDocumentLanguage;
  onLanguageChange?: (language: RetirementDocumentLanguage) => void;
  /** Custom title for the accordion toggle header (defaults to "Retirement Plan Documents") */
  accordionHeaderTitle?: string;
  /** When true, shows skeleton placeholders while documents are being fetched */
  loading?: boolean;
}

const defaultRetirementDocs: RetirementDocumentItem[] = [
  {
    id: "enrollment-booklet",
    title: "Enrollment Booklet",
    description: "Complete guide to your retirement plan options",
    href: "#",
    language: "EN",
  },
  {
    id: "qdia-notice",
    title: "QDIA Notice",
    description: "Qualified Default Investment Alternative information",
    href: "#",
    language: "EN",
  },
  {
    id: "auto-enrollment",
    title: "Auto Enrollment Notice",
    description: "Complete guide to your retirement plan options",
    href: "#",
    language: "EN",
  },
  {
    id: "summary-plan",
    title: "Summary Plan Description",
    description: "Comprehensive plan benefits and features",
    href: "#",
    language: "EN",
  },
  {
    id: "participant-fee",
    title: "Participant Fee Disclosure",
    description: "Complete guide to your retirement plan options",
    href: "#",
    language: "EN",
  },
  {
    id: "beneficiary-form",
    title: "Beneficiary Form",
    description: "Complete guide to your retirement plan options",
    href: "#",
    language: "EN",
  },
  {
    id: "rollover-form",
    title: "Rollover Form",
    description: "Complete guide to your retirement plan options",
    href: "#",
    language: "EN",
  },
  {
    id: "annual-report",
    title: "Annual Report",
    description: "Year-end plan performance and financial summary",
    href: "#",
    language: "EN",
  },
  {
    id: "enrollment-booklet-es",
    title: "Folleto de Inscripción",
    description: "Guía completa de las opciones de su plan de jubilación",
    href: "#",
    language: "ES",
  },
];

export function RetirementDocumentsAccordion({
  brandColor = "#002B5B",
  accentColor = "#E6C47A",
  retirementDocs,
  mode = "page",
  className = "",
  onEdit,
  onOrderChange,
  showMetadata = false,
  hideHeader = false,
  title,
  description,
  editingDocId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  language: controlledLanguage,
  onLanguageChange,
  accordionHeaderTitle: explicitAccordionTitle,
  loading = false,
}: RetirementDocumentsAccordionProps) {
  // Use provided retirementDocs or default, but prefer provided (even if empty)
  const actualRetirementDocs =
    retirementDocs !== undefined ? retirementDocs : defaultRetirementDocs;

  // Derive accordion header title from the documents' category when not explicitly provided.
  // This ensures the accordion header matches the Benefit Hub page without callers needing
  // to manually map categories to titles.
  const accordionHeaderTitle = useMemo(() => {
    if (explicitAccordionTitle !== undefined) return explicitAccordionTitle;

    // Collect unique categories from the documents (skip undefined)
    const categories = new Set(
      actualRetirementDocs
        .map((d) => d.category)
        .filter((c): c is BenefitsCategory => !!c),
    );

    // If all documents share a single category, derive the title from it
    if (categories.size === 1) {
      return deriveAccordionHeaderTitle(categories.values().next().value);
    }

    return "Retirement Plan Documents";
  }, [explicitAccordionTitle, actualRetirementDocs]);

  // Use controlled language if provided, otherwise fallback to internal state
  const [internalLanguage, setInternalLanguage] =
    useState<RetirementDocumentLanguage>("EN");

  // Determine which language to use - prefer controlled, fallback to internal
  const language: RetirementDocumentLanguage =
    controlledLanguage !== undefined ? controlledLanguage : internalLanguage;

  const setLanguage = (lang: RetirementDocumentLanguage) => {
    if (onLanguageChange) {
      // Controlled: notify parent
      onLanguageChange(lang);
    } else {
      // Uncontrolled: update internal state
      setInternalLanguage(lang);
    }
  };

  const [openRetirement, setOpenRetirement] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<RetirementDocumentItem | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [orderedDocs, setOrderedDocs] =
    useState<RetirementDocumentItem[]>(actualRetirementDocs);

  const isEditable = mode === "editable";

  // Debug: Log when retirementDocs change

  // Language is now controlled from parent, no need for ref sync

  // Update orderedDocs when actualRetirementDocs changes
  useEffect(() => {
    if (!isEditable) {
      setOrderedDocs(actualRetirementDocs);
      return;
    }

    // For editable mode, check if we need to update
    if (orderedDocs.length === 0) {
      setOrderedDocs(actualRetirementDocs);
      return;
    }

    const existingIds = new Set(orderedDocs.map((d) => d.id));
    const newDocIds = new Set(actualRetirementDocs.map((d) => d.id));

    // Check for added/removed documents
    const hasStructuralChanges =
      actualRetirementDocs.length !== orderedDocs.length ||
      actualRetirementDocs.some((d) => !existingIds.has(d.id)) ||
      orderedDocs.some((d) => !newDocIds.has(d.id));

    // Check for data changes in existing documents
    const hasDataChanges = actualRetirementDocs.some((newDoc) => {
      const existingDoc = orderedDocs.find((d) => d.id === newDoc.id);
      if (!existingDoc) return false;
      return (
        existingDoc.title !== newDoc.title ||
        existingDoc.description !== newDoc.description ||
        existingDoc.href !== newDoc.href
      );
    });

    if (hasStructuralChanges || hasDataChanges) {
      const orderedMap = new Map(orderedDocs.map((d) => [d.id, d]));
      const result: RetirementDocumentItem[] = [];

      // Preserve order from orderedDocs, but update with new data
      orderedDocs.forEach((doc) => {
        const updated = actualRetirementDocs.find((d) => d.id === doc.id);
        if (updated) {
          result.push(updated);
        }
      });

      // Add any new documents that weren't in orderedDocs
      actualRetirementDocs.forEach((doc) => {
        if (!orderedMap.has(doc.id)) {
          result.push(doc);
        }
      });

      setOrderedDocs(result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualRetirementDocs, isEditable]);

  // Use orderedDocs for available languages calculation in editable mode to prevent language switching during drag
  const docsForLanguageCalculation = isEditable
    ? orderedDocs
    : actualRetirementDocs;

  const availableLanguages = useMemo<RetirementDocumentLanguage[]>(
    () =>
      (["EN", "ES"] as RetirementDocumentLanguage[]).filter((lang) =>
        docsForLanguageCalculation.some(
          (doc) =>
            normalizePortalDocumentLanguage(doc.language, "EN") === lang,
        ),
      ),
    [docsForLanguageCalculation],
  );

  // Store the previous available languages to prevent language switching during drag operations
  const prevAvailableLanguagesRef = useRef<RetirementDocumentLanguage[]>([]);

  // Auto-switch language only if current language is not available (and not controlled)
  useEffect(() => {
    if (controlledLanguage !== undefined) {
      // Language is controlled from parent, don't auto-switch
      return;
    }

    const currentLang = language;

    // Check if current language is still available
    const currentLangAvailable = docsForLanguageCalculation.some(
      (doc) =>
        normalizePortalDocumentLanguage(doc.language, "EN") === currentLang,
    );

    // Only change language if current language is not available
    if (
      availableLanguages.length > 0 &&
      !availableLanguages.includes(currentLang) &&
      !currentLangAvailable
    ) {
      const newLang = availableLanguages[0];
      setInternalLanguage(newLang);
    }
  }, [
    language,
    availableLanguages,
    docsForLanguageCalculation,
    controlledLanguage,
  ]);

  const currentLanguage = language;

  const filteredRetirementDocs = (
    isEditable ? orderedDocs : actualRetirementDocs
  ).filter(
    (doc) =>
      normalizePortalDocumentLanguage(doc.language, "EN") === currentLanguage,
  );

  const handleSortChange = (newOrder: RetirementDocumentItem[]) => {
    if (!isEditable) return;

    // Use current language value
    const currentLang = language;

    // Get all docs of current language and other languages
    const docsSameLang = orderedDocs.filter(
      (d) => normalizePortalDocumentLanguage(d.language, "EN") === currentLang,
    );
    const otherDocs = orderedDocs.filter(
      (d) => normalizePortalDocumentLanguage(d.language, "EN") !== currentLang,
    );

    // Create a map of new order by id for quick lookup
    const newOrderMap = new Map(newOrder.map((doc) => [doc.id, doc]));

    // Update docs of current language with new order, preserving data
    const reorderedLangDocs = newOrder.map((doc) => {
      const existing = docsSameLang.find((d) => d.id === doc.id);
      return existing || doc;
    });

    // Combine: other language docs first, then reordered current language docs
    const updated = [...otherDocs, ...reorderedLangDocs];

    setOrderedDocs(updated);
    onOrderChange?.(updated);
  };

  const outerClasses =
    mode === "page" ? `py-8 sm:py-16 bg-white ${className}` : className;
  const containerClasses =
    mode === "page" ? "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" : "space-y-6";

  return (
    <>
      {title && (
        <div className="text-center bg-white pt-12 dark:bg-gray-800 border-b-0">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2
              className="font-dm-serif text-3xl leading-tight mb-4 sm:text-4xl lg:text-[40px]"
              style={{ color: brandColor }}
            >
              {title}
            </h2>
            {description && (
              <p className="text-base font-red-hat leading-relaxed dark:text-gray-300">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
      <section className={outerClasses}>
        <div className={containerClasses}>
          {loading ? (
            <DocsGridSkeleton brandColor={brandColor} />
          ) : hideHeader ? (
            // Simple grid view without accordion wrapper
            <DocsGrid
              docs={filteredRetirementDocs}
              brandColor={brandColor}
              accentColor={accentColor}
              onPreview={(doc) => {
                setPreviewDoc(doc);
                setIsPreviewOpen(true);
              }}
              onEdit={onEdit}
              isDraggable={isEditable}
              onSortChange={isEditable ? handleSortChange : undefined}
              showMetadata={showMetadata}
              editingDocId={editingDocId}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
            />
          ) : (
            <div
              className="overflow-hidden rounded-md border bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700"
            >
              {/* RETIREMENT SECTION HEADER */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors duration-200 dark:bg-gray-800"
                onClick={() => setOpenRetirement((prev) => !prev)}
                style={{
                  borderColor: `${brandColor}80`,
                  backgroundColor: "white",
                }}
              >
                <span
                  className="text-xl leading-tight font-dm-serif font-semibold transition-colors duration-200 sm:text-[24px]"
                  style={{ color: brandColor }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = brandColor;
                  }}
                >
                  {accordionHeaderTitle}
                </span>
                {openRetirement ? (
                  <Minus className="h-4 w-4" style={{ color: brandColor }} />
                ) : (
                  <Plus className="h-4 w-4" style={{ color: brandColor }} />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${openRetirement
                  ? "max-h-[2000px] opacity-100"
                  : "max-h-0 opacity-0"
                  }`}
              >
                <div className="px-6 pb-8 pt-4">
                  {/* LANGUAGE SWITCHER */}
                  {availableLanguages.length > 1 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      {availableLanguages.map((lang) => {
                        const isActive = currentLanguage === lang;
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              setLanguage(lang);
                            }}
                            className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border ${isActive
                              ? "bg-[#002B5B] text-white border-[#002B5B]"
                              : "bg-white text-[#002B5B] border-[#D1D5DB] dark:bg-gray-700 dark:text-accent-blue-light dark:border-gray-600"
                              }`}
                          >
                            {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {loading ? (
                    <DocsGridSkeleton brandColor={brandColor} />
                  ) : (
                    <DocsGrid
                      docs={filteredRetirementDocs}
                      brandColor={brandColor}
                      accentColor={accentColor}
                      onPreview={(doc) => {
                        setPreviewDoc(doc);
                        setIsPreviewOpen(true);
                      }}
                      onEdit={onEdit}
                      isDraggable={isEditable}
                      onSortChange={isEditable ? handleSortChange : undefined}
                      showMetadata={showMetadata}
                      editingDocId={editingDocId}
                      onStartEdit={onStartEdit}
                      onSaveEdit={onSaveEdit}
                      onCancelEdit={onCancelEdit}
                    />
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </section>

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) setPreviewDoc(null);
        }}
      >
        <DialogContent className="max-w-5xl dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">{previewDoc?.title || "Document preview"}</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {previewDoc?.description ||
                "Preview the document or download it for offline use."}
            </DialogDescription>
          </DialogHeader>

          {previewDoc?.href ? (
            <div className="space-y-4">
              <div className="h-[70vh] w-full overflow-hidden rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-600">
                <iframe
                  src={previewDoc.href}
                  className="h-full w-full"
                  title={previewDoc.title}
                />
              </div>
              <div className="flex justify-end">
                <Button asChild>
                  <a href={previewDoc.href} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Preview not available for this document.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableCard({
  doc,
  brandColor,
  accentColor,
  onPreview,
  onEdit,
  showMetadata = false,
  editingDocId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  doc: RetirementDocumentItem;
  brandColor: string;
  accentColor: string;
  onPreview: (doc: RetirementDocumentItem) => void;
  onEdit?: (doc: RetirementDocumentItem) => void;
  showMetadata?: boolean;
  editingDocId?: string | null;
  onStartEdit?: (docId: string) => void;
  onSaveEdit?: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => void;
  onCancelEdit?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingDocId === doc.id;
  const [editTitle, setEditTitle] = useState(doc.title);
  const [editDescription, setEditDescription] = useState(doc.description);
  const [editCategory, setEditCategory] = useState<BenefitsCategory | undefined>(doc.category);
  const [editFile, setEditFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasEditingRef = useRef(false);
  const [qrOrigin, setQrOrigin] = useState("");
  const persistedMongoId = isPersistedMongoDocumentId(doc.id);
  const qrViewUrl =
    persistedMongoId &&
    doc.showQrCode !== false &&
    qrOrigin &&
    `${qrOrigin}/api/documents/${doc.id}/view`;

  useEffect(() => {
    if (isEditing) {
      if (!wasEditingRef.current) {
        wasEditingRef.current = true;
        setEditTitle(doc.title);
        setEditDescription(doc.description);
        setEditCategory(doc.category);
        setEditFile(null);
      }
    } else {
      wasEditingRef.current = false;
    }
  }, [isEditing, doc.title, doc.description, doc.category]);

  useEffect(() => {
    setQrOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const handleStartEdit = () => {
    if (onStartEdit) {
      onStartEdit(doc.id);
    } else if (onEdit) {
      onEdit(doc);
    }
  };

  const handleSave = () => {
    if (onSaveEdit) {
      if (editTitle.trim().length === 0) {
        alert("Title cannot be empty");
        return;
      }
      if (editTitle.length > 85) {
        alert("Title cannot exceed 85 characters");
        return;
      }
      if (editDescription.length > 200) {
        alert("Description cannot exceed 200 characters");
        return;
      }

      onSaveEdit(
        doc.id,
        editTitle.trim(),
        editDescription.trim(),
        editFile || undefined,
        editCategory,
      );
    }
  };

  const handleCancel = () => {
    setEditTitle(doc.title);
    setEditDescription(doc.description);
    setEditFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file");
        return;
      }
      setEditFile(file);
    }
  };

  return (
    <div ref={setNodeRef} className="h-full" style={style}>
      <Card
        className={`h-full shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md ${
          isDragging ? "bg-gray-100" : "bg-white"
        }`}
        style={{
          borderColor: `${brandColor}26`,
          borderWidth: 1,
        }}
      >
        <CardContent className="flex min-h-[320px] h-full flex-col items-center px-6 pt-1 pb-8 text-center relative overflow-hidden">
          {/* Top row — drag handle, category badge right next to it (left-aligned),
              and Edit/Delete actions pushed to the right. */}
          <div className="w-full mb-5 flex items-center gap-2 min-w-0">
            <div
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <GripVertical className="h-5 w-5" />
            </div>
            {doc.category && (
              <Badge
                variant="outline"
                className="text-[11px] font-bold px-2 py-0 h-5 bg-white shadow-sm whitespace-nowrap flex-shrink-0"
                style={{ color: brandColor, borderColor: `${brandColor}40` }}
              >
                {doc.category}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              {!isEditing && (onEdit || onStartEdit) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Edit document"
                  title="Edit document"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {doc.onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    doc.onDelete?.();
                  }}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Delete document"
                  title="Delete document"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <>
              <div className="w-full mb-4">
                <label className="text-xs text-gray-600 font-medium mb-2 block">
                  PDF File
                </label>
                <div
                  className="border-2 border-dashed rounded-md p-4 cursor-pointer hover:border-gray-400 transition-colors"
                  style={{
                    borderColor: editFile ? accentColor : `${brandColor}40`,
                    backgroundColor: editFile
                      ? `${accentColor}0F`
                      : "transparent",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center">
                    {editFile ? (
                      <>
                        <FileText
                          className="h-8 w-8 mb-2"
                          style={{ color: accentColor }}
                        />
                        <p
                          className="text-xs font-medium text-center truncate w-full"
                          style={{ color: brandColor }}
                        >
                          {editFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(editFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mb-2 text-gray-400" />
                        <p className="text-xs text-gray-600 text-center">
                          Click to upload PDF
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PDF only</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600 font-medium">
                    Category
                  </label>
                </div>
                <Select
                  value={editCategory}
                  onValueChange={(value) => setEditCategory(value as BenefitsCategory)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Retirement">Retirement</SelectItem>
                    <SelectItem value="Group Life">Group Life</SelectItem>
                    <SelectItem value="Group Health">Group Health</SelectItem>
                    <SelectItem value="Multiple">Multiple</SelectItem>
                    <SelectItem value="Other Benefits">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600 font-medium">
                    Title
                  </label>
                  <span
                    className={`text-xs ${editTitle.length > 85
                      ? "text-red-500"
                      : editTitle.length > 75
                        ? "text-amber-500"
                        : "text-gray-500"
                      }`}
                  >
                    {editTitle.length}/85
                  </span>
                </div>
                <Input
                  value={editTitle}
                  onChange={(e) => {
                    if (e.target.value.length <= 85) {
                      setEditTitle(e.target.value);
                    }
                  }}
                  maxLength={85}
                  className={`text-center text-sm font-semibold ${editTitle.length > 85
                    ? "border-red-500 focus:border-red-500"
                    : ""
                    }`}
                  style={{ fontFamily: '"DM Serif Display", serif' }}
                  autoFocus
                />
              </div>
              <div className="w-full mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600 font-medium">
                    Description
                  </label>
                  <span
                    className={`text-xs ${editDescription.length > 160
                      ? "text-red-500"
                      : editDescription.length > 150
                        ? "text-amber-500"
                        : "text-gray-500"
                      }`}
                  >
                    {editDescription.length}/160
                  </span>
                </div>
                <Textarea
                  value={editDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= 160) {
                      setEditDescription(e.target.value);
                    }
                  }}
                  maxLength={160}
                  rows={2}
                  className={`text-center text-xs ${editDescription.length > 160
                    ? "border-red-500 focus:border-red-500"
                    : ""
                    }`}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-md"
                style={{ backgroundColor: `${accentColor}1F` }}
              >
                <FileText className="h-6 w-6" style={{ color: accentColor }} />
              </div>
              <h4
                className="mb-2 text-base font-semibold line-clamp-2 break-words"
                style={{ color: brandColor, fontFamily: '"DM Serif Display", serif' }}
                title={doc.title}
              >
                {doc.title}
              </h4>

              <p
                className="mb-4 text-xs text-[#6B6B6B] line-clamp-3 break-words"
                title={doc.description}
              >
                {doc.description}
              </p>
              {qrViewUrl && (
                <div className="mb-4 flex flex-col items-center gap-1.5 w-full">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Scan to open
                  </span>
                  <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
                    <QRCodeSVG value={qrViewUrl} size={88} level="M" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Metadata section */}
          {showMetadata && (
            <div className="w-full mb-4 space-y-2 text-left">
              {doc.meta?.client && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Building className="h-3 w-3" />
                  <span>{doc.meta.client.companyName}</span>
                </div>
              )}
              {doc.meta?.uploadedAt && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatUsDate(doc.meta.uploadedAt)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto flex w-full gap-2 min-w-0">
            <Button
              className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden text-white"
              style={{
                backgroundColor: brandColor,
                borderColor: brandColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = accentColor;
                e.currentTarget.style.borderColor = accentColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = brandColor;
                e.currentTarget.style.borderColor = brandColor;
              }}
              onClick={() => onPreview(doc)}
            >
              <Download className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">VIEW/DOWNLOAD</span>
            </Button>

            {showMetadata &&
              !isEditing &&
              (onEdit ||
                onStartEdit ||
                doc.onEdit ||
                doc.onDelete ||
                doc.onArchive ||
                doc.onToggleShowQrCode) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      style={{ borderColor: brandColor }}
                    >
                      <MoreHorizontal
                        className="h-4 w-4"
                        style={{ color: brandColor }}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(onEdit || onStartEdit || doc.onEdit) && (
                      <DropdownMenuItem
                        onClick={() => {
                          if (doc.onEdit) {
                            doc.onEdit();
                          } else if (onStartEdit) {
                            onStartEdit(doc.id);
                          } else if (onEdit) {
                            onEdit(doc);
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit/Update
                      </DropdownMenuItem>
                    )}
                    {doc.onToggleShowQrCode && persistedMongoId && (
                      <DropdownMenuItem
                        onClick={() =>
                          doc.onToggleShowQrCode!(doc.showQrCode === false)
                        }
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {doc.showQrCode === false
                          ? "Show QR code"
                          : "Hide QR code"}
                      </DropdownMenuItem>
                    )}
                    {doc.onArchive && persistedMongoId && (
                      <DropdownMenuItem onClick={doc.onArchive}>
                        <Minus className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    {doc.onDelete && (
                      <DropdownMenuItem
                        onClick={doc.onDelete}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden"
                  style={{
                    borderColor: brandColor,
                    color: brandColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = accentColor;
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = brandColor;
                    e.currentTarget.style.color = brandColor;
                  }}
                  onClick={handleSave}
                  disabled={
                    !editTitle.trim() ||
                    editTitle.length > 85 ||
                    editDescription.length > 160
                  }
                >
                  <Save className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">SAVE</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden"
                  onClick={handleCancel}
                >
                  <XCircle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">CANCEL</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocsGridSkeleton({ brandColor }: { brandColor: string }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card
          key={i}
          className="bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700"
          style={{
            borderColor: `${brandColor}26`,
            borderWidth: 1,
          }}
        >
          <CardContent className="flex min-h-[320px] h-full flex-col items-center px-6 py-8 text-center relative overflow-hidden">
            <Skeleton className="mb-4 h-12 w-12 rounded-md" />
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-6 h-4 w-full" />
            <Skeleton className="mt-auto h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface DocsGridProps {
  docs: RetirementDocumentItem[];
  brandColor: string;
  accentColor: string;
  onPreview: (doc: RetirementDocumentItem) => void;
  onEdit?: (doc: RetirementDocumentItem) => void;
  isDraggable?: boolean;
  onSortChange?: (docs: RetirementDocumentItem[]) => void;
  showMetadata?: boolean;
  editingDocId?: string | null;
  onStartEdit?: (docId: string) => void;
  onSaveEdit?: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => void;
  onCancelEdit?: () => void;
}

export function DocsGrid({
  docs,
  brandColor,
  accentColor,
  onPreview,
  onEdit,
  isDraggable = false,
  onSortChange,
  showMetadata = false,
  editingDocId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: DocsGridProps) {
  // All hooks must be called before any conditional returns
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));
  const [localEditingDocId, setLocalEditingDocId] = useState<string | null>(
    editingDocId || null,
  );
  const [editTitles, setEditTitles] = useState<Map<string, string>>(new Map());
  const [editDescriptions, setEditDescriptions] = useState<Map<string, string>>(
    new Map(),
  );
  const [editFiles, setEditFiles] = useState<Map<string, File>>(new Map());
  const [editCategories, setEditCategories] = useState<Map<string, BenefitsCategory>>(new Map());
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    setLocalEditingDocId(editingDocId || null);
    if (!editingDocId) {
      setEditFiles(new Map());
      setEditTitles(new Map());
      setEditDescriptions(new Map());
      setEditCategories(new Map());
      fileInputRefs.current.forEach((ref) => {
        if (ref) ref.value = "";
      });
      return;
    }
    // When an external editingDocId is provided (e.g. wizard preview),
    // ensure we initialize title/description for that specific document
    const doc = docs.find((d) => d.id === editingDocId);
    if (doc) {
      setEditTitles((prev) => {
        const newMap = new Map(prev);
        if (!newMap.has(editingDocId)) {
          newMap.set(editingDocId, doc.title);
        }
        return newMap;
      });
      setEditDescriptions((prev) => {
        const newMap = new Map(prev);
        if (!newMap.has(editingDocId)) {
          newMap.set(editingDocId, doc.description);
        }
        return newMap;
      });
      setEditCategories((prev) => {
        const newMap = new Map(prev);
        if (!newMap.has(editingDocId) && doc.category) {
          newMap.set(editingDocId, doc.category);
        }
        return newMap;
      });
    }
  }, [editingDocId, docs]);

  if (!docs.length) {
    return (
      <p className="text-sm text-[#6B6B6B] dark:text-gray-400">
        No documents available in this language yet.
      </p>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over || !onSortChange) return;

    if (active.id !== over.id) {
      const oldIndex = docs.findIndex((doc) => doc.id === active.id);
      const newIndex = docs.findIndex((doc) => doc.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(docs, oldIndex, newIndex);
        onSortChange(newOrder);
      }
    }

    setActiveId(null);
  };

  const activeDoc = docs.find((d) => d.id === activeId);

  const handleStartEdit = (docId: string) => {
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      setLocalEditingDocId(docId);
      setEditTitles((prev) => {
        const newMap = new Map(prev);
        newMap.set(docId, doc.title);
        return newMap;
      });
      setEditDescriptions((prev) => {
        const newMap = new Map(prev);
        newMap.set(docId, doc.description);
        return newMap;
      });
      setEditCategories((prev) => {
        const newMap = new Map(prev);
        if (doc.category) {
          newMap.set(docId, doc.category);
        }
        return newMap;
      });
      setEditFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(docId);
        return newMap;
      });
      const inputRef = fileInputRefs.current.get(docId);
      if (inputRef) {
        inputRef.value = "";
      }
      if (onStartEdit) {
        onStartEdit(docId);
      }
    }
  };

  const handleSaveEdit = (
    docId: string,
    title: string,
    description: string,
    file: File | undefined,
    category?: BenefitsCategory,
  ) => {
    if (title.trim().length === 0) {
      alert("Title cannot be empty");
      return;
    }
    if (title.length > 85) {
      alert("Title cannot exceed 85 characters");
      return;
    }
    if (description.length > 160) {
      alert("Description cannot exceed 160 characters");
      return;
    }
    if (onSaveEdit) {
      // Use the file parameter if provided, otherwise get from editFiles Map
      const fileToSave = file || editFiles.get(docId);
      onSaveEdit(
        docId,
        title.trim(),
        description.trim(),
        fileToSave || undefined,
        category,
      );
    }
    setLocalEditingDocId(null);
    setEditFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(docId);
      return newMap;
    });
    setEditTitles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(docId);
      return newMap;
    });
    setEditDescriptions((prev) => {
      const newMap = new Map(prev);
      newMap.delete(docId);
      return newMap;
    });
    setEditCategories((prev) => {
      const newMap = new Map(prev);
      newMap.delete(docId);
      return newMap;
    });
    const inputRef = fileInputRefs.current.get(docId);
    if (inputRef) {
      inputRef.value = "";
    }
  };

  const handleCancelEdit = () => {
    setLocalEditingDocId(null);
    setEditFiles(new Map());
    setEditTitles(new Map());
    setEditDescriptions(new Map());
    setEditCategories(new Map());
    fileInputRefs.current.forEach((ref) => {
      if (ref) ref.value = "";
    });
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleFileSelect =
    (docId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.type !== "application/pdf") {
          alert("Please upload a PDF file");
          return;
        }
        setEditFiles((prev) => {
          const newMap = new Map(prev);
          newMap.set(docId, file);
          return newMap;
        });
      }
    };

  const setFileInputRef = (docId: string) => (el: HTMLInputElement | null) => {
    if (el) {
      fileInputRefs.current.set(docId, el);
    } else {
      fileInputRefs.current.delete(docId);
    }
  };

  const gridContent = (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => {
        const isEditing = localEditingDocId === doc.id;
        const cardContent = (
          <Card
            className="bg-white shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-gray-800 dark:border-gray-700"
            style={{
              borderColor: `${brandColor}26`,
              borderWidth: 1,
            }}
          >
            <CardContent className="flex min-h-[320px] h-full flex-col items-center px-6 py-8 text-center relative overflow-hidden">
              {/* Delete button - top right corner */}
              {doc.onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    doc.onDelete?.();
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  aria-label="Delete document"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {isDraggable && (
                <div
                  className="mb-2 self-start cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  style={{ touchAction: "none" }}
                >
                  <GripVertical className="h-5 w-5" />
                </div>
              )}
              {isEditing ? (
                <>
                  <div className="w-full mb-4">
                    <label className="text-xs text-gray-600 font-medium mb-2 block dark:text-gray-300">
                      PDF File
                    </label>
                    <div
                      className="border-2 border-dashed rounded-md p-4 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors dark:border-gray-600"
                      style={{
                        borderColor: editFiles.get(doc.id)
                          ? accentColor
                          : `${brandColor}40`,
                        backgroundColor: editFiles.get(doc.id)
                          ? `${accentColor}0F`
                          : "transparent",
                      }}
                      onClick={() => {
                        const inputRef = fileInputRefs.current.get(doc.id);
                        inputRef?.click();
                      }}
                    >
                      <input
                        ref={setFileInputRef(doc.id)}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileSelect(doc.id)}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center">
                        {editFiles.get(doc.id) ? (
                          <>
                            <FileText
                              className="h-8 w-8 mb-2"
                              style={{ color: accentColor }}
                            />
                            <p
                              className="text-xs font-medium text-center truncate w-full"
                              style={{ color: brandColor }}
                            >
                              {editFiles.get(doc.id)!.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                              {(
                                editFiles.get(doc.id)!.size /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MB
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mb-2 text-gray-400 dark:text-gray-500" />
                            <p className="text-xs text-gray-600 text-center dark:text-gray-300">
                              Click to upload PDF
                            </p>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                              PDF only
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-full mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-600 font-medium dark:text-gray-300">
                        Category
                      </label>
                    </div>
                    <Select
                      value={editCategories.get(doc.id) || doc.category || undefined}
                      onValueChange={(value) => {
                        setEditCategories((prev) => {
                          const newMap = new Map(prev);
                          newMap.set(doc.id, value as BenefitsCategory);
                          return newMap;
                        });
                      }}
                    >
                      <SelectTrigger className="w-full h-8 text-xs dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Retirement">Retirement</SelectItem>
                        <SelectItem value="Group Life">Group Life</SelectItem>
                        <SelectItem value="Group Health">Group Health</SelectItem>
                        <SelectItem value="Multiple">Multiple</SelectItem>
                        <SelectItem value="Other Benefits">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-600 font-medium dark:text-gray-300">
                        Title
                      </label>
                      <span
                        className={`text-xs ${(editTitles.get(doc.id) || "").length > 85
                          ? "text-red-500"
                          : (editTitles.get(doc.id) || "").length > 75
                            ? "text-amber-500"
                            : "text-gray-500 dark:text-gray-400"
                          }`}
                      >
                        {(editTitles.get(doc.id) || "").length}/85
                      </span>
                    </div>
                    <Input
                      value={editTitles.get(doc.id) || ""}
                      onChange={(e) => {
                        if (e.target.value.length <= 85) {
                          setEditTitles((prev) => {
                            const newMap = new Map(prev);
                            newMap.set(doc.id, e.target.value);
                            return newMap;
                          });
                        }
                      }}
                      maxLength={85}
                      className={`text-center text-sm font-semibold dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${(editTitles.get(doc.id) || "").length > 85
                        ? "border-red-500 focus:border-red-500"
                        : ""
                        }`}
                      style={{ fontFamily: '"DM Serif Display", serif' }}
                      autoFocus
                    />
                  </div>
                  <div className="w-full mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-600 font-medium dark:text-gray-300">
                        Description
                      </label>
                      <span
                        className={`text-xs ${(editDescriptions.get(doc.id) || "").length > 200
                          ? "text-red-500"
                          : (editDescriptions.get(doc.id) || "").length > 180
                            ? "text-amber-500"
                            : "text-gray-500 dark:text-gray-400"
                          }`}
                      >
                        {(editDescriptions.get(doc.id) || "").length}/200
                      </span>
                    </div>
                    <Textarea
                      value={editDescriptions.get(doc.id) || ""}
                      onChange={(e) => {
                        if (e.target.value.length <= 200) {
                          setEditDescriptions((prev) => {
                            const newMap = new Map(prev);
                            newMap.set(doc.id, e.target.value);
                            return newMap;
                          });
                        }
                      }}
                      maxLength={200}
                      rows={2}
                      className={`text-center text-xs dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 ${(editDescriptions.get(doc.id) || "").length > 200
                        ? "border-red-500 focus:border-red-500"
                        : ""
                        }`}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-md transition-transform duration-200 dark:bg-accent-blue/20"
                    style={{
                      backgroundColor: `${accentColor}1F`,
                    }}
                  >
                    <span className="text-xl dark:!text-accent-blue" style={{ color: accentColor }}>
                      <FileText
                        className="h-6 w-6 dark:!text-accent-blue"
                        style={{ color: accentColor }}
                      />
                    </span>
                  </div>
                  <h4
                    className="mb-2 text-[20px] leading-tight font-dm-serif font-semibold line-clamp-2 break-words dark:text-gray-100"
                    title={doc.title}
                  >
                    {doc.title}
                  </h4>
                  <p
                    className={`text-[14px] leading-tight font-red-hat line-clamp-3 break-words dark:text-gray-300 ${showMetadata ? "mb-4" : "mb-6"
                      }`}
                    title={doc.description}
                  >
                    {doc.description}
                  </p>
                </>
              )}

              {doc.category && (
                <div className={`absolute top-4 ${isDraggable ? "left-11" : "left-4"} flex flex-col gap-1 items-start z-10`}>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-bold px-2 py-0 h-5 border-gray-200 text-gray-500 bg-white shadow-sm dark:border-gray-600 dark:text-gray-300 dark:bg-gray-700"
                  >
                    {doc.category}
                  </Badge>
                </div>
              )}
              {/* Metadata section */}
              {showMetadata && (
                <div className="w-full mb-4 space-y-2 text-left">
                  {doc.meta?.client && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Building className="h-3 w-3 dark:text-gray-500" />
                      <span>{doc.meta.client.companyName}</span>
                    </div>
                  )}
                  {doc.meta?.uploadedAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Calendar className="h-3 w-3 dark:text-gray-500" />
                      <span>
                        {formatUsDate(doc.meta.uploadedAt)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto flex w-full gap-2 min-w-0">
                <Button
                  className="flex-1 flex items-center justify-center gap-2 text-[14px] leading-tight font-red-hat font-semibold tracking-wide transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden text-white"
                  style={{
                    backgroundColor: brandColor,
                    borderColor: brandColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = accentColor;
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = brandColor;
                    e.currentTarget.style.borderColor = brandColor;
                  }}
                  onClick={() => onPreview(doc)}
                >
                  <Download className="h-3 w-3" />
                  VIEW/DOWNLOAD
                </Button>
                {showMetadata &&
                  !isEditing &&
                  (onEdit || onStartEdit || doc.onEdit || doc.onDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          style={{ borderColor: brandColor }}
                        >
                          <MoreHorizontal
                            className="h-4 w-4"
                            style={{ color: brandColor }}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(onEdit || onStartEdit || doc.onEdit) && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (doc.onEdit) {
                                doc.onEdit();
                              } else if (onStartEdit) {
                                onStartEdit(doc.id);
                              } else if (onEdit) {
                                onEdit(doc);
                              }
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit/Update
                          </DropdownMenuItem>
                        )}
                        {doc.onDelete && (
                          <DropdownMenuItem
                            onClick={doc.onDelete}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden"
                      style={{
                        borderColor: brandColor,
                        color: brandColor,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = accentColor;
                        e.currentTarget.style.borderColor = accentColor;
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.color = brandColor;
                      }}
                      onClick={() => {
                        const title = editTitles.get(doc.id) || "";
                        const description = editDescriptions.get(doc.id) || "";
                        const file = editFiles.get(doc.id) || undefined;
                        const category = editCategories.get(doc.id) || doc.category;
                        handleSaveEdit(doc.id, title, description, file, category);
                      }}
                      disabled={
                        !(editTitles.get(doc.id) || "").trim() ||
                        (editTitles.get(doc.id) || "").length > 85 ||
                        (editDescriptions.get(doc.id) || "").length > 200
                      }
                    >
                      <Save className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">SAVE</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden"
                      onClick={handleCancelEdit}
                    >
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">CANCEL</span>
                    </Button>
                  </>
                ) : (
                  !showMetadata &&
                  (onEdit || onStartEdit) && (
                    <Button
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-105 min-w-0 overflow-hidden dark:!text-accent-blue dark:!border-accent-blue"
                      style={{
                        borderColor: brandColor,
                        color: brandColor,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = accentColor;
                        e.currentTarget.style.borderColor = accentColor;
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.color = brandColor;
                      }}
                      onClick={() => {
                        if (onStartEdit) {
                          handleStartEdit(doc.id);
                        } else if (onEdit) {
                          onEdit(doc);
                        }
                      }}
                    >
                      <Pencil className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Edit/Update</span>
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        );

        if (isDraggable) {
          return (
            <SortableCard
              key={doc.id}
              doc={doc}
              brandColor={brandColor}
              accentColor={accentColor}
              onPreview={onPreview}
              onEdit={onEdit}
              showMetadata={showMetadata}
              editingDocId={localEditingDocId}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
            />
          );
        }

        return <div key={doc.id}>{cardContent}</div>;
      })}
    </div>
  );

  if (isDraggable && onSortChange) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={docs} strategy={rectSortingStrategy}>
          {gridContent}
        </SortableContext>

        <DragOverlay>
          {activeDoc ? (
            <Card
              className="bg-white shadow-xl scale-105 opacity-90"
              style={{
                borderColor: `${brandColor}40`,
                borderWidth: 1,
              }}
            >
              <CardContent className="flex flex-col items-center px-6 py-8 text-center">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${accentColor}1F` }}
                >
                  <FileText
                    className="h-6 w-6"
                    style={{ color: accentColor }}
                  />
                </div>

                <h4
                  className="mb-2 text-base font-semibold line-clamp-2 break-words"
                  style={{ fontFamily: '"DM Serif Display", serif' }}
                  title={activeDoc.title}
                >
                  {activeDoc.title}
                </h4>

                <p
                  className="mb-6 text-xs text-[#6B6B6B] line-clamp-3 break-words"
                  title={activeDoc.description}
                >
                  {activeDoc.description}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return gridContent;
}
