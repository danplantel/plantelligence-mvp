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
