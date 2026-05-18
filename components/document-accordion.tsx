"use client";

import { useState } from "react";
import { ChevronDown, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const documentSections = [
  {
    title: "Retirement Plan Documents",
    documents: [
      { name: "Summary Plan Description (SPD)", type: "PDF", size: "2.3 MB" },
      {
        name: "Summary of Benefits and Coverage (SBC)",
        type: "PDF",
        size: "1.8 MB",
      },
      { name: "Plan Amendment", type: "PDF", size: "0.9 MB" },
    ],
  },
  {
    title: "Health Insurance Documents",
    documents: [
      { name: "Health Insurance Summary", type: "PDF", size: "1.5 MB" },
      { name: "Coverage Details", type: "PDF", size: "2.1 MB" },
    ],
  },
];

interface DocumentAccordionProps {
  brandColor?: string;
}

export function DocumentAccordion({
  brandColor = "#1F3A60",
}: DocumentAccordionProps) {
  const [openSections, setOpenSections] = useState<number[]>([]);

  const toggleSection = (index: number) => {
    setOpenSections((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <div className="space-y-4">
      {documentSections.map((section, index) => (
        <div key={index} className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection(index)}
            className="flex justify-between items-center hover:bg-gray-50 p-4 w-full text-left"
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5" style={{ color: brandColor }} />
              <span className="font-semibold text-gray-900">
                {section.title}
              </span>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-500 transition-transform ${
                openSections.includes(index) ? "rotate-180" : ""
              }`}
            />
          </button>

          {openSections.includes(index) && (
            <div className="bg-gray-50 p-4 border-gray-200 border-t">
              <div className="space-y-3">
                {section.documents.map((doc, docIndex) => (
                  <div
                    key={docIndex}
                    className="flex justify-between items-center bg-white p-3 border rounded"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-gray-500 text-sm">
                          {doc.type} • {doc.size}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 w-4 h-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
