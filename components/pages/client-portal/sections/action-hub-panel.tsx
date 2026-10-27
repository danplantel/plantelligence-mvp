"use client";

import { ArrowRight } from "lucide-react";
import { readableColor } from "polished";

import { resolveActionHubPanel } from "@/lib/topics/action-hub";
import { portalRadiusValue } from "@/lib/typography-themes";
import { cn } from "@/lib/utils";
import type { ActionHubRow } from "@/types/topic";

/**
 * The participant's Action Hub panel (TF-5, handoff §6).
 *
 * One topic, one action, several benefits it applies to. "Update My Beneficiaries"
 * renders a row per benefit that holds beneficiaries, each opening THAT provider's
 * own tools — the participant's job is finding the right one, so the panel's only job
 * is to make the choice obvious.
 *
 * Three states, decided by `resolveActionHubPanel`:
 *
 *  - no rows      → nothing at all. A row with no destination must not become a
 *                   dead button, so the whole block disappears.
 *  - one row      → a single CTA straight at it. There is nothing to choose, and a
 *                   one-item panel would just be an extra tap.
 *  - several rows → the list, in canonical hub order.
 *
 * The styling follows the rest of the portal: the plan's brand colour, the portal's
 * corner radius, and no new type scale.
 */
export interface ActionHubPanelProps {
  /** Rows from the topics payload, keyed by this topic's slug. */
  rows?: ActionHubRow[] | null;
  brandColor: string;
  /** Portal prefix, so an in-portal destination resolves inside this plan. */
  basePath?: string;
  /** Label for the collapsed single-row CTA. Falls back to the row's own label. */
  ctaLabel?: string;
  className?: string;
}

/** Internal destinations carry the plan's prefix; external ones are left alone. */
function resolveHref(href: string, basePath: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const prefix = basePath.trim().replace(/\/$/, "");
  if (!prefix || href.startsWith(`${prefix}/`)) return href;
  return `${prefix}${href}`;
}

function rowAnchorProps(row: ActionHubRow) {
  return row.external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}

export function ActionHubPanel({
  rows,
  brandColor,
  basePath = "",
  ctaLabel,
  className,
}: ActionHubPanelProps) {
  const panel = resolveActionHubPanel(rows ?? []);
  if (panel.mode === "none") return null;

  if (panel.mode === "direct") {
    const { row } = panel;
    return (
      <a
        href={resolveHref(row.href, basePath)}
        {...rowAnchorProps(row)}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 border px-6 text-sm font-red-hat uppercase tracking-[0.15em] transition-all duration-300 hover:opacity-90",
          className,
        )}
        style={{
          backgroundColor: brandColor,
          borderColor: brandColor,
          color: readableColor(brandColor),
          borderRadius: portalRadiusValue(),
        }}
      >
        {ctaLabel?.trim() || row.label}
        <ArrowRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div
      className={cn(
        "mt-4 border border-neutral-200 bg-white",
        className,
      )}
      style={{ borderRadius: portalRadiusValue() }}
    >
      <ul className="divide-y divide-neutral-200">
        {panel.rows.map((row) => (
          <li key={`${row.location}:${row.href}`}>
            <a
              href={resolveHref(row.href, basePath)}
              {...rowAnchorProps(row)}
              className="group flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
            >
              <span className="text-sm font-semibold text-neutral-900">
                {row.label}
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                style={{ color: brandColor }}
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
