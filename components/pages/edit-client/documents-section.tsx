"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DragDropUpload } from "@/components/ui/drag-drop-upload";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { DocumentData } from "@/types/new-client-wizard";

interface DocumentsSectionProps {
  documentData: DocumentData;
  onFileUpload: (file: File, type: "spd" | "sbc") => void;
  onFileRemove: (type: "spd" | "sbc", index?: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function DocumentsSection({
  documentData,
  onFileUpload,
  onFileRemove,
  isOpen,
  onToggle,
}: DocumentsSectionProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Documents</CardTitle>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium">SPD Document</Label>
            <div className="mt-2">
              <DragDropUpload
                id="spd-upload"
                title="Upload SPD Document"
                value={documentData.spdFile}
                fileName={(documentData.spdFile as any)?.fileName || ""}
                onChange={(file) => onFileUpload(file, "spd")}
                onRemove={() => onFileRemove("spd")}
                accept=".pdf,.doc,.docx"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Additional Documents</Label>
            <div className="mt-2">
              <MultiFileUpload
                id="sbc-upload"
                title="Add Additional Documents"
                onFilesChange={(files: File[]) => {
                  files.forEach((file) => onFileUpload(file, "sbc"));
                }}
                accept=".pdf,.doc,.docx"
                maxFiles={5}
                currentFileCount={
                  (documentData.otherDocuments as any[])?.length || 0
                }
              />
              {(documentData.otherDocuments as any[])?.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="font-medium text-sm">
                    Uploaded Documents (
                    {(documentData.otherDocuments as any[])?.length}/5):
                  </p>
                  {(documentData.otherDocuments as any[])?.map(
                    (file, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{file.fileName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onFileRemove("sbc", index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
