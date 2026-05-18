import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let finalData = null;
    try {
      const body = await request.json();
      finalData = body.finalData;
    } catch (error) {
      // If no JSON body, that's fine - we'll use the session data
    }

    const wizardSession = await prisma.newClientWizardSession.findFirst({
      where: {
        userId: session.user.id,
        completed: false,
      },
      include: {
        companyBasics: true,
        welcomeStatement: true,
        keyContacts: true,
        complianceDocuments: true,
        employeePortalPreview: true,
      }
    });

    if (wizardSession) {

    }

    if (!wizardSession) {
      return NextResponse.json({ error: "No active wizard session" }, { status: 404 });
    }

    await prisma.newClientWizardSession.update({
      where: { id: wizardSession.id },
      data: {
        completed: true,
        currentStep: 3,
        updatedAt: new Date(),
      }
    });

    // Mark all other incomplete sessions as completed
    await prisma.newClientWizardSession.updateMany({
      where: {
        userId: session.user.id,
        completed: false,
        id: { not: wizardSession.id }
      },
      data: {
        completed: true,
        updatedAt: new Date(),
      }
    });

    // Create Client record from wizard data
    if (wizardSession.companyBasics) {
      try {
        // Get heroTitle/heroDescription from companyBasics (for Banner/Hero)
        // Check both direct fields and brandImages._meta
        const companyBasics = wizardSession.companyBasics as any;
        const brandImagesMeta = companyBasics?.brandImages?._meta || {};
        const heroTitle = companyBasics?.heroTitle || brandImagesMeta.heroTitle || wizardSession.welcomeStatement?.headline || '';
        const heroDescription = companyBasics?.heroDescription || brandImagesMeta.heroDescription || wizardSession.welcomeStatement?.bodyText || '';

        // Get missionHeadline/missionBody from companyBasics (for Mission Statement)
        // Check both direct fields and brandImages._meta
        const missionHeadline = companyBasics?.missionHeadline || brandImagesMeta.missionHeadline || '';
        const missionBody = companyBasics?.missionBody || brandImagesMeta.missionBody || '';



        const clientData = {
          companyName: wizardSession.companyBasics.companyName,
          companyWebsite: wizardSession.companyBasics.companyWebsite,
          companyLogo: wizardSession.companyBasics.companyLogo,
          logoFileName: wizardSession.companyBasics.logoFileName,
          brandColor: wizardSession.companyBasics.primaryColor,
          secondaryColor: wizardSession.companyBasics.secondaryColor,
          missionHeadline,
          missionBody,
          heroTitle,
          heroDescription,
          appointmentLink: '',
          backgroundImg: '',
          backgroundImgName: '',
          disclaimers: '',
          // wizardSession.keyContacts is the NewClientKeyContacts model
          // The actual data is in wizardSession.keyContacts.contacts (the JSON field)
          keyContacts: (() => {
            console.log('[COMPLETE API] wizardSession.keyContacts:', JSON.stringify(wizardSession.keyContacts, null, 2));
            const result = wizardSession.keyContacts?.contacts || { contacts: [], displayStyle: 0 };
            console.log('[COMPLETE API] Extracted keyContacts for Client:', JSON.stringify(result, null, 2));
            return result;
          })(),
          spdFile: wizardSession.complianceDocuments?.spdFile,


          otherDocuments: wizardSession.complianceDocuments?.otherDocuments || []
        };



        // Create client directly here instead of calling API
        const client = await prisma.client.create({
          data: {
            companyName: clientData.companyName,
            companyWebsite: clientData.companyWebsite,
            companyLogo: clientData.companyLogo,
            logoFileName: clientData.logoFileName,
            brandColor: clientData.brandColor,
            secondaryColor: clientData.secondaryColor,
            missionHeadline: clientData.missionHeadline,
            missionBody: clientData.missionBody,
            heroTitle: clientData.heroTitle,
            heroDescription: clientData.heroDescription,
            appointmentLink: clientData.appointmentLink,
            backgroundImg: clientData.backgroundImg,
            backgroundImgName: clientData.backgroundImgName,
            disclaimers: clientData.disclaimers,
            keyContacts: clientData.keyContacts as any,
            userId: session.user.id,
            status: "active"
          }
        });


        // Create Document records for uploaded files
        const documents = [];

        // Create SPD document if exists
        if (clientData.spdFile) {
          const spdData = clientData.spdFile as any;
          const spdDocument = await prisma.document.create({
            data: {
              title: spdData?.fileName || "SPD (Summary Plan Description)",
              fileName: spdData?.fileName || "spd-document.pdf",
              fileUrl: spdData?.fileUrl || spdData?.file || "",
              type: "SPD",
              category: resolvePersistedDocumentCategory("SPD", spdData?.category),
              clientId: client.id,
              uploadedAt: new Date(),
            },
          });
          documents.push(spdDocument);
        }

        // Create other documents if exist
        if (clientData.otherDocuments && Array.isArray(clientData.otherDocuments)) {
          for (let i = 0; i < clientData.otherDocuments.length; i++) {
            const doc = clientData.otherDocuments[i] as any;
            if (doc && doc.file && doc.fileName) {
              const fileUrl = `data:application/pdf;base64,${doc.file}`;
              const otherDocument = await prisma.document.create({
                data: {
                  title: doc.fileName || `Document ${i + 1}`,
                  fileName: doc.fileName,
                  fileUrl: fileUrl,
                  type: doc.type || "Document",
                  category: resolvePersistedDocumentCategory(
                    doc.type || "Document",
                    doc.category,
                  ),
                  clientId: client.id,
                  uploadedAt: new Date(),
                },
              });
              documents.push(otherDocument);
            }
          }
        }



        // Clean up wizard session data
        await prisma.newClientCompanyBasics.deleteMany({
          where: { sessionId: wizardSession.id }
        });

        await prisma.newClientWelcomeStatement.deleteMany({
          where: { sessionId: wizardSession.id }
        });

        await prisma.newClientKeyContacts.deleteMany({
          where: { sessionId: wizardSession.id }
        });

        await prisma.newClientComplianceDocuments.deleteMany({
          where: { sessionId: wizardSession.id }
        });

        await prisma.newClientEmployeePortalPreview.deleteMany({
          where: { sessionId: wizardSession.id }
        });


        // Clean up the wizard session after successful client creation
        await prisma.newClientWizardSession.delete({
          where: { id: wizardSession.id }
        });
      } catch (clientError) {
        console.error("Error creating client:", clientError);
        // Don't fail the whole request if client creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "New client wizard completed successfully"
    });
  } catch (error) {
    console.error("Error completing new client wizard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
