-- "Currently typing": one self-expiring timestamp per participant on the conversation.
--
-- A TIMESTAMP, not a boolean, so the signal decays on its own — no "stopped typing" event is
-- needed, and a closed laptop or a dropped request cannot leave the indicator stuck on. The
-- reader applies the window TYPING_TTL_MS (lib/messages/types.ts).
--
-- On the thread row rather than in process memory because the app runs across processes: an
-- in-memory map would be per-instance, so two participants routed to different instances would
-- never see each other type.
ALTER TABLE "DirectThread" ADD COLUMN "aTypingAt" TIMESTAMP(3);
ALTER TABLE "DirectThread" ADD COLUMN "bTypingAt" TIMESTAMP(3);
