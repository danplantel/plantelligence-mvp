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

    const body = await request.json();
    
    
          const client = await prisma.client.create({
            data: {
              companyName: body.companyName,
              companyWebsite: body.companyWebsite,
              companyLogo: body.companyLogo,
              logoFileName: body.logoFileName,
              brandColor: body.brandColor,
              secondaryColor: body.secondaryColor,
              missionHeadline: body.missionHeadline,
              missionBody: body.missionBody,
              appointmentLink: body.appointmentLink,
              backgroundImg: body.backgroundImg,
              backgroundImgName: body.backgroundImgName,
              disclaimers: body.disclaimers,
              keyContacts: body.keyContacts,
              userId: session.user.id,
              status: "active"
            }
          });

    // Create Document records for uploaded files
    const documents = [];
    
    const createDoc = async (opts: {
      title: string;
      fileName: string;
      fileUrl?: string;
      storageKey?: string;
      type?: string;
      shortDescription?: string | null;
      category?: string | null;
    }) => {
      const fileUrl = opts.storageKey ? "r2:stored" : opts.fileUrl;
      if (!fileUrl && !opts.storageKey) return null;
      const docType = opts.type || "Document";
      return prisma.document.create({
        data: {
          title: opts.title,
          fileName: opts.fileName,
          fileUrl: fileUrl!,
          storageKey: opts.storageKey?.trim() || null,
          type: docType,
          shortDescription: opts.shortDescription ?? null,
          category: resolvePersistedDocumentCategory(docType, opts.category),
          clientId: client.id,
          uploadedAt: new Date(),
        } as any,
      });
    };

    if (body.spdFileName && (body.spdFile || body.spdStorageKey)) {
      const useR2 = body.spdStorageKey && typeof body.spdStorageKey === "string";
      const spd = await createDoc({
        title: "SPD (Summary Plan Description)",
        fileName: body.spdFileName,
        type: "SPD",
        ...(useR2 ? { storageKey: body.spdStorageKey } : { fileUrl: `data:application/pdf;base64,${body.spdFile}` }),
      });
      if (spd) documents.push(spd);
    }

    if (body.sbcFiles && Array.isArray(body.sbcFiles)) {
      for (let i = 0; i < body.sbcFiles.length; i++) {
        const sbc = body.sbcFiles[i];
        const useR2 = sbc?.storageKey;
        if ((sbc?.file || sbc?.storageKey) && sbc?.fileName) {
          const doc = await createDoc({
            title: sbc.title || `Document ${i + 1}`,
            fileName: sbc.fileName,
            type: "SBC",
            category: sbc.category,
            ...(useR2 ? { storageKey: sbc.storageKey } : { fileUrl: `data:application/pdf;base64,${sbc.file}` }),
          });
          if (doc) documents.push(doc);
        }
      }
    }

    if (body.optionalFiles && Array.isArray(body.optionalFiles)) {
      for (let i = 0; i < body.optionalFiles.length; i++) {
        const opt = body.optionalFiles[i];
        const useR2 = opt?.storageKey;
        if ((opt?.fileData || opt?.storageKey) && opt?.fileName) {
          const doc = await createDoc({
            title: opt.description || `Optional Document ${i + 1}`,
            fileName: opt.fileName,
            type: "Document",
            category: opt.category,
            ...(useR2 ? { storageKey: opt.storageKey } : { fileUrl: `data:application/pdf;base64,${opt.fileData}` }),
          });
          if (doc) documents.push(doc);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...client,
        documents: documents
      }
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
