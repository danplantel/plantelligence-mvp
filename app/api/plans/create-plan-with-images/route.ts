import { SYNTHESIA_TEMPLATE_ID } from "@/constants/app";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendMail";
import { PreviewImageData } from "@/lib/preview-image-generator";
import axios from "axios";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const mailTemplate = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; color: #333333; padding: 20px; margin: 0;">
    <div width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
      <h2 style="margin-top: 0; color: #111111;">Your PlanTelligence Benefits Portal and related content are generating</h2>
      <p style="font-size: 16px; line-height: 1.5;">
        You will be notified when this process has completed
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Typically, it takes around <strong>5-10 minutes</strong>. 
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Contact us if you need support:
        <a href="mailto:support@plantelligence.ai" style="color: #0070f3;">support@plantelligence.ai</a>
      </p>
    </div>
  </body>
</html>
`;

interface CreatePlanWithImagesRequest {
  // Basic plan info
  companyName: string;
  planName: string;
  planType: string;
  accentColor: string;
  accentColorImage?: string; // S3 URL of color image
  avatarId: string;
  backgroundImage: string;
  // Preview images
  previewImages: PreviewImageData;
  
  // Optional: Additional metadata
  planId?: string;
  qrUrl?: string;
  disclaimer?: string[];
  companyLogo: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body: CreatePlanWithImagesRequest = await req.json();
    
    // Validate required fields
    if (!body.companyName || !body.planName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const disclaimerArr = Array.isArray(body.disclaimer) ? body.disclaimer : [];
    const disclaimer = {
      disclaimer: disclaimerArr[0] || ".",
      ...Object.fromEntries(
        Array.from({ length: 24 }, (_, i) => [
          `disclaimer_line${i + 1}`,
          disclaimerArr[i + 1] || ".",
        ]),
      ),
    };
    // Get the next plan index
    const key = "planCurrentIndex";
    const setting = await prisma.setting.findFirst({
      where: { key },
    });

    const newIndex = +(setting?.value || 0) + 1;

    await prisma.setting.upsert({
      where: { key },
      create: { key, value: `${newIndex}` },
      update: { value: `${newIndex}` },
    });

    // Get user
    const user = await prisma.user.findFirst({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create plan with simplified data
    const plan = await prisma.plan.create({
      data: {
        userId: user.id,
        idIndex: newIndex,
        clientName: body.planName,
        companyName: body.companyName,
        videoThemeColor: body.accentColor,
        videoAvatar: body.avatarId || "avatar",
        title: body.companyName,
        rawData: {
          planType: body.planType,
          previewImages: body.previewImages,
          planId: body.planId,
          qrUrl: body.qrUrl,
          disclaimer: disclaimer,
          companyLogo: body.companyLogo,
          backgroundImage: body.backgroundImage,
        } as any,
      },
    });

    // Create Synthesia video with preview images
    const synthesiaApiKey = process.env.NEXT_PUBLIC_SYNTHESIA_API_KEY;
    
    if (!synthesiaApiKey) {
      throw new Error("Synthesia API key not configured");
    }
    
    // Use the first available preview image as the main background, or use a default
    const mainPreviewImage = Object.values(body.previewImages || {}).find(img => img !== null) || "";
    
    const payload = {
      templateId: SYNTHESIA_TEMPLATE_ID,
      title: `Plan Details for ${body.companyName}`,
      description: "A personalized video based on your plan selections.",
      script: "",
      visibility: "public",
      branding: {
        primary_color: body.accentColor,
      },
      templateData: {
        // Use preview images instead of complex data mapping, with fallbacks
        preview_branding: body.previewImages?.branding || "",
        preview_eligibility: body.previewImages?.eligibility || "",
        preview_employee_deferrals: body.previewImages?.employeeDeferrals || "",
        preview_employer_contributions: body.previewImages?.employerContributions || "",
        preview_investments: body.previewImages?.investments || "",
        preview_resources: body.previewImages?.resources || "",

        // Basic info
        plan_type: body.planType,
        plan_name: body.planName,
        plan_ID: body.planId || "",
        
        // Use main preview image as background, or default
        bg: body.backgroundImage || "",
        logo: body.companyLogo || "",
        qr: body.qrUrl || "",
        avatar: body.avatarId || "",
        accent_color_image: body.accentColorImage || "", // S3 URL for Synthesia
        
        // Fallback values for any required fields
        plan_type_fallback: body.planType,
        plan_name_fallback: body.planName,
        company_name_fallback: body.companyName,
        disclaimer: disclaimer || "disclaimer",
      },
    };

    try {
      const synthesiaResponse = await axios.post(
        "https://api.synthesia.io/v2/videos/fromTemplate",
        payload,
        {
          headers: {
            Authorization: synthesiaApiKey,
            "Content-Type": "application/json",
          },
        },
      );

      const videoData = synthesiaResponse.data;

      // Create video record
      const newVideo = await prisma.video.create({
        data: {
          planId: new ObjectId(plan.id) as any,
          title: videoData.title,
          description: videoData.description,
          videoProvider: "synthesia",
          videoProviderId: videoData.id,
          videoStatus: "in_progress",
          data: videoData.data || null,
        },
      });

      const result = { ...plan, video: newVideo };

      // Send notification email
      try {
        await sendEmail({
          to: user.email,
          subject: "Your PlanTelligence Benefits Portal and related content are generating",
          html: mailTemplate,
        });
      } catch (emailError) {
        // Email failure shouldn't break the entire process
        console.error("Email sending failed:", emailError);
      }

      return NextResponse.json({
        message: "Plan created successfully with preview images",
        data: result,
      });
      
    } catch (synthesiaError: any) {
      // Create a video record with error status
      const newVideo = await prisma.video.create({
        data: {
          planId: new ObjectId(plan.id) as any,
          title: `Plan Details for ${body.companyName}`,
          description: "Video creation failed",
          videoProvider: "synthesia",
          videoProviderId: "error",
          videoStatus: "in_progress",
          data: { error: synthesiaError.message } as any,
        },
      });

      const result = { ...plan, video: newVideo };

      // Send notification email
      try {
        await sendEmail({
          to: user.email,
          subject: "Your PlanTelligence Benefits Portal and related content are generating",
          html: mailTemplate,
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      return NextResponse.json({
        message: "Plan created but video generation failed",
        data: result,
        warning: "Video creation failed, but plan was saved"
      });
    }
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: "Failed to create plan with preview images"
    }, { status: 500 });
  }
} 