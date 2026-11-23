"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { withPortalClientScope } from "@/lib/portal-document-url";

import type {
  PlanMediaDocument,
  PlanMediaMaps,
  PlanMediaVideo,
} from "@/types/topic";

interface PlanMediaResponse {
  success?: boolean;
  documents?: PlanMediaDocument[];
  videos?: PlanMediaVideo[];
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then(async (response) => {
    if (!response.ok) return { documents: [], videos: [] } as PlanMediaResponse;
    return (await response.json()) as PlanMediaResponse;
  });

/**
 * The plan's attachable media (documents + videos), indexed by id so a topic's
 * stored media ids can be resolved to the title and URL a participant opens.
 *
 * Shared by the two portal sections that render a topic's media; SWR dedupes the
 * read between them. A plan with no media simply yields empty maps.
 */
export function usePlanMediaLibrary(
  clientId?: string | null,
): PlanMediaMaps {
  const key = clientId
    ? `/api/clients/${clientId}/media?forPortal=1`
    : null;
  const { data } = useSWR<PlanMediaResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return useMemo(() => {
    const documents: Record<string, PlanMediaDocument> = {};
    const videos: Record<string, PlanMediaVideo> = {};
    for (const document of data?.documents ?? []) {
      // The employee portal is anonymous: `/api/documents/{id}/view` needs the
      // plan identifier (`?clientSlug=`) to resolve the owning advisor. The same
      // helper the hub's document cards use adds it, and leaves data:/http: URLs
      // untouched.
      documents[document.id] = {
        ...document,
        url: withPortalClientScope(document.url, clientId),
      };
    }
    for (const video of data?.videos ?? []) {
      videos[video.id] = video;
    }
    return { documents, videos };
  }, [data, clientId]);
}
