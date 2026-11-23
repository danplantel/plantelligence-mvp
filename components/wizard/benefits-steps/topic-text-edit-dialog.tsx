"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, PlayCircle, Plus, X } from "lucide-react";

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
  MAX_TOPIC_STEPS,
  topicTextValuesOf,
  type TopicTextValues,
} from "@/lib/topics/text-overrides";
import type { EffectiveTopic, PlanMediaLibrary } from "@/types/topic";

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
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
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
    });
  }, [open, topic?.topicId, title, summary, answer, steps, documentIds, videoIds]);

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

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title, summary, answer, steps, documentIds, videoIds });
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
            <Label htmlFor="topic-text-title" className="text-xs font-bold">
              Title
            </Label>
            <Input
              id="topic-text-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Card title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-text-summary" className="text-xs font-bold">
              Card line
            </Label>
            <Input
              id="topic-text-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short line shown on the card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic-text-answer" className="text-xs font-bold">
              Answer
            </Label>
            <Textarea
              id="topic-text-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="The expanded answer participants read"
              className="min-h-[110px] leading-relaxed"
            />
          </div>

          {/* Steps — the numbered how-to under the answer. At most four. */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold">Steps</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {steps.length}/{MAX_TOPIC_STEPS}
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
                    onChange={(event) => updateStep(index, event.target.value)}
                    aria-label={`Step ${index + 1}`}
                    placeholder={`Step ${index + 1}`}
                    className="h-9"
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

          {/* Media — documents and videos from THIS plan's libraries. */}
          {media && (
            <div className="space-y-3 rounded-lg border border-muted p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-bold">Media</Label>
                <span className="text-[11px] text-muted-foreground">
                  From this plan&rsquo;s library
                </span>
              </div>

              {/* Documents */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Documents
                </p>
                {documentIds.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No documents attached.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {documentIds.map((id) => {
                      const document = documentById.get(id);
                      const label = document?.title ?? "Unavailable document";
                      return (
                        <span key={id} className={chipClass}>
                          <FileText className="h-3 w-3" aria-hidden="true" />
                          <span className="max-w-[12rem] truncate">{label}</span>
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
                <select
                  aria-label="Add a document"
                  value=""
                  onChange={(event) => addDocument(event.target.value)}
                  disabled={availableDocuments.length === 0}
                  className={selectClass}
                >
                  <option value="">
                    {availableDocuments.length === 0
                      ? "No more plan documents"
                      : "Add a document…"}
                  </option>
                  {availableDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Videos */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Videos
                </p>
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
          )}
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
