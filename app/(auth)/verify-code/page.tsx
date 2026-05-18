"use client"

import VerifyCodeForm from "@/components/forms/verify-code-form";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function VerifyCodePage() {
  const { theme = 'system' } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);
  return (
    <div className="flex flex-col items-center justify-center h-screen pt-3 pb-3">
      <img
        src={
          themeMode === "dark" || themeMode === "system"
            ? "/pt_web_dark.png"
            : "/pt_web_light.png"
        }
        className="w-[260px] rounded-xl mx-auto"
        alt="PlanTelligence"
      />
      <div className="flex flex-col items-center justify-center w-full h-full p-4 mb-12 space-y-6 lg:p-8">
        <div className="w-full max-w-[350px] space-y-3">
          <div className="flex flex-col items-center space-y-2 text-center">
            <h1 className="text-3xl font-semibold dm-serif">
              Verification Code
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your verification code to continue
            </p>
          </div>
          <VerifyCodeForm />
        </div>
      </div>
      <footer className="text-sm text-center text-[#959595] mt-8">
        © 2025 PlanTelligence
      </footer>
    </div>
  );
}
