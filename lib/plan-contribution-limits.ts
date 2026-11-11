/**
 * The annual IRS figures the topic copy names as `{{plan_year}}` and
 * `{{deferral_limit}}`.
 *
 * These are GLOBAL values, not per-plan fields: the handoff's "Before launch"
 * list says they are updated each January and are not stored on a plan. Keeping
 * them in one module means a yearly update changes every surface at once —
 * Featured cards, Quick Answers and the chatbot all read the same numbers.
 *
 * Review with the advisor's compliance team before each plan year.
 */

/** The plan year the figures below belong to. */
export const CONTRIBUTION_LIMITS_YEAR = 2026;

/** 402(g) elective deferral limit, pre-tax and Roth combined. */
export const ELECTIVE_DEFERRAL_LIMIT = "$24,500";
