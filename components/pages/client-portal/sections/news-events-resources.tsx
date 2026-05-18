"use client";

import { Download } from "lucide-react";

interface Resource {
  id: string;
  label: string;
  isActive?: boolean;
}

interface NewsEventsResourcesProps {
  brandColor?: string;
  secondaryColor?: string;
  resources?: Resource[];
}

const defaultResources: Resource[] = [
  { id: "oe-guides", label: "OE guides", isActive: true },
  { id: "slide-decks", label: "Slide decks", isActive: false },
  { id: "flyers", label: "Flyers", isActive: false },
];

export function NewsEventsResources({
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  resources = defaultResources,
}: NewsEventsResourcesProps) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <h2
          className="mb-12 text-center font-dm-serif text-[48px] font-normal leading-tight"
          style={{ color: brandColor }}
        >
          Resources & Downloads
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            >
              <span className="text-gray-900 font-medium">
                {resource.label}
              </span>
              <Download
                className="w-5 h-5"
                style={{
                  color: resource.isActive ? secondaryColor : "#9CA3AF",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
