"use client";

import { MissionStatementFields } from "../mission-statement-fields";

interface MissionSectionEditorProps {
  missionHeadline: string;
  missionBody: string;
  defaultBodyText: string;
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
  onUseDefaultBodyChange: (checked: boolean) => void;
  onGenerateMissionHeadline: () => void;
  onGenerateMissionBody: () => void;
  highlightedField?: "headline" | "body" | null;
  /** URL for thumbnail image preview in the editor (left column) */
  thumbnailImgUrl?: string;
  /** Called when an Input or Textarea gains focus */
  onFieldFocus?: () => void;
}

export function MissionSectionEditor({
  missionHeadline,
  missionBody,
  defaultBodyText,
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
  onUseDefaultBodyChange,
  onGenerateMissionHeadline,
  onGenerateMissionBody,
  highlightedField,
  thumbnailImgUrl,
  onFieldFocus,
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
        defaultBodyText={defaultBodyText}
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
        onUseDefaultBodyChange={onUseDefaultBodyChange}
        onGenerateMissionHeadline={onGenerateMissionHeadline}
        onGenerateMissionBody={onGenerateMissionBody}
        highlightedField={highlightedField}
        onFieldFocus={onFieldFocus}
      />
    </div>
  );
}
