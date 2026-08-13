import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { R2_FILEURL_PLACEHOLDER } from "@/lib/r2";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

type BatchItem = {
  storageKey?: string;
  fileName?: string;
  title?: string;
  type?: string;
  category?: string;
  shortDescription?: string | null;
  language?: string | null;
  categorySuggested?: string | null;
  categoryConfidence?: number | null;
  showQrCode?: boolean;
  /** ISO date string (YYYY-MM-DD or full ISO); optional per row */
  expirationDate?: string | null;
};

/**
 * Create multiple Document rows for one client in one request (Plan A / Plan B isolation via clientId + ACL).
 * Each item must include storageKey, fileName, and an explicit category (validated before DB write).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clientId?: string;
      items?: BatchItem[];
    };

    const clientId = body.clientId?.trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!clientId || items.length === 0) {
      return NextResponse.json(
        { error: "clientId and a non-empty items array are required" },
        { status: 400 },
      );
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: session.user.id },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const rowErrors: { index: number; message: string }[] = [];
    const normalized: {
      storageKey: string;
      fileName: string;
      title: string;
      docType: string;
      category: string;
      shortDescription: string | null;
      language: string;
      categorySuggested: string | null;
      categoryConfidence: number | null;
      showQrCode: boolean;
      expirationDate: Date | null;
    }[] = [];

    items.forEach((raw, index) => {
      const storageKey =
        typeof raw.storageKey === "string" ? raw.storageKey.trim() : "";
      const fileName = typeof raw.fileName === "string" ? raw.fileName.trim() : "";
      const categoryRaw = typeof raw.category === "string" ? raw.category.trim() : "";

      if (!storageKey) {
        rowErrors.push({ index, message: "storageKey is required" });
      }
      if (!fileName) {
        rowErrors.push({ index, message: "fileName is required" });
      }
      if (rowErrors.some((e) => e.index === index)) {
        return;
      }

      const rawType = typeof raw.type === "string" ? raw.type.trim() : "";
      // Normalize the wizard's "other" type to the Prisma "Document" type so
      // these rows are visible to consumers that filter on type === "Document".
      const docType =
        !rawType || rawType === "other" ? "Document" : rawType;
      const title =
        (typeof raw.title === "string" && raw.title.trim()) ||
        fileName.replace(/\.[^.]+$/, "") ||
        "Document";
      const suggested =
        typeof raw.categorySuggested === "string" && raw.categorySuggested.trim()
          ? raw.categorySuggested.trim()
          : null;
      const confidence =
        typeof raw.categoryConfidence === "number" && Number.isFinite(raw.categoryConfidence)
          ? Math.round(raw.categoryConfidence)
          : null;

      let expirationDate: Date | null = null;
      if (raw.expirationDate != null && String(raw.expirationDate).trim() !== "") {
        const d = new Date(String(raw.expirationDate).trim());
        if (!Number.isNaN(d.getTime())) {
          expirationDate = d;
        }
      }

      normalized.push({
        storageKey,
        fileName,
        title,
        docType,
        category: resolvePersistedDocumentCategory(
          docType,
          categoryRaw || undefined,
          storageKey,
        ),
        shortDescription:
          raw.shortDescription === undefined || raw.shortDescription === null
            ? null
            : String(raw.shortDescription),
        language:
          raw.language === "ES" || raw.language === "EN" ? raw.language : "EN",
        categorySuggested: suggested,
        categoryConfidence: confidence,
        showQrCode: raw.showQrCode !== false,
        expirationDate,
      });
    });

    if (rowErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: rowErrors.sort((a, b) => a.index - b.index),
        },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(
      async (tx) => {
        const docs: { id: string; fileName: string }[] = [];
        // Idempotency: skip rows whose R2 object is already persisted for this
        // client. Duplicate submissions (retries / racing auto-persist paths)
        // must not produce duplicate Document rows.
        const existing = await tx.document.findMany({
          where: {
            clientId,
            storageKey: { in: normalized.map((n) => n.storageKey) },
          },
          select: { storageKey: true },
        });
        const existingKeys = new Set(
          existing
            .map((d) => (d.storageKey || "").trim())
            .filter((k) => k !== ""),
        );
        for (const row of normalized) {
          if (existingKeys.has(row.storageKey.trim())) {
            continue;
          }
          existingKeys.add(row.storageKey.trim());
          const doc = await tx.document.create({
            data: {
              title: row.title,
              fileName: row.fileName,
              fileUrl: R2_FILEURL_PLACEHOLDER,
              storageKey: row.storageKey,
              type: row.docType,
              shortDescription: row.shortDescription,
              language: row.language,
              clientId,
              category: row.category,
              categorySuggested: row.categorySuggested,
              categoryConfidence: row.categoryConfidence,
              showQrCode: row.showQrCode,
              ...(row.expirationDate ? { expirationDate: row.expirationDate } : {}),
              uploadedAt: new Date(),
            } as any,
          });
          docs.push({ id: doc.id, fileName: doc.fileName });
        }
        return docs;
      },
      {
        // Default timeout is 5000ms — too short for batch inserts.
        // 30s accommodates up to ~15 documents at ~2s each.
        maxWait: 10000,
        timeout: 30000,
      },
    );

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} document(s)`,
      documents: created,
    });
  } catch (error) {
    console.error("[documents/batch]", error);
    return NextResponse.json(
      {
        error: "Failed to create documents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
