import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { OptionalDocumentsFormData } from "@/types/new-client-wizard";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: OptionalDocumentsFormData & { clientId?: string } = await request.json();

    // If clientId is provided, save documents directly to the client
    if (data.clientId) {
      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          userId: session.user.id,
        },
      });

      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      // Delete all existing documents for this client (to replace them with new ones)
      await prisma.document.deleteMany({
        where: {
          clientId: data.clientId,
          type: "Document", // Only delete optional documents, not SPD/SBC
        },
      });

      const savedDocuments = [];
      if (data.optionalFiles && Array.isArray(data.optionalFiles)) {
        for (const file of data.optionalFiles) {
          const storageKey = (file as any).storageKey;
          const hasR2 = storageKey && typeof storageKey === "string" && storageKey.trim() !== "";

          if (hasR2) {
            const categorySuggested =
              typeof (file as any).categorySuggested === "string" &&
              (file as any).categorySuggested.trim()
                ? String((file as any).categorySuggested).trim()
                : null;
            const categoryConfidence =
              typeof (file as any).categoryConfidence === "number" &&
              Number.isFinite((file as any).categoryConfidence)
                ? Math.round((file as any).categoryConfidence)
                : null;
            const document = await prisma.document.create({
              data: {
                title: file.description || file.fileName || "Document",
                fileName: file.fileName || "document.pdf",
                fileUrl: "r2:stored",
                storageKey: storageKey.trim(),
                shortDescription: file.description || null,
                type: "Document",
                category: resolvePersistedDocumentCategory(
                  "Document",
                  (file as any).category,
                ),
                categorySuggested,
                categoryConfidence,
                language: file.language || "EN",
                clientId: data.clientId,
                uploadedAt: new Date(),
                expirationDate: file.expirationDate ? new Date(file.expirationDate) : null,
              } as any,
            });
            savedDocuments.push(document);
            continue;
          }

          if (!file || !file.fileData || file.fileData.trim() === "" || file.fileData === "r2:stored") {
            continue;
          }

          let fileUrl = file.fileData;
          if (!fileUrl.startsWith("data:")) {
            fileUrl = `data:application/pdf;base64,${fileUrl}`;
          }

          const categorySuggested =
            typeof (file as any).categorySuggested === "string" &&
            (file as any).categorySuggested.trim()
              ? String((file as any).categorySuggested).trim()
              : null;
          const categoryConfidence =
            typeof (file as any).categoryConfidence === "number" &&
            Number.isFinite((file as any).categoryConfidence)
              ? Math.round((file as any).categoryConfidence)
              : null;
          const document = await prisma.document.create({
            data: {
              title: file.description || file.fileName || "Document",
              fileName: file.fileName || "document.pdf",
              fileUrl,
              shortDescription: file.description || null,
              type: "Document",
              category: resolvePersistedDocumentCategory(
                "Document",
                (file as any).category,
              ),
              categorySuggested,
              categoryConfidence,
              language: file.language || "EN",
              clientId: data.clientId,
              uploadedAt: new Date(),
              expirationDate: file.expirationDate ? new Date(file.expirationDate) : null,
            } as any,
          });
          savedDocuments.push(document);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Documents saved to client",
        documents: savedDocuments
      });
    }

    // Original wizard session logic
    let wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      wizardSession = await prisma.newClientWizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 3,
          completed: false,
        }
      });
    } else {
      // Update current step to 3 if it's not already
      if (wizardSession.currentStep !== 3) {
        await prisma.newClientWizardSession.update({
          where: { id: wizardSession.id },
          data: { currentStep: 3 }
        });
      }
    }

    // Get existing data to preserve other fields
    const existing = await prisma.newClientComplianceDocuments.findUnique({
      where: { sessionId: wizardSession.id },
    });

    const optionalDocuments = await prisma.newClientComplianceDocuments.upsert({
      where: { sessionId: wizardSession.id },
      update: {
        retirementPlanDocuments: (data.optionalFiles || []) as any,
        // Preserve other fields
        spdFile: existing?.spdFile || null,
        otherDocuments: existing?.otherDocuments || null,
        recordkeeper: existing?.recordkeeper || null,
        updatedAt: new Date(),
      },
      create: {
        sessionId: wizardSession.id,
        spdFile: null,
        retirementPlanDocuments: (data.optionalFiles || []) as any,
        otherDocuments: null,
      }
    });

    return NextResponse.json({ optionalDocuments });
  } catch (error) {
    console.error("Error saving optional documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if clientId is provided in query params
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (clientId) {
      // Verify client belongs to user first
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          userId: session.user.id,
        },
      });

      if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      // MongoDB: do not use `archivedAt: null` in where (misses docs without the field). Filter in JS.
      const documents = await prisma.document.findMany({
        where: {
          clientId: clientId,
          type: "Document",
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      const activeDocuments = documents.filter(
        (doc) => doc.archivedAt == null,
      );

      const retirementPlanDocuments = activeDocuments
        .filter((doc) => (doc.fileUrl && doc.fileUrl.trim() !== "") || (doc as any).storageKey)
        .map((doc) => {
          const isR2 = doc.fileUrl === "r2:stored" || (doc as any).storageKey;
          const fileData = isR2
            ? "r2:stored"
            : (() => {
                let fd = doc.fileUrl;
                if (fd && !fd.startsWith("data:")) {
                  fd = `data:application/pdf;base64,${fd}`;
                }
                return fd;
              })();

          return {
            id: doc.id,
            fileName: doc.fileName || doc.title || "Document",
            fileData,
            fileType: doc.fileName?.split(".").pop()?.toLowerCase() || "pdf",
            description: (doc as any).shortDescription || "",
            language: doc.language || "EN",
            category: (doc as any).category || null,
            categorySuggested: (doc as any).categorySuggested || null,
            categoryConfidence: (doc as any).categoryConfidence || null,
            expirationDate: doc.expirationDate ? doc.expirationDate.toISOString() : undefined,
            ...((doc as any).storageKey && { storageKey: (doc as any).storageKey }),
          };
        });



      return NextResponse.json({
        optionalDocuments: {
          retirementPlanDocuments,
        },
      });
    }

    // Original wizard session logic
    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      }
    });

    if (!wizardSession) {
      return NextResponse.json({ optionalDocuments: null });
    }

    const optionalDocuments = await prisma.newClientComplianceDocuments.findUnique({
      where: { sessionId: wizardSession.id }
    });

    return NextResponse.json({ optionalDocuments });
  } catch (error) {
    console.error("Error fetching optional documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
