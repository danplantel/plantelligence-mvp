import { prisma } from "@/lib/prisma";
import {
  getActiveContactFormTopicLabels,
  normalizeContactTopicCategory,
  resolveContactFormTopics,
} from "@/lib/contact-form-topics";

/**
 * Result of resolving a plan's contact-form topic configuration for a
 * participant page (`/contact` is anonymous, so this is read-only and only ever
 * returns non-sensitive topic labels + the canonical category).
 */
export interface PlanContactFormTopics {
  /** Active "Topic of Interest" labels for the matching contact, in order. */
  topics: string[];
  /** Canonical benefits category (Retirement, Group Health, …) or "". */
  category: string;
  /**
   * Title of the plan's *custom* benefit — the `Benefit` row filed under
   * "Company / Plan Sponsor". The Company / Plan Sponsor topic list names that
   * benefit, so participants read the plan's own wording instead of the generic
   * "Custom Benefits" placeholder. Null when the plan has no custom benefit.
   */
  customBenefitTitle: string | null;
}

/** Extract the contacts array from either keyContacts storage shape. */
function readContacts(keyContacts: unknown): any[] {
  if (Array.isArray(keyContacts)) return keyContacts as any[];
  const raw = keyContacts as any;
  if (raw && typeof raw === "object" && Array.isArray(raw.contacts)) {
    return raw.contacts;
  }
  return [];
}

/**
 * Look up the topics configured for the contact a `/contact` link points at.
 *
 * The link carries the plan id (`plan` query param) and the recipient email
 * (`to`), which is enough to read the live configuration from the plan's
 * `keyContacts`. This keeps the participant form correct even for links that
 * were generated before the topic builder existed, or whose embedded topic list
 * has gone stale.
 *
 * Returns `null` when the plan/contact cannot be resolved; callers then fall
 * back to the topic list carried in the URL or the category defaults.
 */
export async function resolvePlanContactFormTopics({
  plan,
  email,
}: {
  plan?: string | null;
  email?: string | null;
}): Promise<PlanContactFormTopics | null> {
  const planKey = (plan || "").trim();
  if (!planKey) return null;

  try {
    const select = {
      keyContacts: true,
      // The plan's custom benefit, read alongside the contacts so the topic
      // labels can name it. `@@unique([clientId, category])` means at most one.
      benefits: {
        where: { category: "Company / Plan Sponsor" },
        select: { title: true },
        take: 1,
      },
    } as const;
    let record: { keyContacts: unknown; benefits: { title: string }[] } | null =
      null;

    // The `plan` param is normally the Mongo ObjectId, but accept a slug too so
    // hand-written links and slug-based URLs keep working.
    if (/^[0-9a-fA-F]{24}$/.test(planKey)) {
      record = await prisma.client.findUnique({
        where: { id: planKey },
        select,
      });
    }
    if (!record) {
      record = await prisma.client.findFirst({
        where: { slug: planKey },
        select,
      });
    }
    if (!record) return null;

    const contacts = readContacts(record.keyContacts);
    if (contacts.length === 0) return null;

    const targetEmail = (email || "").trim().toLowerCase();
    const contact = targetEmail
      ? contacts.find(
          (c: any) => (c?.email || "").trim().toLowerCase() === targetEmail,
        )
      : null;

    if (!contact) return null;

    const rawCategory =
      contact.benefitsCategories?.[0] || contact.benefitsCategory || "";
    const category = normalizeContactTopicCategory(rawCategory);
    const customBenefitTitle = record.benefits?.[0]?.title?.trim() || null;
    const topics = getActiveContactFormTopicLabels(
      resolveContactFormTopics(category ?? rawCategory, contact.contactFormTopics),
      { customBenefitTitle },
    );

    return { topics, category: category ?? "", customBenefitTitle };
  } catch (error) {
    console.error("Error resolving plan contact-form topics:", error);
    return null;
  }
}
