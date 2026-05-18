import { useState, useEffect, useRef } from "react";
import type { CompanyBasicsData } from "@/types/new-client-wizard";

export function useHeroContent(
  companyData: CompanyBasicsData | undefined,
  onCompanyDataChange?: (field: any, value: any) => void,
  saveStepDataLocally?: (key: string, data: any) => void,
) {
  const getInitialHeadline = () => {
    return (
      (companyData as any)?.heroTitle ||
      `Welcome to the ${companyData?.companyName || "Company Name"} Benefits Hub!`
    );
  };

  const getInitialDescription = () => {
    return (
      (companyData as any)?.heroDescription ||
      "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer."
    );
  };

  const [heroTitle, setHeroTitle] = useState(getInitialHeadline());
  const [heroDescription, setHeroDescription] = useState(
    getInitialDescription(),
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const isUserEditingRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (isUserEditingRef.current) return;

    const newHeroTitle =
      (companyData as any)?.heroTitle ||
      `Welcome to the ${
        companyData?.companyName || "Company Name"
      } Benefits Hub!`;
    const newHeroDescription =
      (companyData as any)?.heroDescription ||
      "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

    setHeroTitle(newHeroTitle);
    setHeroDescription(newHeroDescription);
    hasInitializedRef.current = true;
  }, [
    (companyData as any)?.heroTitle,
    (companyData as any)?.heroDescription,
    companyData?.companyName,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = (override?: {
    heroTitle?: string;
    heroDescription?: string;
  }) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const nextHeroTitle = override?.heroTitle ?? heroTitle;
      const nextHeroDescription = override?.heroDescription ?? heroDescription;

      if (onCompanyDataChange) {
        onCompanyDataChange("heroTitle", nextHeroTitle);
        onCompanyDataChange("heroDescription", nextHeroDescription);
      } else if (saveStepDataLocally) {
        // This will be provided from the parent component
      }
    }, 500);
  };

  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (isUserEditingRef.current) return;

    const newHeroTitle = (companyData as any)?.heroTitle;
    const newHeroDescription = (companyData as any)?.heroDescription;

    if (newHeroTitle && newHeroTitle !== heroTitle) {
      setHeroTitle(newHeroTitle);
    }
    if (newHeroDescription && newHeroDescription !== heroDescription) {
      setHeroDescription(newHeroDescription);
    }
  }, [
    (companyData as any)?.heroTitle,
    (companyData as any)?.heroDescription,
    heroTitle,
    heroDescription,
  ]);

  return {
    heroTitle,
    heroDescription,
    setHeroTitle,
    setHeroDescription,
    handleSave,
    isUserEditingRef,
    hasInitializedRef,
  };
}

