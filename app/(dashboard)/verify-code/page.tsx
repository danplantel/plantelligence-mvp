"use client"

import VerifyCodeForm from "@/components/forms/verify-code-form";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function VerifyCodePage() {
  const { theme = 'system', setTheme } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="relative flex flex-col h-screen bg-background">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-secondary/80 backdrop-blur-sm hover:bg-secondary transition-colors z-50"
        aria-label="Toggle theme"
      >
        {themeMode === "dark" ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <div className="w-full max-w-[400px] p-8 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center space-y-6">
            <img
              src={
                themeMode === "dark" || themeMode === "system"
                  ? "plantelligence-logos/pt_web_dark.png"
                  : "plantelligence-logos/pt_web_light.png"
              }
              className="w-[220px] rounded-xl"
              alt="PlanTelligence"
            />
            <div className="flex flex-col items-center space-y-2 text-center">
              <h1 className="text-2xl font-semibold dm-serif text-foreground">
                Verification Code
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your verification code to continue
              </p>
            </div>
            <VerifyCodeForm />
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} PlanTelligence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
