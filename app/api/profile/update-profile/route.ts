import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Auth required");
  }

  type TBody = {
    disclaimer: string;
    name: string;
    company: string;
    phone: string;
    advisorName: string;
    advisorEmail: string;
    advisorPhone: string;
    advisorLogoUrl: string;
    complianceEmail: string;
    advisorLink: string;
    additionalAdvisorLink: string;
    recordkeeperContactLabel: string;
    title?: string;
    displayAdvisorInfoHeader?: boolean;
    displayAdvisorContactButton: boolean;
    advisorLogo: string;
    showAdvancedCompliance: boolean;
  };

  const body: TBody = await req.json();

  const profile = await prisma.user.update({
    where: { email: session.user.email },
    data: body,
  });

  return NextResponse.json(profile);
}
