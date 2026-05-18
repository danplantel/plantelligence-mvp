"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DragDropUpload } from "@/components/ui/drag-drop-upload";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

interface DocumentData {
  file: string;
  fileName: string;
  fileObj: File | null;
}

export function OptionalDocumentsSection() {
  const { stepData, saveStepData } = useNewClientWizardStore();

  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [provideSpanishVersions, setProvideSpanishVersions] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      if (stepData?.optionalDocuments) {
        if (stepData.optionalDocuments.optionalFiles) {
          setDocuments(
            stepData.optionalDocuments.optionalFiles.map((file: any) => ({
              file: file.fileData,
              fileName: file.fileName,
              fileObj: null,
            })),
          );
        }
        if (stepData.optionalDocuments.provideSpanishVersions !== undefined) {
          setProvideSpanishVersions(
            stepData.optionalDocuments.provideSpanishVersions,
          );
        }
      }
      initialized.current = true;
    }
  }, [stepData?.optionalDocuments]);

  useEffect(() => {
    if (initialized.current) {
      saveStepData("optionalDocuments", {
        optionalFiles: documents.map((doc) => ({
          fileName: doc.fileName,
          fileData: doc.file,
          fileType: doc.fileName.split(".").pop() || "",
          description: `Optional document: ${doc.fileName}`,
        })),
        provideSpanishVersions,
      });
    }
  }, [documents, provideSpanishVersions, saveStepData]);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const newDocument: DocumentData = {
        file: result,
        fileName: file.name,
        fileObj: file,
      };
      setDocuments((prev) => [...prev, newDocument]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileRemove = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">Optional Documents</CardTitle>
        <p className="text-muted-foreground">
          Additional documents to enhance your client hub. You can skip for now.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.map((doc, index) => (
          <DragDropUpload
            key={index}
            id={`optional-doc-${index}`}
            title={`Document ${index + 1}`}
            value={doc.file}
            fileName={doc.fileName}
            file={doc.fileObj || undefined}
            onChange={handleFileUpload}
            onRemove={() => handleFileRemove(index)}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
        ))}

        {/* Add new document button */}
        <div className="pt-4">
          <DragDropUpload
            id="add-optional-doc"
            title="Add Optional Document"
            value=""
            fileName=""
            onChange={handleFileUpload}
            onRemove={() => {}}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
        </div>

        {/* Spanish versions checkbox */}
        <div className="flex items-center space-x-2 pt-4 border-t">
          <Checkbox
            id="spanish-versions"
            checked={provideSpanishVersions}
            onCheckedChange={(checked) =>
              setProvideSpanishVersions(checked as boolean)
            }
          />
          <Label
            htmlFor="spanish-versions"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Provide Spanish versions if available
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
