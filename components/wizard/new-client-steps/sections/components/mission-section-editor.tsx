"use client";

import { MissionStatementFields } from "../mission-statement-fields";

interface MissionSectionEditorProps {
  missionHeadline: string;
  missionBody: string;
  defaultHeadline: string;
  defaultBodyText: string;
  useDefaultHeadline: boolean;
  useDefaultBody: boolean;
  headlineCharCount: number;
  bodyCharCount: number;
  isHeadlineValid: boolean;
  isBodyValid: boolean;
  errorFields?: string[];
  headlineRef: React.RefObject<HTMLInputElement>;
  bodyTextRef: React.RefObject<HTMLTextAreaElement>;
  onHeadlineChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onUseDefaultHeadlineChange: (checked: boolean) => void;
  onUseDefaultBodyChange: (checked: boolean) => void;
  onGenerateMissionHeadline: () => void;
  onGenerateMissionBody: () => void;
  highlightedField?: "headline" | "body" | null;
  /** URL for thumbnail image preview in the editor (left column) */
  thumbnailImgUrl?: string;
}

export function MissionSectionEditor({
  missionHeadline,
  missionBody,
  defaultHeadline,
  defaultBodyText,
  useDefaultHeadline,
  useDefaultBody,
  headlineCharCount,
  bodyCharCount,
  isHeadlineValid,
  isBodyValid,
  errorFields = [],
  headlineRef,
  bodyTextRef,
  onHeadlineChange,
  onBodyChange,
  onUseDefaultHeadlineChange,
  onUseDefaultBodyChange,
  onGenerateMissionHeadline,
  onGenerateMissionBody,
  highlightedField,
  thumbnailImgUrl,
}: MissionSectionEditorProps) {
  return (
    <div
      data-section-id="mission"
      className="pt-6 border-t border-border dark:border-gray-700"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Company Mission Statement
        </h3>
      </div>

      {/* Two-column layout: image (left) + preview text & button (right) on desktop */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
        {/* Left column: thumbnail image */}
        <div className="w-full lg:w-[220px] flex-shrink-0">
          <div className="w-full h-[160px] sm:h-[200px] lg:h-[180px] overflow-hidden rounded-lg border border-border bg-gray-50 dark:bg-gray-800">
            {thumbnailImgUrl ? (
              <img
                src={thumbnailImgUrl}
                alt="Mission image preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                No image
              </div>
            )}
          </div>
        </div>

        {/* Right column: preview text + button */}
        <div className="flex-1 min-w-0">
          <h4
            className="text-base sm:text-lg font-dm-serif mb-2 leading-tight"
            style={{ color: "#1F3A60" }}
          >
            {missionHeadline || defaultHeadline}
          </h4>
          <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-3 line-clamp-4">
            {missionBody || defaultBodyText}
          </p>
          <button
            className="px-3 py-1.5 text-xs text-white uppercase font-semibold rounded-md transition-colors hover:opacity-90"
            style={{ background: "#6B7280" }}
          >
            Explore Your Benefits
          </button>
        </div>
      </div>

      {/* Form fields below the preview */}
      <MissionStatementFields
        missionHeadline={missionHeadline}
        missionBody={missionBody}
        defaultHeadline={defaultHeadline}
        defaultBodyText={defaultBodyText}
        useDefaultHeadline={useDefaultHeadline}
        useDefaultBody={useDefaultBody}
        headlineCharCount={headlineCharCount}
        bodyCharCount={bodyCharCount}
        isHeadlineValid={isHeadlineValid}
        isBodyValid={isBodyValid}
        errorFields={errorFields}
        headlineRef={headlineRef}
        bodyTextRef={bodyTextRef}
        showUseDefault={true}
        onHeadlineChange={onHeadlineChange}
        onBodyChange={onBodyChange}
        onUseDefaultHeadlineChange={onUseDefaultHeadlineChange}
        onUseDefaultBodyChange={onUseDefaultBodyChange}
        onGenerateMissionHeadline={onGenerateMissionHeadline}
        onGenerateMissionBody={onGenerateMissionBody}
        highlightedField={highlightedField}
      />
    </div>
  );
}
