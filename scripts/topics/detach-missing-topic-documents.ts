/**
 * One-off repair: drop plan-document ids from topic placements when the
 * Document row no longer exists (a document deleted before the delete route
 * learned to detach it).
 *
 * Run: npx tsx scripts/topics/detach-missing-topic-documents.ts
 */
import prisma from "@/lib/prisma";
import { readTopicOverrides } from "@/lib/topics/effective-topic";
import { detachDocumentIdFromBodyBlocks } from "@/lib/topics/text-overrides";
import { Prisma } from "@prisma/client";
import type { TopicPlacementOverrides } from "@/types/topic";

async function main() {
  const placements = await prisma.topicPlacement.findMany({
    select: { id: true, clientId: true, location: true, overrides: true },
  });

  let placementsChanged = 0;
  let idsRemoved = 0;

  for (const placement of placements) {
    const overrides = readTopicOverrides(placement.overrides);
    const blocks = overrides.bodyBlocks;
    if (!blocks || blocks.length === 0) continue;

    const ids = new Set<string>();
    for (const block of blocks) {
      if (block.type !== "documents") continue;
      for (const id of block.documentIds ?? []) ids.add(id);
    }
    if (ids.size === 0) continue;

    let nextBlocks = blocks;
    for (const id of ids) {
      const exists = await prisma.document.findUnique({
        where: { id },
        select: { id: true },
      });
      if (exists) continue;
      const detached = detachDocumentIdFromBodyBlocks(nextBlocks, id);
      if (JSON.stringify(detached) === JSON.stringify(nextBlocks)) continue;
      nextBlocks = detached;
      idsRemoved += 1;
      console.log(
        `placement ${placement.id} (${placement.location}): dropped missing document ${id}`,
      );
    }
    if (nextBlocks === blocks) continue;

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
    placementsChanged += 1;
  }

  console.log(
    `\n${placementsChanged} placement(s) updated, ${idsRemoved} dangling id(s) removed.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
