import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  processBase64Image,
  processBase64ImageWithCrop,
  isBase64Image,
  type CropMetadata,
} from "@/lib/image-processing";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { 
      companyName, 
      companyWebsite, 
      companyLogo, 
      logoFileName, 
      primaryColor, 
      secondaryColor, 
      brandImages,
      missionHeadline,
      missionBody,
      heroTitle,
      heroDescription,
      heroContainerOpacity,
      heroContainerBackgroundOpacity,
      heroContainerBlockOpacity,
      heroContainerInverted,
      heroBackgroundInverted,
      heroInverted, // Backward compatibility
      heroUseGradient,
      heroOverlayOpacity,
      heroBackgroundOpacity,
      heroCompanyNameColor,
    } = data;

    
    
    // Extract URL from companyLogo if it's an object
    let logoUrl = typeof companyLogo === 'object' && companyLogo?.url 
      ? companyLogo.url 
      : companyLogo;
    
    const logoCropData =
      typeof companyLogo === "object" && companyLogo?.cropData
        ? (companyLogo.cropData as CropMetadata)
        : undefined;

    // R2 key: store as-is (no base64 processing)
    const isLogoR2Key = typeof logoUrl === "string" && logoUrl.startsWith("org/");
    if (logoUrl && !isLogoR2Key && isBase64Image(logoUrl)) {
      try {
        if (logoCropData && logoCropData.cropped) {
          const imageToProcess = logoCropData.originalImage || logoUrl;
          logoUrl = await processBase64ImageWithCrop(imageToProcess, logoCropData);
        }
      } catch (error) {
        console.warn("Failed to crop company logo, using original:", error);
      }
    }
    
    // Extract logoFileName from object if needed
    const fileName = logoFileName || (typeof companyLogo === 'object' && companyLogo?.fileName 
      ? companyLogo.fileName 
      : null);

    // Find or create wizard session
    let wizardSession = await prisma.newClientWizardSession.findFirst({
      where: { userId: session.user.id, completed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!wizardSession) {
      wizardSession = await prisma.newClientWizardSession.create({
        data: {
          userId: session.user.id,
          currentStep: 1,
        },
      });
    }

    // Prepare brandImages with mission/hero fields if they don't exist in brandImages
    let brandImagesToSave = brandImages || {};
    
    if (brandImagesToSave && typeof brandImagesToSave === 'object') {
      const imageKeys = ['header', 'thumbnail', 'secondaryBanner', 'favicon'];
      const defaultSizes: Record<string, number> = {
        header: 1200,
        thumbnail: 800,
        secondaryBanner: 1200,
        favicon: 256,
      };

      for (const key of imageKeys) {
        const imageData = (brandImagesToSave as any)[key];
        const isR2Key = typeof imageData?.url === "string" && imageData.url.startsWith("org/");
        if (imageData?.url && !isR2Key && isBase64Image(imageData.url)) {
          try {
            const cropData = imageData.cropData as CropMetadata | undefined;
            if (cropData && cropData.cropped) {
              const imageToProcess = cropData.originalImage || imageData.url;
              (brandImagesToSave as any)[key].url = await processBase64ImageWithCrop(
                imageToProcess,
                cropData
              );
            }
          } catch (error) {
            console.warn(`Failed to crop ${key} image, using original:`, error);
          }
        }
      }
    }
    
    // Always ensure _meta exists and save mission/hero fields
    if (!brandImagesToSave._meta) {
      brandImagesToSave._meta = {};
    }
    // Save mission fields even if they are empty strings (to preserve user input)
    if (missionHeadline !== undefined) {
      brandImagesToSave._meta.missionHeadline = missionHeadline || null;
    }
    if (missionBody !== undefined) {
      brandImagesToSave._meta.missionBody = missionBody || null;
    }
    if (heroTitle !== undefined) {
      brandImagesToSave._meta.heroTitle = heroTitle || null;
    }
    if (heroDescription !== undefined) {
      brandImagesToSave._meta.heroDescription = heroDescription || null;
    }

    

    // Upsert company basics data
    const updateData: any = {
      companyName,
      companyWebsite,
      companyLogo: logoUrl,
      logoFileName: fileName,
      primaryColor,
      secondaryColor,
      brandImages: brandImagesToSave,
    };

    if (heroContainerOpacity !== undefined) {
      updateData.heroContainerOpacity = heroContainerOpacity;
    }
    if ((data as any).heroContainerBackgroundOpacity !== undefined) {
      updateData.heroContainerBackgroundOpacity = (data as any).heroContainerBackgroundOpacity;
    }
    if ((data as any).heroContainerBlockOpacity !== undefined) {
      updateData.heroContainerBlockOpacity = (data as any).heroContainerBlockOpacity;
    }
    if (heroInverted !== undefined) {
      updateData.heroInverted = heroInverted;
    }
    if (heroUseGradient !== undefined) {
      updateData.heroUseGradient = heroUseGradient;
    }
    if (heroOverlayOpacity !== undefined) {
      updateData.heroOverlayOpacity = heroOverlayOpacity;
    }
    if (heroBackgroundOpacity !== undefined) {
      updateData.heroBackgroundOpacity = heroBackgroundOpacity;
    }
    if (heroCompanyNameColor !== undefined) {
      updateData.heroCompanyNameColor = heroCompanyNameColor;
    }

    

    await prisma.newClientCompanyBasics.upsert({
      where: { sessionId: wizardSession.id },
      update: updateData,
      create: {
        sessionId: wizardSession.id,
        ...updateData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving company basics:", error);
    return NextResponse.json({ error: "Failed to save company basics" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    let companyBasics = null;

    if (clientId) {
      // If clientId is provided, find the client and get the most recent completed session
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { userId: true, createdAt: true },
      });

      if (client && client.userId === session.user.id) {
        // Find the most recent completed session that created this client
        // (sessions created around the same time as the client)
        const wizardSession = await prisma.newClientWizardSession.findFirst({
          where: {
            userId: session.user.id,
            completed: true,
            createdAt: {
              gte: new Date(client.createdAt.getTime() - 5 * 60 * 1000), // 5 minutes before
              lte: new Date(client.createdAt.getTime() + 5 * 60 * 1000), // 5 minutes after
            },
          },
          orderBy: { createdAt: "desc" },
          include: {
            companyBasics: true,
          },
        });

        companyBasics = wizardSession?.companyBasics || null;
      }
    } else {
      // If no clientId, get the active wizard session
      const wizardSession = await prisma.newClientWizardSession.findFirst({
        where: { userId: session.user.id, completed: false },
        orderBy: { createdAt: "desc" },
        include: {
          companyBasics: true,
        },
      });

      companyBasics = wizardSession?.companyBasics || null;
    }

    return NextResponse.json({ success: true, data: companyBasics });
  } catch (error) {
    console.error("Error loading company basics:", error);
    return NextResponse.json({ error: "Failed to load company basics" }, { status: 500 });
  }
}
