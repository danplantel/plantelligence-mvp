import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { isOpenableDocumentUrl } from "@/lib/document-id";
import prisma from "@/lib/prisma";
import type {
  PlanMediaDocument,
  PlanMediaLibrary,
  PlanMediaMaps,
  PlanMediaVideo,
} from "@/types/topic";

/**
 * The PLAN's attachable media, in the shape a topic editor offers.
 *
 * A topic stores only ids (`documents.documentIds`, `video.videoId`), so the title
 * and URL always come from the plan's live library: renaming or re-uploading a
 * document updates every topic that references it, and an id that no longer exists
 * simply resolves to nothing.
 */
const DOCUMENT_VIEW_PATH = (id: string) => `/api/documents/${id}/view`;

export async function loadPlanMediaLibrary(
  clientId: string,
  options: { category?: string | null } = {},
): Promise<PlanMediaLibrary> {
  // Scoped to THIS plan only (`Document.clientId` / `Video.clientId` are the plan).
  // The equality filter is repeated in JS so the picker can never show another
  // plan's file even if a query shape changes.
  const [documentRows, videoRows] = await Promise.all([
    prisma.document.findMany({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        title: true,
        fileName: true,
        fileUrl: true,
        storageKey: true,
        shortDescription: true,
        type: true,
        category: true,
        archivedAt: true,
      },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.video.findMany({
      where: { clientId },
      select: {
        id: true,
        clientId: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbnail: true,
        image: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const documents: PlanMediaDocument[] = documentRows
    // Only this plan's documents, only the ones with a real file, never a
    // soft-archived one, and — when a benefit category is given — only that
    // benefit's documents. That last rule is what the hub's own Documents tab does
    // (`documentRowMatchesHub`), so the picker lists exactly what belongs to the
    // benefit being edited instead of every category the plan happens to hold.
    .filter((row) => {
      if (row.clientId !== clientId) return false;
      if (row.archivedAt != null) return false;
      if (!((row.fileUrl || "").trim() || (row.storageKey || "").trim())) {
        return false;
      }
      if (options.category) {
        const hub = resolvePersistedDocumentCategory(
          row.type,
          row.category,
          row.storageKey,
        );
        if (hub !== options.category) return false;
      }
      return true;
    })
    .map((row) => {
      const title = (row.title || row.fileName || "").trim() || "Untitled document";
      // An R2 upload stores the placeholder `"r2:stored"` (and a bare object key),
      // neither of which a browser can open — those must go through the view route,
      // which mints a signed URL. `isOpenableDocumentUrl` is the same test the hub's
      // document cards use, so the two can never disagree.
      const fileUrl = (row.fileUrl || "").trim();
      const url = isOpenableDocumentUrl(fileUrl)
        ? fileUrl
        : DOCUMENT_VIEW_PATH(row.id);
      return {
        id: row.id,
        title,
        url,
        ...(row.shortDescription
          ? { description: row.shortDescription }
          : {}),
        ...(row.fileName ? { fileName: row.fileName } : {}),
      };
    });

  const videos: PlanMediaVideo[] = videoRows
    // A video is attachable once it is THIS plan's and has a playable URL (a
    // render that never finished has none, so it cannot be offered).
    .filter(
      (row) =>
        row.clientId === clientId &&
        (row.videoUrl || "").trim().length > 0,
    )
    .map((row) => {
      const title = (row.title || "").trim() || "Untitled video";
      const thumbnail = (row.thumbnail || row.image || "").trim();
      return {
        id: row.id,
        title,
        videoUrl: (row.videoUrl as string).trim(),
        ...(row.description ? { description: row.description } : {}),
        ...(thumbnail ? { thumbnail } : {}),
      };
    });

  return { documents, videos };
}

/** Index a library by id, for resolving a topic's media ids at render time. */
export function planMediaMaps(
  library: PlanMediaLibrary | null | undefined,
): PlanMediaMaps {
  const documents: Record<string, PlanMediaDocument> = {};
  const videos: Record<string, PlanMediaVideo> = {};
  for (const document of library?.documents ?? []) {
    documents[document.id] = document;
  }
  for (const video of library?.videos ?? []) {
    videos[video.id] = video;
  }
  return { documents, videos };
}
