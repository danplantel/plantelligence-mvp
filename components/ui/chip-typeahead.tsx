"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { GripVertical, X } from "lucide-react";

export interface ChipTypeaheadOption {
  value: string;
  label: string;
  /**
   * Extra strings a typed query may match (e.g. a designation acronym like
   * "SHRM-CP" so "shrm cp" resolves). Compared case/punctuation-insensitively.
   */
  keywords?: string[];
}

/** Lowercase and strip everything but letters/digits: "shrm cp" === "SHRM-CP". */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface ChipTypeaheadProps {
  options: ChipTypeaheadOption[];
  /** Selected VALUES (ids for dictionary options, free text for customs). */
  selectedValues: string[];
  onChange: (values: string[]) => void;
  /** Map a stored value to its display label (used for matches + fallback). */
  valueLabel?: (value: string) => string;
  /**
   * Optional short form for the selected CHIPS only (e.g. a designation
   * acronym). Falls back to `valueLabel` when omitted. The match list always
   * uses the full `label` so users can see what an acronym means.
   */
  chipLabel?: (value: string) => string;
  placeholder?: string;
  /** Offer the typed text as a custom (free-text) value when nothing matches. */
  allowCustom?: boolean;
  /** Row label for the custom option; receives the trimmed query. */
  customOptionLabel?: (query: string) => string;
  maxSelections?: number;
  disabled?: boolean;
  id?: string;
  /** `data-field` attribute, for wizard scroll-to-error targeting. */
  dataField?: string;
  /** Paint a red outline (validation state). */
  destructive?: boolean;
  className?: string;
}

/**
 * Typeahead chip input.
 *
 * The user types, matching options appear, Enter adds a chip. When nothing
 * matches, an inline "add as custom" row is offered (when `allowCustom`), so
 * free-text values no longer need a separate field.
 *
 * Chips are shown in display order (the order of `selectedValues`), can be
 * dragged to reorder, and render through `valueLabel` so the UI never shows a
 * bare id. When `maxSelections` is set, an "x of N" counter is shown.
 */
export function ChipTypeahead({
  options,
  selectedValues,
  onChange,
  valueLabel,
  chipLabel,
  placeholder = "Type to search…",
  allowCustom = false,
  customOptionLabel = (query) => `Add "${query}"`,
  maxSelections,
  disabled = false,
  id,
  dataField,
  destructive = false,
  className,
}: ChipTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const labelFor = (value: string) => {
    if (valueLabel) return valueLabel(value);
    return options.find((o) => o.value === value)?.label ?? value;
  };

  /** Chips show the short form when provided, otherwise the full label. */
  const chipLabelFor = (value: string) =>
    chipLabel ? chipLabel(value) : labelFor(value);

  const matches = useMemo(() => {
    const nq = squash(query);
    const selected = new Set(selectedValues);
    const pool = options.filter((o) => !selected.has(o.value));
    if (!nq) return pool;
    return pool
      .filter(
        (o) =>
          squash(o.label).includes(nq) ||
          squash(o.value).includes(nq) ||
          (o.keywords ?? []).some((k) => squash(k).includes(nq)),
      )
      .slice(0, 8);
  }, [options, query, selectedValues]);

  const trimmedQuery = query.trim();
  const exactMatch = useMemo(() => {
    const nq = squash(trimmedQuery);
    if (!nq) return false;
    return options.some(
      (o) =>
        squash(o.value) === nq ||
        squash(o.label) === nq ||
        (o.keywords ?? []).some((k) => squash(k) === nq) ||
        (valueLabel ? squash(valueLabel(o.value)) === nq : false),
    );
  }, [options, trimmedQuery, valueLabel]);

  const alreadySelected = selectedValues.some(
    (v) => v.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  const showCustom =
    allowCustom && trimmedQuery.length > 0 && !exactMatch && !alreadySelected;

  const rows = useMemo<Array<{ value: string; label: string; isCustom: boolean }>>(
    () => [
      ...matches.map((o) => ({
        value: o.value,
        label: o.label,
        isCustom: false,
      })),
      ...(showCustom
        ? [
            {
              value: trimmedQuery,
              label: customOptionLabel(trimmedQuery),
              isCustom: true,
            },
          ]
        : []),
    ],
    [matches, showCustom, trimmedQuery, customOptionLabel],
  );

  const atMax =
    typeof maxSelections === "number" && selectedValues.length >= maxSelections;

  // Moving the highlight to the first row whenever the row set changes keeps
  // Enter predictable (Enter adds the highlighted row).
  useEffect(() => {
    setHighlighted(0);
  }, [query, rows.length]);

  // Close on outside click.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const commit = (value: string) => {
    if (!value || atMax) return;
    if (selectedValues.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setQuery("");
      return;
    }
    onChange([...selectedValues, value]);
    setQuery("");
    setOpen(false);
  };

  const remove = (value: string) => {
    onChange(selectedValues.filter((v) => v !== value));
  };

  /** Move the chip at `from` to `to`, preserving display order in the value list. */
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...selectedValues];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlighted];
      if (row) commit(row.value);
      else if (showCustom) commit(trimmedQuery);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (
      e.key === "Backspace" &&
      query === "" &&
      selectedValues.length > 0
    ) {
      remove(selectedValues[selectedValues.length - 1]);
    }
  };

  const listboxId = `${id ?? "chip-typeahead"}-listbox`;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Selected chips (display order) + counter */}
      {(selectedValues.length > 0 || typeof maxSelections === "number") && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {selectedValues.map((value, index) => (
            <span
              key={value}
              draggable={!disabled}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                // Some browsers require data to be set for the drag to start.
                e.dataTransfer.setData("text/plain", value);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== index) setDragOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={cn(
                // `accent-blue-light` is a mode-aware token (pale teal in light,
                // deep teal in dark), so one class covers both themes.
                "inline-flex select-none items-center gap-1 rounded-full border border-accent-blue/30 bg-accent-blue-light px-2.5 py-1 text-xs font-medium text-accent-blue transition dark:text-white",
                !disabled && "cursor-grab active:cursor-grabbing",
                dragIndex === index && "opacity-50",
                dragOverIndex === index &&
                  dragIndex !== index &&
                  "ring-2 ring-accent-blue/40",
              )}
            >
              {!disabled && (
                <GripVertical
                  className="h-3 w-3 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              )}
              {chipLabelFor(value)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(value)}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-accent-blue/15"
                  aria-label={`Remove ${labelFor(value)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {typeof maxSelections === "number" && (
            <span className="ml-auto text-xs text-muted-foreground">
              {selectedValues.length} of {maxSelections}
            </span>
          )}
        </div>
      )}

      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        data-field={dataField}
        disabled={disabled}
        value={query}
        placeholder={atMax ? "Maximum reached" : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9 w-full rounded-lg border bg-white px-3 py-1 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800",
          destructive
            ? "border-red-500"
            : "border-gray-300 dark:border-gray-600",
        )}
      />

      {open && !disabled && (rows.length > 0 || query.trim().length > 0) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <li
                key={`${row.isCustom ? "custom:" : ""}${row.value}`}
                role="option"
                aria-selected={index === highlighted}
                className={cn(
                  "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5",
                  index === highlighted && "bg-accent",
                )}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(e) => {
                  // Prevent the input from blurring before the click registers.
                  e.preventDefault();
                  commit(row.value);
                }}
              >
                {row.isCustom ? (
                  <span className="text-muted-foreground">{row.label}</span>
                ) : (
                  row.label
                )}
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-muted-foreground">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}
