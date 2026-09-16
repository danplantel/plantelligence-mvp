import { uploadFileToR2 } from "@/lib/upload-to-r2";
import {
  encodeContactFormTopics,
  getActiveContactFormTopicLabels,
  normalizeContactTopicCategory,
  resolveContactFormTopics,
} from "@/lib/contact-form-topics";
import type { ContactFormTopic } from "@/lib/contact-form-topics";

/**
 * Build the first-party Plantelligence `/contact` URL for a contact's CTA.
 * `to` (the contact's email), `company`, `name`, `avatar` (headshot), and `logo`
 * (company logo) are included when present. base64 `data:` images are skipped —
 * they are too large for a query string.
 *
 * `topics` carries the advisor-configured "Topic of Interest" choices (already
 * active and ordered) so the public page can render them without a session.
 * `category` is passed along for context/labelling.
 */
export function buildContactFormHref(
  to: string,
  company?: string,
  name?: string,
  avatar?: string,
  logo?: string,
  title?: string,
  topics?: string[] | string | null,
  category?: string | null,
  planId?: string | null,
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (company) params.set("company", company);
  if (name) params.set("name", name);
  if (title) params.set("title", title);
  if (avatar && !avatar.startsWith("data:")) params.set("avatar", avatar);
  if (logo && !logo.startsWith("data:")) params.set("logo", logo);
  if (category) params.set("category", category);
  // The plan id lets the public /contact page re-resolve the topic choices from
  // the saved plan, so links generated before the topics existed still work.
  if (planId) params.set("plan", planId);

  const encodedTopics = Array.isArray(topics)
    ? encodeContactFormTopics(topics)
    : (topics || "").trim();
  if (encodedTopics) {
    params.set("topics", encodedTopics);
  } else if (Array.isArray(topics)) {
    // An explicit empty list means "the advisor turned every topic off" —
    // carry an empty param so the page doesn't fall back to the defaults.
    params.set("topics", "");
  }

  const qs = params.toString();
  return `${base}/contact${qs ? `?${qs}` : ""}`;
}

/** Minimal contact fields needed to build a /contact link at click time. */
export interface ContactFormCtaContact {
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
  headshot?: string | null;
  title?: string | null;
  /** Benefits category (drives the suggested topics). */
  benefitsCategory?: string | null;
  benefitsCategories?: string[] | null;
  /** Advisor-configured topics for this contact. */
  contactFormTopics?: ContactFormTopic[] | null;
  /** Plan (client) id — lets /contact resolve the live topic list. */
  planId?: string | null;
}

/** Convert a base64 `data:` URL into a File for R2 upload. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64 = ""] = dataUrl.split(",");
  const mime = /^data:([^;]+)/.exec(meta)?.[1] ?? "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Resolve the URL opened by a Contact Form CTA button so the /contact page shows
 * the contact's current name, company, and headshot — even for links that were
 * saved before those params existed. Missing `to` / `company` / `name` / `avatar`
 * are backfilled from the live contact object; a base64 data-URL headshot is
 * uploaded to R2 first (data URLs are too large to carry in a link).
 */
export async function resolveContactFormUrl(
  url: string,
  contact: ContactFormCtaContact | null | undefined,
): Promise<string> {
  if (!url) return url;
  const c = contact || {};

  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "https://plantel.pro",
    );
    if (u.pathname !== "/contact") return url;

    const rawCategory =
      c.benefitsCategory ||
      (c.benefitsCategories && c.benefitsCategories.length > 0
        ? c.benefitsCategories[0]
        : "") ||
      "";
    // Canonicalize legacy/display names ("Health Insurance" → "Group Health")
    // so the topic list always resolves.
    const category =
      normalizeContactTopicCategory(rawCategory) || rawCategory || "";

    if (c.email) {
      // The recipient is defined by the contact, so keep it authoritative —
      // otherwise a stale `to` would also break the plan-side topic lookup.
      u.searchParams.set("to", c.email);
    }
    if (!u.searchParams.has("company") && c.companyName) {
      u.searchParams.set("company", c.companyName);
    }
    if (!u.searchParams.has("name") && c.name) {
      u.searchParams.set("name", c.name);
    }
    if (!u.searchParams.has("title") && c.title) {
      u.searchParams.set("title", c.title);
    }
    if (!u.searchParams.has("logo") && c.companyLogo) {
      const logo = c.companyLogo;
      if (!logo.startsWith("data:")) {
        u.searchParams.set("logo", logo);
      }
    }

    if (!u.searchParams.has("avatar") && c.headshot) {
      const headshot = c.headshot;
      if (!headshot.startsWith("data:")) {
        u.searchParams.set("avatar", headshot);
      } else {
        try {
          const file = dataUrlToFile(headshot, `contact-headshot-${Date.now()}.png`);
          const key = await uploadFileToR2({
            file,
            purpose: "upload",
            subPath: "advisor/headshot",
            fileName: file.name,
          });
          if (key) u.searchParams.set("avatar", key);
        } catch (error) {
          console.warn(
            "Failed to upload contact headshot before opening /contact",
            error,
          );
        }
      }
    }

    // Keep the "Topic of Interest" choices in sync with the contact's current
    // configuration. A saved topic configuration is the source of truth, so it
    // always replaces whatever is in the link; when the contact has none, only
    // backfill links that predate the feature.
    const savedTopics = Array.isArray(c.contactFormTopics)
      ? c.contactFormTopics
      : null;
    if (category) {
      u.searchParams.set("category", category);
    }
    if (c.planId) {
      u.searchParams.set("plan", c.planId);
    }
    if (c.planId) {
      u.searchParams.set("plan", c.planId);
    }
    if (savedTopics) {
      u.searchParams.set(
        "topics",
        encodeContactFormTopics(
          getActiveContactFormTopicLabels(
            resolveContactFormTopics(category, savedTopics),
          ),
        ),
      );
    } else if (!u.searchParams.has("topics")) {
      const activeLabels = getActiveContactFormTopicLabels(
        resolveContactFormTopics(category, undefined),
      );
      if (activeLabels.length > 0) {
        u.searchParams.set("topics", encodeContactFormTopics(activeLabels));
      }
    }

    return u.toString();
  } catch {
    return url;
  }
}
