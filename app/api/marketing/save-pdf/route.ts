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

    const data = await request.json();
    const {
      clientId,
      pdfBase64,
      fileName,
      title,
      description,
      language,
      storageKey,
      category,
    } = data;

    if (!clientId || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: clientId and fileName are required" },
        { status: 400 }
      );
    }

    const hasR2 = storageKey && typeof storageKey === "string" && storageKey.trim() !== "";
    if (!hasR2 && !pdfBase64) {
      return NextResponse.json(
        { error: "Either pdfBase64 or storageKey is required" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        userId: session.user.id,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (hasR2) {
      const document = await prisma.document.create({
        data: {
          title: title || fileName.replace('.pdf', '') || "Marketing PDF",
          fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
          fileUrl: "r2:stored",
          storageKey: storageKey.trim(),
          type: "Document",
          language: language || "EN",
          shortDescription: description || null,
          category: resolvePersistedDocumentCategory("Document", category),
          clientId: clientId,
          uploadedAt: new Date(),
        } as any,
      });
      return NextResponse.json({
        success: true,
        message: "PDF saved successfully",
        document: { id: document.id, title: document.title, fileName: document.fileName },
      });
    }

    let fileUrl = pdfBase64;
    if (!fileUrl.startsWith('data:')) {
      fileUrl = `data:application/pdf;base64,${pdfBase64}`;
    }

    const document = await prisma.document.create({
      data: {
        title: title || fileName.replace('.pdf', '') || "Marketing PDF",
        fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        fileUrl: fileUrl,
        type: "Document",
        language: language || "EN",
        shortDescription: description || null,
        category: resolvePersistedDocumentCategory("Document", category),
        clientId: clientId,
        uploadedAt: new Date(),
      } as any,
    });

    return NextResponse.json({
      success: true,
      message: "PDF saved successfully",
      document: {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
      },
    });
  } catch (error) {
    console.error("Error saving PDF:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


