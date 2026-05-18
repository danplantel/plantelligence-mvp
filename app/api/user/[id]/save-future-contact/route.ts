// app/api/user/[id]/save-future-contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { id: string };
};

// ---- constants ----
const REQUIRED_FIELDS = ["name", "email", "phone", "role"] as const;
// Legacy roles for backward compatibility
const ALLOWED_LEGACY_ROLES = new Set(["advisor", "hr", "recordkeeper", "other"]);
// New role values
const ALLOWED_NEW_ROLES = new Set([
  "Advisor/Specialist",
  "HR/Generalist",
  "Vendor/Provider",
  "Support",
  "Other",
]);
const ALLOWED_SCOPES = new Set(["futureUse", "thisPortal"]);

// Fields to compare for duplicate detection
const COMPARISON_FIELDS = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "companyName",
  "title",
  "benefitsCategory",
  "role",
] as const;

// ---- helpers ----
async function ensureAuthorizedUser(
  requestedUserId?: string,
): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!requestedUserId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  if (session.user.id !== requestedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return requestedUserId;
}

function normalizeContactPayload(data: any) {
  // Build name from firstName + lastName if name is not provided
  const name =
    data.name?.trim() ||
    `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
    data.email?.trim() ||
    "";

  // Check required fields - allow firstName/lastName instead of name
  const hasName = name.length > 0;
  const hasEmail = data.email && typeof data.email === "string" && data.email.trim().length > 0;
  const hasPhone = data.phone && typeof data.phone === "string" && data.phone.trim().length > 0;
  const hasRole = data.role && typeof data.role === "string" && data.role.trim().length > 0;

  if (!hasName) {
    return {
      error: NextResponse.json(
        { error: "Missing required field: name (or firstName + lastName)" },
        { status: 400 },
      ),
    };
  }

  if (!hasEmail) {
    return {
      error: NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 },
      ),
    };
  }

  if (!hasPhone) {
    return {
      error: NextResponse.json(
        { error: "Missing required field: phone" },
        { status: 400 },
      ),
    };
  }

  if (!hasRole) {
    return {
      error: NextResponse.json(
        { error: "Missing required field: role" },
        { status: 400 },
      ),
    };
  }

  // Normalize role to legacy format for storage
  let normalizedRole = data.role;
  if (ALLOWED_NEW_ROLES.has(data.role)) {
    // Map new role values to legacy values
    normalizedRole =
      data.role === "Advisor/Specialist"
        ? "advisor"
        : data.role === "HR/Generalist"
          ? "hr"
          : data.role === "Vendor/Provider"
            ? "recordkeeper"
            : "other";
  }

  if (!ALLOWED_LEGACY_ROLES.has(normalizedRole) && !ALLOWED_NEW_ROLES.has(data.role)) {
    return {
      error: NextResponse.json({ error: "Invalid role value" }, { status: 400 }),
    };
  }

  if (data.displayScope && !ALLOWED_SCOPES.has(data.displayScope)) {
    return {
      error: NextResponse.json(
        { error: "displayScope must be either futureUse or thisPortal" },
        { status: 400 },
      ),
    };
  }


  return {
    data: {
      // Legacy fields
      name: name,
      email: data.email.trim(),
      phone: data.phone.trim(),
      role: normalizedRole,
      customRole: data.customRole?.trim() || null,
      headshot: data.headshot || null,
      showOnPortal: Boolean(data.showOnPortal),
      enableContactButton: Boolean(data.enableContactButton),
      isPrimary: Boolean(data.isPrimary),
      displayScope: data.displayScope ?? null,
      // New fields
      benefitsCategory: data.benefitsCategory || null,
      benefitsCategoryOther: data.benefitsCategoryOther?.trim() || null,
      roleOther: data.roleOther?.trim() || null,
      isPrimaryForCategory: Boolean(data.isPrimaryForCategory),
      companyName: data.companyName?.trim() || null,
      companyLogo: data.companyLogo || null,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      title: data.title?.trim() || null,
      phoneExtension: data.phoneExtension?.trim() || null,
      website: data.website?.trim() || null,
    },
  };
}

// Normalize role for comparison
function normalizeRoleForComparison(role: string | null | undefined): string {
  if (!role) return "";
  const normalized = role.toLowerCase().trim();
  // Map legacy roles to new format for comparison
  if (normalized === "advisor") return "advisor/specialist";
  if (normalized === "hr") return "hr/generalist";
  if (normalized === "recordkeeper") return "vendor/provider";
  return normalized;
}

// Compare two contacts to check if they're duplicates (more than 4 fields match)
function compareContacts(contact1: any, contact2: any): number {
  let matches = 0;
  for (const field of COMPARISON_FIELDS) {
    let val1 = contact1[field]?.toString().toLowerCase().trim() || "";
    let val2 = contact2[field]?.toString().toLowerCase().trim() || "";
    
    // Special handling for role field
    if (field === "role") {
      val1 = normalizeRoleForComparison(val1);
      val2 = normalizeRoleForComparison(val2);
    }
    
    if (val1 && val2 && val1 === val2) {
      matches++;
    }
  }
  return matches;
}

// ---- GET ----
export async function GET(request: NextRequest, { params }: RouteContext) {
  const userId = await ensureAuthorizedUser(params.id);
  if (userId instanceof NextResponse) return userId;

  try {
    const contacts = await prisma.futureContact.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contacts, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching future contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}

// ---- POST ----
export async function POST(request: NextRequest, { params }: RouteContext) {
  const userId = await ensureAuthorizedUser(params.id);
  if (userId instanceof NextResponse) return userId;

  try {
    const payload = await request.json();
    const { id, ...rawContact } = payload;

    const normalized = normalizeContactPayload(rawContact);
    if ("error" in normalized) return normalized.error;

    if (id) {
      const existing = await prisma.futureContact.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      const updatedContact = await prisma.futureContact.update({
        where: { id },
        data: normalized.data,
      });

      return NextResponse.json(updatedContact, { status: 200 });
    }

    // Check for duplicates before creating
    const existingContacts = await prisma.futureContact.findMany({
      where: { userId },
    });

    // Check if this contact matches more than 4 fields with any existing contact
    const isDuplicate = existingContacts.some((existing) => {
      const matchCount = compareContacts(normalized.data, existing);
      return matchCount > 4; // More than 4 fields match = duplicate
    });

    if (isDuplicate) {
      return NextResponse.json(
        { error: "Contact already exists (duplicate detected)" },
        { status: 409 }, // Conflict
      );
    }

    const newContact = await prisma.futureContact.create({
      data: { userId, ...normalized.data },
    });

    return NextResponse.json(newContact, { status: 201 });
  } catch (error) {
    console.error("❌ Error saving future contact:", error);
    return NextResponse.json(
      { error: "Failed to save contact" },
      { status: 500 },
    );
  }
}

// ---- DELETE ----
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const userId = await ensureAuthorizedUser(params.id);
  if (userId instanceof NextResponse) return userId;

  try {
    const contactId = request.nextUrl.searchParams.get("id");
    if (!contactId) {
      return NextResponse.json({ error: "Missing contact id" }, { status: 400 });
    }

    const result = await prisma.futureContact.deleteMany({
      where: { id: contactId, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Contact deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error deleting future contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 },
    );
  }
}
