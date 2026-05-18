// app/(auth)/signup/page.tsx
"use client";

import Link from "next/link";
import UserAuthForm from "@/components/forms/user-signup-form";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const { theme = "system" } = useTheme();
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
      <div className="w-full max-w-[350px] space-y-3">
        <UserAuthForm />
      </div>
    </div>
  );
}
