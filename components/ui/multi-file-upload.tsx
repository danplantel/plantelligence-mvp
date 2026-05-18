"use client";

import { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  File,
  Image,
  FileImage,
  FileType,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "./button";

interface MultiFileUploadProps {
  id: string;
  title: string;
  onFilesChange: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  required?: boolean;
  currentFileCount?: number;
  disabled?: boolean;
}

export function MultiFileUpload({
  id,
  title,
  onFilesChange,
  accept = "image/*",
  maxFiles = 5,
  required = false,
  currentFileCount = 0,
  disabled = false,
}: MultiFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const availableSlots = maxFiles - currentFileCount;
      if (availableSlots <= 0) {
        return; // Silently ignore if no slots available
      }

      const filesToProcess = files.slice(0, availableSlots);
      onFilesChange(filesToProcess);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      const availableSlots = maxFiles - currentFileCount;
      if (availableSlots <= 0) {
        return; // Silently ignore if no slots available
      }

      const filesToProcess = Array.from(files).slice(0, availableSlots);
      onFilesChange(filesToProcess);
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
        disabled
          ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
          : isDragOver
          ? "border-accent-blue bg-accent-blue/5"
          : "border-gray-300 hover:border-accent-blue"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center">
        <Upload className="mx-auto w-8 h-8 text-gray-400" />
        <div className="mt-2">
          <label
            htmlFor={id}
            className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
          >
            <span className="block mt-1 font-semibold text-gray-900 text-sm">
              {title}
            </span>
            <span className="block mt-1 text-gray-500 text-xs">
              {disabled
                ? "Please select a client first"
                : "Drag and drop files here, or click to select files"}
            </span>
            <span className="block mt-1 text-gray-400 text-xs">
              {currentFileCount}/{maxFiles} files • {accept}
            </span>
          </label>
        </div>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleButtonClick}
            className="text-sm"
            disabled={disabled}
          >
            Select Files
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={id}
        name={id}
        type="file"
        className="hidden"
        multiple
        accept={accept}
        onChange={handleFileSelect}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
