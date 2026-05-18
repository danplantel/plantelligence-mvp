// /pages/api/plans/[userId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { userId, ...data } = req.body;

    try {
      await prisma.plan.upsert({
        where: { id: data.id || "" },
        update: data,
        create: { userId, ...data },
      });
      res.status(200).json({ message: 'Plan saved successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save plan' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
