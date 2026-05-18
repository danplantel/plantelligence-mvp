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

interface DragDropUploadProps {
  id: string;
  title: string;
  value: string;
  fileName: string;
  displayName?: string;
  file?: File;
  fileSize?: number;
  isExisting?: boolean;
  onChange: (file: File) => void;
  onRemove: () => void;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DragDropUpload({
  id,
  title,
  value,
  fileName,
  displayName,
  file,
  fileSize,
  isExisting = false,
  onChange,
  onRemove,
  accept = "image/*",
  required = false,
  disabled = false,
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onChange(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      onChange(files[0]);
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return <FileText className="w-8 h-8 text-accent-blue" />;
      case "doc":
      case "docx":
        return <FileType className="w-8 h-8 text-accent-blue" />;
      case "xls":
      case "xlsx":
        return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
      case "webp":
        return <FileImage className="w-8 h-8 text-purple-600" />;
      case "txt":
        return <FileText className="w-8 h-8 text-muted-foreground" />;
      default:
        return <File className="w-8 h-8 text-accent-blue" />;
    }
  };

  const getFileTypeColor = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return "bg-accent-blue/10 border-accent-blue/30 shadow-accent-blue/20";
      case "doc":
      case "docx":
        return "bg-accent-blue/10 border-accent-blue/30 shadow-accent-blue/20";
      case "xls":
      case "xlsx":
        return "bg-green-50 border-green-300 shadow-green-100";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
      case "webp":
        return "bg-purple-50 border-purple-300 shadow-purple-100";
      case "txt":
        return "bg-muted/20 border-muted-foreground/20 shadow-muted/20";
      default:
        return "bg-accent-blue/10 border-accent-blue/30 shadow-accent-blue/20";
    }
  };

  const formatFileSize = (sizeOrFile?: File | number) => {
    if (!sizeOrFile) return "Unknown size";

    const bytes = typeof sizeOrFile === "number" ? sizeOrFile : sizeOrFile.size;
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium">
          {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isExisting && value && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Existing
          </span>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors h-[200px] flex items-center justify-center ${
          disabled
            ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
            : isDragOver
            ? "border-accent-blue bg-accent-blue/5"
            : value
            ? "border-accent-blue bg-accent-blue/5"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          id={id}
          disabled={disabled}
        />

        {value ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
            <div className="relative flex flex-col items-center justify-center p-2 rounded-xl bg-muted/20 w-full h-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={disabled}
                className="absolute top-1 right-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1"
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="mb-1">{getFileIcon(fileName)}</div>
              <div className="text-center space-y-1 flex-1 flex flex-col justify-center">
                <p className="text-sm font-bold text-foreground truncate max-w-xs">
                  {displayName || fileName || "File uploaded"}
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isExisting ? "bg-blue-500" : "bg-green-500"
                    } animate-pulse`}
                  ></div>
                  <p className="text-xs text-muted-foreground">
                    {file
                      ? formatFileSize(file)
                      : fileSize
                      ? formatFileSize(fileSize)
                      : "Ready to upload"}
                  </p>
                </div>
                {isExisting && (
                  <p className="text-xs text-blue-600">
                    Existing document • Upload new to replace
                  </p>
                )}
              </div>
              <div className="mt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleButtonClick}
                  disabled={disabled}
                  className="text-accent-blue border-accent-blue hover:bg-accent-blue/10 text-xs px-2 py-1"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Replace
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
            <div className="flex justify-center">
              <Upload className="w-8 h-8 text-gray-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Drag & Drop Files Here</p>
              <p className="text-xs text-gray-500">or</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleButtonClick}
                disabled={disabled}
                className="text-accent-blue border-accent-blue hover:bg-accent-blue/10 text-sm px-3 py-2"
              >
                Choose Files
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
