/**
 * The virtual group a Quick Answer sits in when its placement names no section
 * (or names one that no longer exists).
 *
 * It is not a row in `AccordionGroup` — the participant resolver (`resolve-location`)
 * and the board read (`board.server`) both synthesise it, and the builder strips it
 * out again before writing. They have to agree on the id (the builder's `toDraft`
 * splits it back out) and on the label the advisor reads, so both live here rather
 * than in two files that could drift.
 */
export const UNGROUPED_TOPIC_GROUP_ID = "__ungrouped__";

/** The name shown for that last-resort group. */
export const UNGROUPED_TOPIC_GROUP_NAME = "Questions";
