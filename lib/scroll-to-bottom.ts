/**
 * Scroll a conversation to its newest item — the chat gesture for "your message landed".
 *
 * Shared by Direct Messages and Comments so the two rails move IDENTICALLY: it is the same gesture in
 * both, and two slightly different glides on two panels of the same app reads as a bug.
 *
 * `smooth` is the travel, and it is only ever asked for on the reader's OWN send. An incoming message
 * arriving from the 10s poll should not animate anything — the reader is usually already at the
 * bottom, where the distance is zero, and when they are NOT, the poll does not scroll at all. So the
 * animation only ever plays when the reader did something and is owed the feedback.
 *
 * `prefers-reduced-motion: reduce` short-circuits to the jump. That setting asks for movement to be
 * avoided, and animating the whole message viewport is about as much movement as a page can make;
 * honouring it is why this is a helper rather than a `behavior: "smooth"` sprinkled at each call
 * site, where one of them would eventually forget.
 */
export function scrollToBottom(
  element: HTMLElement | null,
  smooth = false,
): void {
  if (!element) return;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (smooth && !prefersReducedMotion) {
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    return;
  }

  element.scrollTop = element.scrollHeight;
}
