"use client";

import UserAuthForm from "@/components/forms/user-auth-form";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";

const SignIn = () => {
  const { theme = 'system' } = useTheme();
  const [themeMode, setThemeMode] = useState("");

  useEffect(() => {
    setThemeMode(theme);
  }, [theme]);

  return (
    <div className="flex flex-col items-center justify-center h-screen pt-3 pb-3">
      <div className="flex flex-col items-center justify-center w-full h-full p-4 mb-12 space-y-6 lg:p-8">
        <img
          src={
            themeMode === "dark"
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
};

export default SignIn;
