import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import pdfParse from "pdf-parse";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64 } = body;

    if (!fileBase64 || typeof fileBase64 !== "string") {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Reject R2 keys or placeholders - this endpoint expects inline base64 PDF content only
    if (
      fileBase64 === "r2:stored" ||
      fileBase64.startsWith("org/") ||
      (fileBase64.length < 100 && !fileBase64.startsWith("data:"))
    ) {
      return NextResponse.json(
        { error: "PDF content must be inline base64 or data URL; R2-stored documents are not supported for extraction" },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    if (fileBase64.startsWith("data:")) {
      const base64Data = fileBase64.split(",")[1];
      if (!base64Data) {
        return NextResponse.json(
          { error: "Invalid data URL" },
          { status: 400 }
        );
      }
      buffer = Buffer.from(base64Data, "base64");
    } else {
      buffer = Buffer.from(fileBase64, "base64");
    }

    const data = await pdfParse(buffer);
    const fullText = data.text || "";
    if (fullText.length > 0) {
    } else {
    }

    return NextResponse.json({ text: fullText.trim() });
  } catch (error) {
    console.error("[extract-pdf-text] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from PDF", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

