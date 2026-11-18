"use client";

import { useEffect, useState } from "react";

/**
 * Is this page rendered inside a frame?
 *
 * The dashboard's Employee Resources preview embeds the portal (see
 * [`EmployeeResourcesPreview`](../components/pages/employee-resources/employee-resources-preview.tsx:95))
 * so the advisor can edit the hub in the portal's own Editing Panel. A framed portal
 * must stop drawing its own floating chrome — Edit Panel, Comments, Preview (the eye)
 * and "Ask a question" — because the host toolbar owns those controls; four pinned pills
 * over a scaled replica duplicate them and cover the page they are meant to edit.
 *
 * Read in an EFFECT rather than during render: the server cannot compare the two
 * windows, and answering `true` while rendering would make the first client paint
 * disagree with the server's markup.
 *
 * Outside a frame it is always `false`, so the portal in its own tab is untouched.
 */
export function useIsFramed(): boolean {
  const [isFramed, setIsFramed] = useState(false);

  useEffect(() => {
    setIsFramed(window.self !== window.top);
  }, []);

  return isFramed;
}
