import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  KeyContact,
  CompanyBasicsData,
  DocumentData,
  ComplianceDocumentsData,
  Document,
} from "@/types/new-client-wizard";
import {
  guessLanguageFromDocument,
} from "@/lib/compliance-document-utils";
import {
  getCategoryPortalVisibility,
  DEFAULT_CATEGORY_PORTAL_VISIBILITY,
  type CategoryPortalVisibility,
} from "@/lib/portal-category-visibility";

interface Client {
  id: string;
  companyName: string;
  companyWebsite?: string;
  companyLogo?: string;
  logoFileName?: string;
  brandColor: string;
  secondaryColor: string;
  missionHeadline?: string;
  missionBody?: string;
  appointmentLink?: string;
  backgroundImg?: string;
  backgroundImgName?: string;
  disclaimers?: string;
  keyContacts: KeyContact[];
  spdFile?: any;
  otherDocuments?: any[];
  provideSpanishVersions?: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useEditClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.id as string;

  const buildDocumentFromApi = async (
    doc: any,
    fallbackType: Document["type"] = "other",
  ): Promise<Document> => {
    const fileSource =
      typeof doc.file === "string" && doc.file
        ? doc.file
        : doc.url
          ? doc.url
          : doc.fileData
            ? doc.fileData.startsWith("data:")
              ? doc.fileData
              : `data:application/pdf;base64,${doc.fileData}`
            : doc.id
              ? `/api/documents/${doc.id}/view`
              : "";

    const baseDocument: Document = {
      id: doc.id?.toString() || `doc-${Date.now()}-${Math.random()}`,
      name: doc.title || doc.fileName || doc.name || "Document",
      file: fileSource,
      type:
        doc.type === "SPD"
          ? "spd"
          : doc.type === "spd"
            ? "spd"
            : fallbackType,
      size: doc.fileSize || doc.size || 0,
      status: "success",
      shortDescription: doc.shortDescription || doc.description,
      originalFileName: doc.fileName || doc.originalFileName || doc.title,
    };

    // Preserve the category (and related fields) that were chosen when the
    // document was uploaded on other pages (New Client step 4, Documents page,
    // Create Benefits). Previously these were dropped here, so documents edited
    // in Edit Client > Documents lost their category even though the DB row
    // still had it.
    const enriched: Document = {
      ...baseDocument,
      ...(doc.category
        ? { category: doc.category as Document["category"] }
        : {}),
      ...(doc.categorySuggested
        ? {
            categorySuggested:
              doc.categorySuggested as Document["categorySuggested"],
          }
        : {}),
      ...(doc.categoryConfidence != null
        ? { categoryConfidence: doc.categoryConfidence as number }
        : {}),
      ...(doc.storageKey ? { storageKey: doc.storageKey as string } : {}),
      ...(doc.expirationDate
        ? { expirationDate: doc.expirationDate as string }
        : {}),
    };

    return {
      ...enriched,
      // uploadedAt is not part of the wizard Document type but is read via
      // `(doc as any).uploadedAt` by the Documents tab list/preview, so keep it.
      ...(doc.uploadedAt ? { uploadedAt: doc.uploadedAt as string } : {}),
      language:
        doc.language === "ES" || doc.language === "EN"
          ? doc.language
          : await guessLanguageFromDocument(baseDocument),
    } as Document;
  };

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [companyData, setCompanyData] = useState<CompanyBasicsData>({
    companyName: "",
    companyWebsite: "",
    companyLogo: null,
    primaryColor: "",
    secondaryColor: "",
    brandImages: {
      header: null,
      thumbnail: null,
      secondaryBanner: null,
      favicon: null,
    },
    isPrimaryColorPickerOpen: false,
    isSecondaryColorPickerOpen: false,
  });

  const normalizeClientStatus = (status: unknown): "Draft" | "Active" | "Archived" => {
    const raw = (status ?? "").toString().trim().toLowerCase();
    if (raw === "draft") return "Draft";
    if (raw === "archived") return "Archived";
    // default + handles "active" / empty / unknown
    return "Active";
  };

  const [clientStatus, setClientStatus] = useState<string>("Active");

  // Welcome Statement data
  const [welcomeData, setWelcomeData] = useState({
    headline: "",
    bodyText: "",
    isAIGenerated: false,
  });

  // Documents data
  const [documentsData, setDocumentsData] = useState<ComplianceDocumentsData>({
    spdFile: null,
    otherDocuments: [],
    retirementPlanDocuments: [],
    recordkeeper: "",
  });

  // Accordion state for collapsible sections
  const [openSections, setOpenSections] = useState({
    companyInfo: true,
    mission: true,
    contacts: true,
    documents: true,
    meetings: true,
    categoryDisplay: true,
  });

  const [keyContacts, setKeyContacts] = useState<KeyContact[]>([]);
  const [keyContactsDisplayStyle, setKeyContactsDisplayStyle] = useState<number | null>(null);
  const [keyContactsMobileDisplayStyle, setKeyContactsMobileDisplayStyle] = useState<number | null>(null);
  const [categoryPortalVisibility, setCategoryPortalVisibility] = useState<CategoryPortalVisibility>(() => ({ ...DEFAULT_CATEGORY_PORTAL_VISIBILITY }));
  const [documentData, setDocumentData] = useState<DocumentData>({
    spdFile: null,
    otherDocuments: [],
  });
  const [provideSpanishVersions, setProvideSpanishVersions] = useState(false);
  const [disclaimers, setDisclaimers] = useState<string>("");

  // Fetch client data
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/clients/${clientId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Client not found");
          } else {
            setError("Failed to load client data");
          }
          return;
        }

        const result = await response.json();
        if (result.success) {

          setClient(result.data);

          // Calculate file size from base64 string
          const calculateBase64FileSize = (base64String: string): number => {
            if (!base64String) return 0;
            // Remove data URL prefix if exists (e.g., "data:image/png;base64,")
            const base64Data = base64String.includes(',')
              ? base64String.split(',')[1]
              : base64String;
            // Calculate size: base64 length * 3/4 (approximate)
            return Math.round((base64Data.length * 3) / 4);
          };

          // Process brand images with calculated file sizes
          const processBrandImage = (imageData: any) => {
            if (!imageData) return null;
            return {
              ...imageData,
              fileSize: imageData.fileSize || calculateBase64FileSize(imageData.url || "")
            };
          };

          // Build brandImages from either brandImages JSON field or individual image fields
          let brandImagesData: any = null;
          if (result.data.brandImages) {
            // Use brandImages JSON field if it exists
            brandImagesData = {
              header: processBrandImage(result.data.brandImages.header),
              thumbnail: processBrandImage(result.data.brandImages.thumbnail),
              secondaryBanner: processBrandImage(result.data.brandImages.secondaryBanner),
              favicon: processBrandImage(result.data.brandImages.favicon),
              _meta: result.data.brandImages._meta || {},
            };
          } else {
            // Fallback: build from individual image fields
            brandImagesData = {
              header: result.data.backgroundImg ? {
                url: result.data.backgroundImg,
                fileName: result.data.backgroundImgName || "",
                fileSize: calculateBase64FileSize(result.data.backgroundImg),
                width: 0,
                height: 0,
                warnings: []
              } : null,
              thumbnail: result.data.thumbnailImg ? {
                url: result.data.thumbnailImg,
                fileName: result.data.thumbnailImgName || "",
                fileSize: calculateBase64FileSize(result.data.thumbnailImg),
                width: 0,
                height: 0,
                warnings: []
              } : null,
              secondaryBanner: result.data.secondaryBannerImg ? {
                url: result.data.secondaryBannerImg,
                fileName: result.data.secondaryBannerImgName || "",
                fileSize: calculateBase64FileSize(result.data.secondaryBannerImg),
                width: 0,
                height: 0,
                warnings: []
              } : null,
              favicon: result.data.faviconImg ? {
                url: result.data.faviconImg,
                fileName: result.data.faviconImgName || "",
                fileSize: calculateBase64FileSize(result.data.faviconImg),
                width: 0,
                height: 0,
                warnings: []
              } : null,
              _meta: {},
            };
          }

          // Extract heroTitle and heroDescription from brandImages._meta or direct fields
          const heroTitle = result.data.heroTitle || brandImagesData?._meta?.heroTitle;
          const heroDescription = result.data.heroDescription || brandImagesData?._meta?.heroDescription;

          // Add heroTitle and heroDescription to brandImages._meta if they exist
          if (heroTitle || heroDescription) {
            if (!brandImagesData) {
              brandImagesData = {
                header: null,
                thumbnail: null,
                secondaryBanner: null,
                favicon: null,
                _meta: {},
              };
            }
            if (!brandImagesData._meta) {
              brandImagesData._meta = {};
            }
            if (heroTitle) brandImagesData._meta.heroTitle = heroTitle;
            if (heroDescription) brandImagesData._meta.heroDescription = heroDescription;
          }

          setCompanyData({
            companyName: result.data.companyName || "",
            companyWebsite: result.data.companyWebsite || "",
            portalUrl: result.data.slug || "",
            companyLogo: result.data.companyLogo ? {
              url: result.data.companyLogo,
              fileName: result.data.logoFileName || "",
              fileSize: calculateBase64FileSize(result.data.companyLogo),
              width: 0,
              height: 0,
              hasTransparency: false,
              warnings: []
            } : null,
            primaryColor: result.data.brandColor || "",
            secondaryColor: result.data.secondaryColor || "",
            brandImages: brandImagesData,
            isPrimaryColorPickerOpen: false,
            isSecondaryColorPickerOpen: false,
            // Add heroTitle and heroDescription for Hero/Banner section (same as PortalHero on view page)
            heroTitle: result.data.heroTitle || "",
            heroDescription: result.data.heroDescription || "",
            // Add missionHeadline and missionBody for Mission Statement section (same as PortalMission on view page)
            missionHeadline: result.data.missionHeadline || "",
            missionBody: result.data.missionBody || "",
            // Add Banner Overlay Settings
            heroOverlayOpacity: (result.data as any).heroOverlayOpacity ?? 0.67,
            heroBackgroundOpacity: (result.data as any).heroBackgroundOpacity ?? 1.0,
            heroContainerOpacity: (result.data as any).heroContainerOpacity ?? 0.67,
            heroCompanyNameColor: (result.data as any).heroCompanyNameColor || "yellow",
            heroInverted: (result.data as any).heroInverted ?? false,
            heroUseGradient: (result.data as any).heroUseGradient ?? false,
            desktopHeroBackgroundPosition: (result.data as any).desktopHeroBackgroundPosition,
            mobileHeroBackgroundPosition: (result.data as any).mobileHeroBackgroundPosition,
          } as any);

          // Parse keyContacts if it's a string (JSON)
          let contactsRaw =
            typeof result.data.keyContacts === "string"
              ? JSON.parse(result.data.keyContacts)
              : result.data.keyContacts || [];

          // Handle new format: { contacts: [...], displayStyle: ..., mobileDisplayStyle: ... }
          let contacts: any[] = [];
          let displayStyle: number | null = null;
          let mobileDisplayStyle: number | null = null;
          if (Array.isArray(contactsRaw)) {
            // Old format: just an array
            contacts = contactsRaw;
          } else if (
            typeof contactsRaw === "object" &&
            contactsRaw !== null &&
            Array.isArray(contactsRaw.contacts)
          ) {
            // New format: { contacts: [...], displayStyle: ..., mobileDisplayStyle: ... }
            contacts = contactsRaw.contacts;
            displayStyle = contactsRaw.displayStyle ?? null;
            mobileDisplayStyle = contactsRaw.mobileDisplayStyle ?? null;
          } else {
            // Fallback: empty array
            contacts = [];
          }

          // Set display styles
          setKeyContactsDisplayStyle(displayStyle);
          setKeyContactsMobileDisplayStyle(mobileDisplayStyle);

          // Ensure all contacts have proper role values
          const normalizedContacts = contacts.map((contact: any) => ({
            ...contact,
            role: contact.role || "",
            customRole: contact.customRole || "",
            name: contact.name || "",
            email: contact.email || "",
            phone: contact.phone || "",
            bio: contact.bio || "",
            headshot: contact.headshot || "",
            headshotFileName: contact.headshotFileName || "",
            contactUrl: contact.contactUrl || "",
            displayEmail: contact.displayEmail || false,
            displayPhone: contact.displayPhone || false,
            contactButton: contact.contactButton || false,
            contactButtonType: contact.contactButtonType || "email",
          }));

          setKeyContacts(normalizedContacts);

          setCategoryPortalVisibility(
            getCategoryPortalVisibility((result.data as any).categoryPortalVisibility)
          );

          // Keep welcomeData independent; Mission Statement fields live in companyData.missionHeadline/missionBody
          setWelcomeData({
            headline: "",
            bodyText: "",
            isAIGenerated: false,
          });

          // ── Documents: use data already returned from the client API ──
          // The GET /api/clients/[id] route already fetches and returns all
          // documents for this client (including fileUrl).  There is no need
          // for a separate round-trip to /api/documents – doing so would
          // serialise two requests and add ~1× latency for no benefit.
          const docsFromClient = result.data.documents;
          if (Array.isArray(docsFromClient) && docsFromClient.length > 0) {
            // Map the Prisma shape to the shape buildDocumentFromApi expects.
            // The key rename is fileUrl → file so buildDocumentFromApi picks it up.
            const mappedDocs = docsFromClient.map((doc: any) => ({
              ...doc,
              file: doc.fileUrl,
            }));

            const spdDoc = mappedDocs.find((doc: any) =>
              doc.type === "SPD" ||
              (doc.title && doc.title.toLowerCase().includes("spd")),
            );

            const retirementDocs = (
              await Promise.all(
                mappedDocs
                  .filter((doc: any) => doc.id !== spdDoc?.id)
                  .map((doc: any) => buildDocumentFromApi(doc, "other")),
              )
            ).filter((doc: any, idx: number, arr: any[]) =>
              arr.findIndex((d: any) => d.id === doc.id) === idx,
            );

            setDocumentsData({
              spdFile: spdDoc
                ? await buildDocumentFromApi(spdDoc, "spd")
                : null,
              otherDocuments: [],
              retirementPlanDocuments: retirementDocs,
              recordkeeper: result.data.recordkeeper || "",
            });
          } else {
            setDocumentsData({
              spdFile: null,
              otherDocuments: [],
              retirementPlanDocuments: [],
              recordkeeper: result.data.recordkeeper || "",
            });
          }

          // Keep old format for backward compatibility
          setDocumentData({
            spdFile: result.data.spdFile || null,
            otherDocuments: result.data.otherDocuments || [],
          });
          setProvideSpanishVersions(
            result.data.provideSpanishVersions || false,
          );
          // Check if status is passed via query parameter (for Finish Setup)
          const statusFromQuery = searchParams.get("status");
          setClientStatus(
            normalizeClientStatus(statusFromQuery || result.data.status),
          );

          // Set disclaimers
          setDisclaimers(result.data.disclaimers || "");
        } else {
          setError("Failed to load client data");
        }
      } catch (err) {
        console.error("Error fetching client:", err);
        setError("Failed to load client data");
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const handleInputChange = (field: keyof CompanyBasicsData, value: any) => {
    setCompanyData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWelcomeChange = (field: keyof typeof welcomeData, value: any) => {
    setWelcomeData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDocumentsChange = (
    field: keyof ComplianceDocumentsData,
    value: any
  ) => {
    setDocumentsData(prev => ({ ...prev, [field]: value }));
  };

  const handleHeadshotUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setKeyContacts((prev) =>
        prev.map((c, i) =>
          i === index
            ? { ...c, headshot: result, headshotFileName: file.name }
            : c,
        ),
      );
    };
    reader.readAsDataURL(file);
  };

  const handleHeadshotRemove = (index: number) => {
    setKeyContacts((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, headshot: "", headshotFileName: "" } : c,
      ),
    );
  };

  const handleFileUpload = async (
    file: File,
    type: "logo" | "background" | "spd" | "sbc" | "optional",
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      switch (type) {
        case "logo":
          setCompanyData((prev) => ({
            ...prev,
            companyLogo: {
              url: base64,
              fileName: file.name,
              fileSize: file.size,
              width: 0,
              height: 0,
              hasTransparency: false,
              warnings: []
            },
          }));
          break;
        case "background":
          setCompanyData((prev) => ({
            ...prev,
            backgroundImg: base64,
            backgroundImgName: file.name,
          }));
          break;
        case "spd":
          setDocumentData((prev) => ({
            ...prev,
            spdFile: {
              file: base64,
              fileName: file.name,
              title: file.name.replace(/\.[^/.]+$/, ""),
            },
          }));
          break;
        case "sbc":
          setDocumentData((prev) => ({
            ...prev,
            otherDocuments: [
              ...prev.otherDocuments,
              {
                file: base64,
                fileName: file.name,
                title: file.name,
                fileObj: file,
              },
            ],
          }));
          break;
        case "optional":
          break;
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFileRemove = (
    type: "logo" | "background" | "spd" | "sbc" | "optional",
    index?: number,
  ) => {
    switch (type) {
      case "logo":
        setCompanyData((prev) => ({
          ...prev,
          companyLogo: null,
        }));
        break;
      case "background":
        setCompanyData((prev) => ({
          ...prev,
          backgroundImg: "",
          backgroundImgName: "",
        }));
        break;
      case "spd":
        setDocumentData((prev) => ({
          ...prev,
          spdFile: null,
        }));
        break;
      case "sbc":
        if (index !== undefined) {
          setDocumentData((prev) => ({
            ...prev,
            otherDocuments: prev.otherDocuments.filter((_, i) => i !== index),
          }));
        }
        break;
      case "optional":
        if (index !== undefined) {
        }
        break;
    }
  };

  // Validation function
  const validateForm = () => {
    const errors: string[] = [];

    if (!companyData.companyName.trim()) {
      errors.push("Company Name is required");
    }
    if (!companyData.companyLogo) {
      errors.push("Company Logo is required");
    }
    if (!companyData.portalUrl || !companyData.portalUrl.trim()) {
      errors.push("Portal URL is required");
    }

    if (!companyData.heroDescription || !companyData.heroDescription.trim()) {
      errors.push("Banner Text is required");
    }
    const missionHeadline = ((companyData as any).missionHeadline ?? "")
      .toString()
      .trim();
    const missionBody = ((companyData as any).missionBody ?? "").toString();

    if (!missionHeadline) {
      errors.push("Mission Headline is required");
    }
    if (!missionBody.trim()) {
      errors.push("Mission Statement is required");
    }

    // Key Contacts validation
    if (keyContacts.length === 0) {
      errors.push("At least one Key Contact is required");
    }

    return errors;
  };

  // Check if form is valid (for UI indicators)
  const isFormValid = () => {
    // Always return true for Draft and Archived status (no validation needed)
    if (clientStatus === "Draft" || clientStatus === "Archived") {
      return true;
    }
    return validateForm().length === 0;
  };

  // Get validation errors for specific fields
  const getValidationErrors = () => {
    // Don't show validation errors for Draft and Archived status
    if (clientStatus === "Draft" || clientStatus === "Archived") {
      return {};
    }

    const errors = validateForm();
    const fieldErrors: Record<string, string[]> = {};

    // Company Basics validation
    if (!companyData.companyName.trim()) {
      fieldErrors.companyName = ["Company Name is required"];
    }
    // Company Website is not required - removed validation
    if (!companyData.companyLogo) {
      fieldErrors.companyLogo = ["Company Logo is required"];
    }
    // Portal URL validation
    if (!companyData.portalUrl || !companyData.portalUrl.trim()) {
      fieldErrors.portalUrl = ["Portal URL is required"];
    }
    // Background Header Image and Square Thumbnail validation removed - no longer required

    // Hero/Banner section validation (heroTitle/heroDescription)
    if (!companyData.heroDescription || !companyData.heroDescription.trim()) {
      fieldErrors.heroDescription = ["Banner Text is required"];
    }
    // Updated validation: Banner Text max is 400 characters (as per UI)
    if (companyData.heroDescription && companyData.heroDescription.length > 400) {
      fieldErrors.heroDescription = [...(fieldErrors.heroDescription || []), "Banner Text must be 400 characters or less"];
    }

    // Mission Statement validation (missionHeadline/missionBody)
    const missionHeadline = ((companyData as any).missionHeadline ?? "").toString();
    const missionBody = ((companyData as any).missionBody ?? "").toString();

    if (!missionHeadline.trim()) {
      fieldErrors.missionHeadline = ["Mission Headline is required"];
    }
    if (!missionBody.trim()) {
      fieldErrors.missionBody = ["Mission Statement is required"];
    }
    // Mission Statement validation: 250-2000 characters
    if (
      missionBody.length > 0 &&
      (missionBody.length < 250 || missionBody.length > 2000)
    ) {
      fieldErrors.missionBody = [...(fieldErrors.missionBody || []), "Mission Statement must be between 250-2000 characters"];
    }

    // Key Contacts validation
    if (keyContacts.length === 0) {
      fieldErrors.keyContacts = ["At least one Key Contact is required"];
    }

    if (keyContacts.some(contact => !contact.organization)) {
      fieldErrors.keyContacts = ["Please fill in organization for all Key Contacts"];
    }

    // Documents validation - SPD File and Recordkeeper are no longer required
    // They have been replaced by retirementPlanDocuments which can include any documents

    return fieldErrors;
  };

  const handleSave = async (): Promise<boolean> => {
    if (!client) return false;

    // Validate form if status is Active
    if (clientStatus === "Active") {
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        toast.error("Please complete all required fields:", {
          description: validationErrors.join(", "),
        });
        return false;
      }
    }

    let ok = false;
    try {
      setSaving(true);

      // Convert File objects to base64 before sending
      const processedDocumentsData = await (async () => {
        const result: any = { ...documentsData };
        const stripDataUrlPrefix = (data: string) => {
          if (!data.startsWith("data:")) {
            return data;
          }
          const base64Index = data.indexOf(",");
          return base64Index !== -1 ? data.substring(base64Index + 1) : data;
        };

        // Process SPD file
        if (result.spdFile?.file instanceof File) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              // Extract base64 part (remove "data:...;base64," prefix)
              const base64String = dataUrl.split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(result.spdFile.file);
          });

          result.spdFile = {
            file: base64,
            fileName: result.spdFile.fileName,
            fileSize: result.spdFile.fileSize,
            fileType: result.spdFile.fileType,
          };
        } else if (typeof result.spdFile?.file === "string") {
          result.spdFile = {
            ...result.spdFile,
            file: stripDataUrlPrefix(result.spdFile.file),
          };
        }

        // Process other documents
        if (result.otherDocuments && Array.isArray(result.otherDocuments)) {
          const processedOtherDocs = await Promise.all(
            result.otherDocuments.map(async (doc: any) => {
              if (doc.file instanceof File) {
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    // Extract base64 part (remove "data:...;base64," prefix)
                    const base64String = dataUrl.split(',')[1];
                    resolve(base64String);
                  };
                  reader.readAsDataURL(doc.file);
                });

                return {
                  file: base64,
                  fileName: doc.fileName,
                  fileSize: doc.fileSize,
                  fileType: doc.fileType,
                };
              }
              // If not a File object, keep as is (already processed or URL)
              if (typeof doc.file === "string") {
                return {
                  ...doc,
                  file: stripDataUrlPrefix(doc.file),
                };
              }
              return doc;
            })
          );
          result.otherDocuments = processedOtherDocs;
        }

        if (
          result.retirementPlanDocuments &&
          Array.isArray(result.retirementPlanDocuments)
        ) {
          const processedRetirementDocs = await Promise.all(
            result.retirementPlanDocuments.map(async (doc: any) => {
              if (doc.file instanceof File) {
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    const base64String = dataUrl.split(",")[1];
                    resolve(base64String);
                  };
                  reader.readAsDataURL(doc.file);
                });

                return {
                  ...doc,
                  file: base64,
                };
              }

              if (typeof doc.file === "string") {
                return {
                  ...doc,
                  file: stripDataUrlPrefix(doc.file),
                };
              }

              return doc;
            }),
          );

          result.retirementPlanDocuments = processedRetirementDocs;
        }

        return result;
      })();

      // Separate data for different sections:
      // - heroTitle/heroDescription from companyData (for Hero/Banner section)
      // - missionHeadline/missionBody from companyData (for Mission Statement section)
      const heroTitle = companyData.heroTitle || "";
      const heroDescription = companyData.heroDescription || "";
      const missionHeadline = ((companyData as any).missionHeadline || "") as string;
      const missionBody = ((companyData as any).missionBody || "") as string;

      // Format keyContacts with display styles
      const keyContactsPayload = {
        contacts: keyContacts,
        displayStyle: keyContactsDisplayStyle,
        mobileDisplayStyle: keyContactsMobileDisplayStyle,
      };

      const payload = {
        ...companyData,
        heroTitle,
        heroDescription,
        missionHeadline,
        missionBody,
        keyContacts: keyContactsPayload,
        documentsData: processedDocumentsData,
        provideSpanishVersions,
        disclaimers,
        status: clientStatus,
        // Normalize so API always receives the 4 canonical keys (Retirement, Group Life, Group Health, Other)
        categoryPortalVisibility: getCategoryPortalVisibility(categoryPortalVisibility),
      };

      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update client");
      }

      const result = await response.json();
      if (result.success) {
        ok = true;
        toast.success("Client updated successfully");
      } else {
        throw new Error("Failed to update client");
      }
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Failed to update client");
    } finally {
      setSaving(false);
    }
    return ok;
  };

  return {
    // State
    client,
    clientId,
    loading,
    saving,
    error,
    showPreview,
    companyData,
    clientStatus,
    openSections,
    keyContacts,
    keyContactsDisplayStyle,
    keyContactsMobileDisplayStyle,
    welcomeData,
    documentsData,
    provideSpanishVersions,
    disclaimers,
    categoryPortalVisibility,
    setCategoryPortalVisibility,

    // Actions
    setShowPreview,
    setClientStatus,
    setKeyContacts,
    setKeyContactsDisplayStyle,
    setKeyContactsMobileDisplayStyle,
    setDisclaimers,
    isFormValid,
    getValidationErrors,
    handleInputChange,
    handleWelcomeChange,
    handleDocumentsChange,
    handleHeadshotUpload,
    handleHeadshotRemove,
    handleFileUpload,
    handleFileRemove,
    toggleSection,
    handleSave,
  };
}
