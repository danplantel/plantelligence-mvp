"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

interface DocumentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    description?: string;
    fileName?: string;
    category?: string;
  } | null;
  onSave: (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: string,
  ) => Promise<void>;
}

export function DocumentEditModal({
  isOpen,
  onClose,
  document,
  onSave,
}: DocumentEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [editMultipleCategories, setEditMultipleCategories] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document && isOpen) {
      setTitle(document.title || "");
      setDescription(document.description || "");
      const docCat = String((document as any).category || "");
      setCategory(docCat);
      // If category contains commas, pre-populate the multiple selection
      if (docCat.includes(",")) {
        setEditMultipleCategories(docCat.split(",").map((c) => c.trim()).filter(Boolean));
      } else {
        setEditMultipleCategories([]);
      }
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [document, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Only PDF and Word documents are allowed");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (title.length > 85) {
      toast.error("Title cannot exceed 85 characters");
      return;
    }

    if (description.length > 200) {
      toast.error("Description cannot exceed 200 characters");
      return;
    }

    if (category === "Multiple" && editMultipleCategories.length === 0) {
      toast.error("Select at least one category");
      return;
    }

    setIsSaving(true);
    try {
      const effectiveCategory = category === "Multiple"
        ? editMultipleCategories.join(",")
        : category;
      await onSave(document.id, title.trim(), description.trim(), file || undefined, effectiveCategory || undefined);
      onClose();
    } catch (error) {
      // Error is handled by onSave
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>PDF File (Optional)</Label>
            <div
              className="border-2 border-dashed rounded-md p-4 cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center">
                {file ? (
                  <>
                    <FileText className="h-8 w-8 mb-2 text-gray-400" />
                    <p className="text-xs font-medium text-center truncate w-full">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                      className="mt-2 text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mb-2 text-gray-400" />
                    <p className="text-xs text-gray-600 text-center">
                      Click to upload PDF or Word document
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF or Word document</p>
                    {document?.fileName && (
                      <p className="text-xs text-gray-400 mt-2">
                        Current: {document.fileName}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <span
                className={`text-xs ${title.length > 85
                    ? "text-red-500"
                    : title.length > 75
                      ? "text-amber-500"
                      : "text-gray-500"
                  }`}
              >
                {title.length}/85
              </span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                if (e.target.value.length <= 85) {
                  setTitle(e.target.value);
                }
              }}
              maxLength={85}
              placeholder="Enter document title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <span
                className={`text-xs ${description.length > 160
                    ? "text-red-500"
                    : description.length > 150
                      ? "text-amber-500"
                      : "text-gray-500"
                  }`}
              >
                {description.length}/200
              </span>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setDescription(e.target.value);
                }
              }}
              maxLength={200}
              placeholder="Enter document description"
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            {category === "Multiple" ? (
              <div className="space-y-2 border rounded-md p-3 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
                <p className="text-xs text-muted-foreground">Select all categories that apply:</p>
                {["Retirement", "Group Health", "Group Life", "Other Benefits"].map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-2 cursor-pointer text-sm hover:text-accent-blue transition-colors"
                  >
                    <Checkbox
                      checked={editMultipleCategories.includes(cat)}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          setEditMultipleCategories((prev) => [...prev, cat]);
                        } else {
                          setEditMultipleCategories((prev) =>
                            prev.filter((c) => c !== cat)
                          );
                        }
                      }}
                    />
                    {cat}
                  </label>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 mt-1"
                  onClick={() => setCategory("")}
                >
                  ← Back to single category
                </Button>
              </div>
            ) : (
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  if (v !== "Multiple") {
                    setEditMultipleCategories([]);
                  } else {
                    setEditMultipleCategories(["Retirement"]);
                  }
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retirement">Retirement</SelectItem>
                  <SelectItem value="Group Health">Group Health</SelectItem>
                  <SelectItem value="Group Life">Group Life</SelectItem>
                  <SelectItem value="Multiple">Multiple</SelectItem>
                  <SelectItem value="Other Benefits">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

