"use client";

import UserAuthForm from "@/components/forms/user-auth-form";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const SignIn = () => {
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
                themeMode === "dark"
                  ? "plantelligence-logos/pt_web_dark.png"
                  : "plantelligence-logos/pt_web_light.png"
              }
              className="w-[220px] rounded-xl"
              alt="PlanTelligence"
            />
            <UserAuthForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
