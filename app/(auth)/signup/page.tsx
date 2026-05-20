// app/(auth)/signup/page.tsx
"use client";

import Link from "next/link";
import UserAuthForm from "@/components/forms/user-signup-form";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function SignupPage() {
  const { theme = "system", setTheme } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex flex-col h-screen">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors z-50"
        aria-label="Toggle theme"
      >
        {themeMode === "dark" ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-700" />
        )}
      </button>
      <div className="flex flex-col items-center justify-center flex-1 pt-3 pb-3">
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
    </div>
  );
}
