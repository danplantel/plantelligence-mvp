"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Check,
  FileText,
  Link2,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Upload,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_TOPIC_ANSWER_LENGTH,
  MAX_TOPIC_STEP_LENGTH,
  MAX_TOPIC_STEPS,
  MAX_TOPIC_SUMMARY_LENGTH,
  MAX_TOPIC_TITLE_LENGTH,
  normalizeTopicDocuments,
  topicTextValuesOf,
  type TopicTextValues,
} from "@/lib/topics/text-overrides";
import { uploadTopicDocument } from "@/lib/topics/upload-topic-document";
import type {
  EffectiveTopic,
  PlanMediaLibrary,
  TopicDocumentLink,
} from "@/types/topic";

/**
 * The live "n/max" beside a field.
 *
 * A limit the advisor cannot see is a limit they hit by accident, and the card
 * clips anything past it — so every length is shown as it is typed.
 */
function CharCount({
  value,
  max,
  className,
}: {
  value: string;
  max: number;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] tabular-nums text-muted-foreground${
        className ? ` ${className}` : ""
      }`}
    >
      {value.length}/{max}
    </span>
  );
}

/**
 * "Edit Topic" — one topic's title, short card line, expanded answer, its
 * ordered how-to steps (at most {@link MAX_TOPIC_STEPS}), and the plan Documents and
 * Videos attached to it.
 *
 * Shared by BOTH card lists in the Editing Panel: a Featured card (the Card Layout's
 * rows) and a Quick Answers question (the builder's rows) open the same dialog, because
 * they edit the same placement board. The host turns the returned values into the
 * plan-scoped overrides and writes them; this dialog only collects them.
 *
 * Fields start from the card's CURRENT copy, so an advisor edits from what a
 * participant sees. Clearing a field hands back an empty string; the host writes it as
 * "remove the override" (fall back to the shipped copy).
 *
 * Media is chosen from the PLAN's own libraries (`media`), which the host reads from
 * the board payload — a topic stores only the ids, so the title/URL always resolve to
 * the live document or video.
 */
export function TopicTextEditDialog({
  topic,
  open,
  onOpenChange,
  onSave,
  onPreview,
  media,
  planId,
}: {
  /** The topic being edited, or null while closed. */
  topic: EffectiveTopic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TopicTextValues) => void | Promise<void>;
  /**
   * Live preview: called with the current field values as the advisor edits, so the
   * page beside the panel reflects an added/removed step (or any change) before
   * anything is saved. Closing without saving calls it once more with the original
   * values to revert.
   */
  onPreview?: (values: TopicTextValues) => void;
  /** The plan's documents and videos this topic can attach. */
  media?: PlanMediaLibrary | null;
  /**
   * The plan being edited. Needed to upload a document of the topic's own: the
   * file is stored against the plan and opened through its document viewer.
   */
  planId?: string;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  /** Documents that belong to this card only — not the plan's library. */
  const [topicDocuments, setTopicDocuments] = useState<TopicDocumentLink[]>([]);
  /** A file from the advisor's computer is being named and stored. */
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** The card-only document whose name is being edited, keyed by its link. */
  const [renamingUrl, setRenamingUrl] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  /** The first render after opening only seeds the fields — never a preview. */
  const previewArmedRef = useRef(false);
  /** Set once a save has run, so closing it does NOT revert the preview. */
  const committedRef = useRef(false);
  /** Latest `onPreview`, read from the effect without making it a dependency. */
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  // Load the card's current copy each time the dialog opens (or the topic changes).
  useEffect(() => {
    if (!open || !topic) return;
    const initial = topicTextValuesOf(topic);
    setTitle(initial.title);
    setSummary(initial.summary);
    setAnswer(initial.answer);
    setSteps(initial.steps);
    setDocumentIds(initial.documentIds ?? []);
    setVideoIds(initial.videoIds ?? []);
    setTopicDocuments(initial.topicDocuments ?? []);
    setUploading(false);
    setUploadError(null);
    setRenamingUrl(null);
    setRenameDraft("");
    setSaving(false);
    previewArmedRef.current = false;
    committedRef.current = false;
  }, [open, topic?.topicId]);

  // Push each edit to the live preview. The first pass after the seed is skipped.
  // `onPreview` is read from a ref so a new callback identity each render cannot
  // retrigger this effect (which would loop through the board-cache write).
  useEffect(() => {
    if (!open || !topic || !onPreviewRef.current) return;
    if (!previewArmedRef.current) {
      previewArmedRef.current = true;
      return;
    }
    onPreviewRef.current({
      title,
      summary,
      answer,
      steps,
      documentIds,
      videoIds,
      topicDocuments,
    });
  }, [
    open,
    topic?.topicId,
    title,
    summary,
    answer,
    steps,
    documentIds,
    videoIds,
    topicDocuments,
  ]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !committedRef.current && topic && onPreview) {
      // Closing without saving: put the page back the way it was.
      onPreview(topicTextValuesOf(topic));
    }
    committedRef.current = false;
    onOpenChange(next);
  };

  const canAddStep = steps.length < MAX_TOPIC_STEPS;

  const updateStep = (index: number, value: string) =>
    setSteps((current) =>
      current.map((step, stepIndex) => (stepIndex === index ? value : step)),
    );

  const removeStep = (index: number) =>
    setSteps((current) => current.filter((_step, stepIndex) => stepIndex !== index));

  const addStep = () => {
    if (!canAddStep) return;
    setSteps((current) => [...current, ""]);
  };

  // Plan media, looked up by id so an attachment shows its live title.
  const documentById = new Map(
    (media?.documents ?? []).map((document) => [document.id, document]),
  );
  const videoById = new Map(
    (media?.videos ?? []).map((video) => [video.id, video]),
  );
  const availableDocuments = (media?.documents ?? []).filter(
    (document) => !documentIds.includes(document.id),
  );
  /**
   * Ids this card still carries that the plan's library no longer holds — the
   * document was deleted (or moved to another benefit) after it was attached.
   * They are named in the list below and DROPPED on save: a card cannot link to
   * a document that is gone, and keeping the dead id is what left the chip
   * reading "no longer in the library" on every later visit.
   *
   * Only computed once a library actually arrived — an unloaded/empty read must
   * never look like "every attachment is dead", or a save would wipe them.
   */
  const orphanedDocumentIds =
    media && (media.documents?.length ?? 0) > 0
      ? documentIds.filter((id) => !documentById.has(id))
      : [];
  const availableVideos = (media?.videos ?? []).filter(
    (video) => !videoIds.includes(video.id),
  );

  const addDocument = (id: string) => {
    if (!id) return;
    setDocumentIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };
  const removeDocument = (id: string) =>
    setDocumentIds((current) => current.filter((entry) => entry !== id));
  const addVideo = (id: string) => {
    if (!id) return;
    setVideoIds((current) => (current.includes(id) ? current : [...current, id]));
  };
  const removeVideo = (id: string) =>
    setVideoIds((current) => current.filter((entry) => entry !== id));

  const removeTopicDocument = (document: TopicDocumentLink) =>
    setTopicDocuments((current) =>
      current.filter(
        (entry) =>
          !(entry.title === document.title && entry.url === document.url),
      ),
    );

  /**
   * Renaming one attachment.
   *
   * The name is stored ON THIS CARD (the block's title), not on the plan's
   * document row: the same file attached to another card may read differently
   * there. Clearing the field is a cancel — a nameless chip would be unusable.
   */
  const beginRenameTopicDocument = (document: TopicDocumentLink) => {
    setRenamingUrl(document.url);
    setRenameDraft(document.title);
  };

  const cancelRenameTopicDocument = () => {
    setRenamingUrl(null);
    setRenameDraft("");
  };

  const commitRenameTopicDocument = () => {
    const url = renamingUrl;
    const title = renameDraft.trim();
    if (url && title) {
      setTopicDocuments((current) =>
        normalizeTopicDocuments(
          current.map((entry) =>
            entry.url === url ? { title, url: entry.url } : entry,
          ),
        ),
      );
    }
    cancelRenameTopicDocument();
  };

  /**
   * Upload a file and attach it to this card. The helper names it (AI, then the
   * file name) and returns the plan-scoped link a participant opens, so the only
   * thing this dialog has to do is add the result.
   */
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear it first, so choosing the same file again still fires `change`.
    event.target.value = "";
    if (!file || !planId) return;

    setUploadError(null);
    setUploading(true);
    try {
      const document = await uploadTopicDocument({ file, planId });
      setTopicDocuments((current) =>
        normalizeTopicDocuments([...current, document]),
      );
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Could not add that document.",
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        summary,
        answer,
        steps,
        // A document the library no longer holds cannot be linked, so saving
        // drops it — otherwise the dead id would keep coming back.
        documentIds:
          orphanedDocumentIds.length > 0
            ? documentIds.filter((id) => !orphanedDocumentIds.includes(id))
            : documentIds,
        videoIds,
        topicDocuments,
      });
      // The saved values now ARE the page, so closing must not revert them.
      committedRef.current = true;
      handleOpenChange(false);
    } catch {
      // The host surfaces the error; keep the dialog open so the edit is not lost.
    } finally {
      setSaving(false);
    }
  };

  const chipClass =
    "inline-flex items-center gap-1 rounded-full border border-muted bg-white px-2.5 py-1 text-[11px] text-foreground";
  const removeClass =
    "shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  const selectClass =
    "h-9 w-full rounded-md border border-input bg-white px-2 text-[12px] dark:bg-gray-800";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* The portal's Editing Panel is `fixed z-[51]`, so the dialog has to sit
          above it (the same tier the other panel dialogs use). */}
      <DialogContent overlayClassName="z-[110]" className="z-[110] max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Topic</DialogTitle>
          <DialogDescription>
            Applies to this plan only. Clear a field to go back to the standard
            copy.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="topic-text-title" className="text-xs font-bold">
                Title
              </Label>
              <CharCount value={title} max={MAX_TOPIC_TITLE_LENGTH} />
            </div>
            <Input
              id="topic-text-title"
              value={title}
              maxLength={MAX_TOPIC_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Card title"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="topic-text-summary" className="text-xs font-bold">
                Card line
              </Label>
              <CharCount value={summary} max={MAX_TOPIC_SUMMARY_LENGTH} />
            </div>
            <Input
              id="topic-text-summary"
              value={summary}
              maxLength={MAX_TOPIC_SUMMARY_LENGTH}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short line shown on the card"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="topic-text-answer" className="text-xs font-bold">
                Answer
              </Label>
              <CharCount value={answer} max={MAX_TOPIC_ANSWER_LENGTH} />
            </div>
            <Textarea
              rows={10}
              id="topic-text-answer"
              value={answer}
              maxLength={MAX_TOPIC_ANSWER_LENGTH}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="The expanded answer participants read"
              className="min-h-[110px] leading-relaxed"
            />
          </div>

          {/* Steps — the numbered how-to under the answer. At most four. */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold">Steps</Label>
              {/* "2 of 4 steps", not "2/4" — the row counters below read
                  characters, so this one must not look like the same thing. */}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {steps.length} of {MAX_TOPIC_STEPS} steps
              </span>
            </div>

            {steps.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No steps yet. Add up to {MAX_TOPIC_STEPS} numbered steps.
              </p>
            )}

            <div className="space-y-1.5">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right font-dm-serif text-[13px] font-semibold tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Input
                    value={step}
                    maxLength={MAX_TOPIC_STEP_LENGTH}
                    onChange={(event) => updateStep(index, event.target.value)}
                    aria-label={`Step ${index + 1}`}
                    placeholder={`Step ${index + 1}`}
                    className="h-9"
                  />
                  <CharCount
                    value={step}
                    max={MAX_TOPIC_STEP_LENGTH}
                    className="w-11 shrink-0 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    aria-label={`Remove step ${index + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
              disabled={!canAddStep}
              className="text-[11px]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add step
            </Button>
          </div>

          {/* DOCUMENTS — two groups, separated by whitespace rather than by a
              second surface or a second colour: the documents that belong to this
              card alone first (they are what an advisor comes here to add), then
              the benefit's own shared documents. Proximity does the segregating. */}
          <div className="rounded-lg border border-muted p-3">
            <Label className="text-xs font-bold">Documents</Label>

            {/* 1 — documents that belong to this card ALONE. They are stored on
                this placement (a file uploaded from the advisor's computer), so
                they never reach the benefit's Documents & Forms list. */}
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[12px] font-semibold text-foreground">
                  Topic documents
                </p>
                <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Only on this card
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                A document of its own — it is never added to the benefit&rsquo;s
                Documents & Forms, so participants only meet it here.
              </p>
              {topicDocuments.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No documents of its own yet.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {topicDocuments.map((document) =>
                    renamingUrl === document.url ? (
                      // Renaming happens IN the chip: the name belongs to this
                      // card, so it is edited where it is read.
                      <span
                        key={`rename-${document.url}`}
                        className="flex w-full min-w-0 items-center gap-1.5 rounded-full border border-muted bg-white py-0.5 pl-2.5 pr-1 text-[11px] text-foreground"
                      >
                        <Link2
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          autoFocus
                          aria-label="Document name"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={commitRenameTopicDocument}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRenameTopicDocument();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRenameTopicDocument();
                            }
                          }}
                          className="h-6 min-w-0 flex-1 border-0 bg-transparent px-1 text-[11px] shadow-none focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          // Keep focus (and the blur that would commit) from firing
                          // before this click lands.
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={commitRenameTopicDocument}
                          aria-label={`Save the name ${document.title}`}
                          className={removeClass}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <span
                        key={`${document.title}-${document.url}`}
                        className="flex w-full min-w-0 items-center gap-1.5 rounded-full border border-muted bg-white px-2.5 py-1 text-[11px] text-foreground"
                      >
                        <Link2
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={document.url}
                        >
                          {document.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => beginRenameTopicDocument(document)}
                          aria-label={`Rename ${document.title}`}
                          className={removeClass}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTopicDocument(document)}
                          aria-label={`Remove ${document.title}`}
                          className={removeClass}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ),
                  )}
                </div>
              )}
              {/* The way in: pick a file. It is stored against the plan and
                  opened through the plan's document viewer like every other
                  document. */}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !planId}
                  className="text-[11px]"
                >
                  {uploading ? (
                    <Loader2
                      className="mr-1 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Upload className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {uploading ? "Naming & uploading…" : "Upload a document"}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,image/*"
                aria-label="Upload a topic-only document"
                className="hidden"
                onChange={(event) => void handleUpload(event)}
              />
              {uploadError && (
                <p role="alert" className="text-[11px] text-red-600">
                  {uploadError}
                </p>
              )}
            </div>

            {/* 2 — the plan's library documents. Only the whitespace above
                separates the two groups — same surface, same type, one label each. */}
            <div className="mt-6 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[12px] font-semibold text-foreground">
                  Benefit documents
                </p>
                <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Shared
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                From this plan&rsquo;s library — also listed under the benefit&rsquo;s
                Documents & Forms.
              </p>
              {documentIds.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No documents attached.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* One pill per line, each filling the section: a document's
                      name is the useful thing here, and a wrapped row of short
                      pills read as tags rather than as the benefit's documents. */}
                  {documentIds.map((id) => {
                    const document = documentById.get(id);
                    const orphaned = !document && orphanedDocumentIds.includes(id);
                    const label = document?.title ?? "No longer in the library";
                    return (
                      <span
                        key={id}
                        className={
                          orphaned
                            ? "flex w-full min-w-0 items-center gap-1.5 rounded-full border border-dashed border-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                            : "flex w-full min-w-0 items-center gap-1.5 rounded-full border border-muted bg-white px-2.5 py-1 text-[11px] text-foreground"
                        }
                      >
                        <FileText
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <button
                          type="button"
                          onClick={() => removeDocument(id)}
                          aria-label={`Remove ${label}`}
                          className={removeClass}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* A document the library no longer holds: say so before the save
                  removes it, so nothing disappears unexplained. */}
              {orphanedDocumentIds.length > 0 && (
                <p
                  role="status"
                  className="text-[11px] italic leading-snug text-muted-foreground"
                >
                  {orphanedDocumentIds.length === 1
                    ? "One attached document is no longer in this benefit's library."
                    : `${orphanedDocumentIds.length} attached documents are no longer in this benefit's library.`}{" "}
                  Saving removes {orphanedDocumentIds.length === 1 ? "it" : "them"} —
                  choose the current file again below.
                </p>
              )}
              <select
                aria-label="Add a document"
                value=""
                onChange={(event) => addDocument(event.target.value)}
                disabled={availableDocuments.length === 0}
                className={selectClass}
              >
                <option value="">
                  {availableDocuments.length === 0
                    ? (media?.documents.length ?? 0) === 0
                      ? "This plan has no documents yet"
                      : "No more plan documents"
                    : "Add a document…"}
                </option>
                {availableDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VIDEOS — its own section (the video picker is being revisited). */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <Label className="text-xs font-bold">Videos</Label>
            {videoIds.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No videos attached.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {videoIds.map((id) => {
                  const video = videoById.get(id);
                  const label = video?.title ?? "Unavailable video";
                  return (
                    <span key={id} className={chipClass}>
                      <PlayCircle className="h-3 w-3" aria-hidden="true" />
                      <span className="max-w-[12rem] truncate">{label}</span>
                      <button
                        type="button"
                        onClick={() => removeVideo(id)}
                        aria-label={`Remove ${label}`}
                        className={removeClass}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              aria-label="Add a video"
              value=""
              onChange={(event) => addVideo(event.target.value)}
              disabled={availableVideos.length === 0}
              className={selectClass}
            >
              <option value="">
                {availableVideos.length === 0
                  ? "No more plan videos"
                  : "Add a video…"}
              </option>
              {availableVideos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-label="Saving"
                role="status"
              />
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
