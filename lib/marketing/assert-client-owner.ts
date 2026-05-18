import { prisma } from "@/lib/prisma";

export async function getOwnedClient(clientId: string, userId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, userId },
  });
}
