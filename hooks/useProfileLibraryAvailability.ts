"use client";

import { useEffect, useState } from "react";

import {
  PROFILE_LIBRARY_CHANGED_EVENT,
  libraryHasAssets,
  type LibraryKind,
} from "@/lib/profile-library";

/**
 * Whether the advisor's saved `.zip` library has anything of `kind` in it.
 *
 * Uploaders use this to keep "Choose from Library" out of the UI until there is
 * something to choose. Asking the server on every mount would mean one request
 * per image slot, so `libraryHasAssets` caches the answer and shares a single
 * in-flight request across every uploader on the page.
 *
 * The hook also listens for `PROFILE_LIBRARY_CHANGED_EVENT`, so adding files in
 * one section makes the button appear in all of them, and deleting the last file
 * makes it disappear — no reload needed.
 */
export function useProfileLibraryAvailability(kind: LibraryKind): boolean {
  const [hasAssets, setHasAssets] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void libraryHasAssets(kind).then((value) => {
        if (!cancelled) setHasAssets(value);
      });
    };

    refresh();
    window.addEventListener(PROFILE_LIBRARY_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_LIBRARY_CHANGED_EVENT, refresh);
    };
  }, [kind]);

  return hasAssets;
}
