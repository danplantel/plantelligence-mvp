import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import sendMail from "@/lib/sendMail";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, message } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create test invitation email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #23919C 0%, #3C76DC 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Plantelligence</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
            You've been invited to join our platform
          </p>
        </div>
        
        <div style="padding: 40px 20px; background: #f8f9fa;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Test Invitation</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0;">
            This is a test invitation to demonstrate the onboarding flow. 
            You won't be able to complete the actual registration process.
          </p>
          
          ${message ? `
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1976d2; margin: 0 0 10px 0;">Personal Message:</h3>
              <p style="color: #666; margin: 0; font-style: italic;">"${message}"</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="
              background: #23919C; 
              color: white; 
              padding: 15px 30px; 
              text-decoration: none; 
              border-radius: 8px; 
              display: inline-block;
              font-weight: bold;
            ">
              View Onboarding Flow (Test)
            </a>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">⚠️ Test Mode</h3>
            <p style="color: #856404; margin: 0; font-size: 14px;">
              This is a demonstration email. No actual account will be created.
            </p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background: #f1f3f4;">
          <p style="color: #666; margin: 0; font-size: 12px;">
            © 2024 Plantelligence. This is a test email.
          </p>
        </div>
      </div>
    `;

    // Send the email
    await sendMail({
      to: email,
      subject: "Test Invitation - Plantelligence Onboarding",
      html: emailContent,
    });

    return NextResponse.json({ 
      success: true, 
      message: "Test invitation sent successfully" 
    });

  } catch (error) {
    console.error("Error sending test invite:", error);
    return NextResponse.json(
      { error: "Failed to send test invitation" }, 
      { status: 500 }
    );
  }
}
