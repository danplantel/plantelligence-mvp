import { useState, useEffect } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

export function useBannerOverlaySettings() {
  const { stepData } = useNewClientWizardStore();

  const [heroContainerOpacity, setHeroContainerOpacity] = useState<number>(
    (stepData.companyBasics as any)?.heroContainerOpacity ?? 0.67,
  );
  const [heroCompanyNameColor, setHeroCompanyNameColor] = useState<
    "yellow" | "default"
  >((stepData.companyBasics as any)?.heroCompanyNameColor || "yellow");
  const [heroContainerInverted, setHeroContainerInverted] = useState<boolean>(
    (stepData.companyBasics as any)?.heroContainerInverted ?? false,
  );
  const [heroBackgroundInverted, setHeroBackgroundInverted] = useState<boolean>(
    (stepData.companyBasics as any)?.heroBackgroundInverted ?? false,
  );

  useEffect(() => {
    const containerOpacity =
      (stepData.companyBasics as any)?.heroContainerOpacity ?? 0.67;
    const companyNameColor =
      (stepData.companyBasics as any)?.heroCompanyNameColor || "yellow";
    const containerInverted =
      (stepData.companyBasics as any)?.heroContainerInverted ?? false;
    const backgroundInverted =
      (stepData.companyBasics as any)?.heroBackgroundInverted ?? false;

    setHeroContainerOpacity(containerOpacity);
    setHeroCompanyNameColor(companyNameColor);
    setHeroContainerInverted(containerInverted);
    setHeroBackgroundInverted(backgroundInverted);
  }, [
    (stepData.companyBasics as any)?.heroContainerOpacity,
    (stepData.companyBasics as any)?.heroCompanyNameColor,
    (stepData.companyBasics as any)?.heroContainerInverted,
    (stepData.companyBasics as any)?.heroBackgroundInverted,
  ]);

  return {
    heroContainerOpacity,
    heroCompanyNameColor,
    heroContainerInverted,
    heroBackgroundInverted,
    setHeroContainerOpacity,
    setHeroCompanyNameColor,
    setHeroContainerInverted,
    setHeroBackgroundInverted,
  };
}

