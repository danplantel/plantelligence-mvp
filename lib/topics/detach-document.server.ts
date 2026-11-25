import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { readTopicOverrides } from "@/lib/topics/effective-topic";
import { detachDocumentIdFromBodyBlocks } from "@/lib/topics/text-overrides";
import type { TopicPlacementOverrides } from "@/types/topic";

/**
 * Remove a deleted plan document from every topic that attached it.
 *
 * A topic stores only document ids (`{ type: "documents", documentIds }`), so a
 * deleted document used to leave dangling references: the Edit Topic dialog could
 * only call the id "no longer in the library" and the portal silently dropped the
 * chip. Detaching at the source keeps the two in step.
 *
 * Returns how many placements changed. A placement whose block list is unaffected
 * is not written, so this is cheap for plans with many topics.
 */
export async function detachDocumentFromPlanTopics(
  clientId: string,
  documentId: string,
): Promise<number> {
  const target = documentId.trim();
  if (!clientId || !target) return 0;

  const placements = await prisma.topicPlacement.findMany({
    where: { clientId },
    select: { id: true, overrides: true },
  });

  let updated = 0;
  for (const placement of placements) {
    const overrides = readTopicOverrides(placement.overrides);
    const blocks = overrides.bodyBlocks;
    if (!blocks || blocks.length === 0) continue;

    const nextBlocks = detachDocumentIdFromBodyBlocks(blocks, target);
    // Same length is not enough: an id can leave a block that keeps others.
    if (JSON.stringify(nextBlocks) === JSON.stringify(blocks)) continue;

    const next: TopicPlacementOverrides = { ...overrides };
    if (nextBlocks.length > 0) next.bodyBlocks = nextBlocks;
    else delete next.bodyBlocks;

    await prisma.topicPlacement.update({
      where: { id: placement.id },
      data: {
        overrides:
          Object.keys(next).length > 0
            ? (next as unknown as Prisma.InputJsonObject)
            : Prisma.DbNull,
      },
    });
    updated += 1;
  }
  return updated;
}
