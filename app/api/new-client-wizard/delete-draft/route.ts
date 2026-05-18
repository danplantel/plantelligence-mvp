import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Find the active draft wizard session
        const wizardSession = await prisma.newClientWizardSession.findFirst({
            where: {
                userId: session.user.id,
                completed: false,
            },
            orderBy: { createdAt: "desc" },
        });

        if (!wizardSession) {
            return NextResponse.json({
                success: true,
                message: "No draft found to delete"
            });
        }

        // Delete all related records in a transaction
        await prisma.$transaction(async (tx) => {
            // Delete related records
            await tx.newClientCompanyBasics.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            await tx.newClientWelcomeStatement.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            await tx.newClientKeyContacts.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            await tx.newClientContactBuilder.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            await tx.newClientComplianceDocuments.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            await tx.newClientEmployeePortalPreview.deleteMany({
                where: { sessionId: wizardSession.id },
            });

            // Delete the wizard session itself
            await tx.newClientWizardSession.delete({
                where: { id: wizardSession.id },
            });

            // Delete draft Client record if it exists
            await tx.client.deleteMany({
                where: {
                    userId: session.user.id,
                    status: "Draft",
                },
            });
        });

        return NextResponse.json({
            success: true,
            message: "Draft deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting draft:", error);
        return NextResponse.json({
            error: "Failed to delete draft"
        }, { status: 500 });
    }
}
