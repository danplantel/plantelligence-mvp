"use client";

import { useState, useEffect } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { ServiceType, License } from "@/types/wizard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServicesSection } from "./sections/services-section/services-section";

interface Step2ServicesProps {
  errorFields?: string[];
}

export function Step2Services({ errorFields = [] }: Step2ServicesProps) {
  const {
    saveStepDataLocally,
    saveStepData,
    stepData,
    loadStepData,
    validateCurrentStepFields,
  } = useOnboardingWizardStore();

  // Services state - now multi-selection
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(
    stepData.services?.services || [],
  );
  const [customService, setCustomService] = useState<string>(
    stepData.services?.customService || "",
  );

  // Licenses state
  const [licenses, setLicenses] = useState<License[]>(
    stepData.insuranceLicensing?.licenses || [],
  );

  // Load services from server when step mounts if not yet loaded (so categories auto-fill)
  useEffect(() => {
    if (!stepData.services?.services?.length && typeof loadStepData === "function") {
      loadStepData("services", true).then((loaded) => {
        if (loaded?.services?.length) {
          setSelectedServices(loaded.services);
          if (loaded.customService) setCustomService(loaded.customService);
        }
      });
    }
  }, [loadStepData]);

  // Update state when stepData changes
  useEffect(() => {
    if (stepData.services?.services) {
      setSelectedServices(stepData.services.services);
    }
    if (stepData.services?.customService) {
      setCustomService(stepData.services.customService);
    }
  }, [stepData.services]);

  useEffect(() => {
    if (stepData.insuranceLicensing) {
      setLicenses(stepData.insuranceLicensing.licenses || []);
    }
  }, [stepData.insuranceLicensing?.licenses]);

  const saveServices = async (newServices: ServiceType[]) => {
    setSelectedServices(newServices);
    const servicesData = {
      services: newServices,
      customService: newServices.includes(ServiceType.OTHER) ? customService : "",
    };
    await saveStepDataLocally("services", servicesData);
    try {
      await saveStepData("services", servicesData, true);
    } catch (error) {
      console.error("Failed to save services to server:", error);
    }
    updateInsuranceLicensing(newServices);
    setTimeout(() => validateCurrentStepFields(), 100);
  };

  const onServicesChange = async (newServices: ServiceType[]) => {
    if (!newServices.includes(ServiceType.OTHER)) {
      setCustomService("");
    }
    await saveServices(newServices);
  };

  const onCustomServiceChange = async (value: string) => {
    setCustomService(value);
    const servicesData = {
      services: selectedServices,
      customService: value,
    };
    await saveStepDataLocally("services", servicesData);
    // Also save to server to prevent data loss
    try {
      await saveStepData("services", servicesData, true);
    } catch (error) {
      console.error("Failed to save services to server:", error);
    }
    // Validate fields in real-time
    setTimeout(() => validateCurrentStepFields(), 100);
  };

  // Helper function to update insurance licensing
  const updateInsuranceLicensing = (services: ServiceType[]) => {
    const hasInsuranceServices =
      services.includes(ServiceType.GROUP_HEALTH) ||
      services.includes(ServiceType.GROUP_LIFE_DISABILITY);

    const insuranceData = {
      offersInsurance: hasInsuranceServices,
      attestation: false,
      licenses: licenses || [],
    };

    saveStepDataLocally("insuranceLicensing", insuranceData);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="items-start gap-4 grid grid-cols-1">
          {/* Services Section */}
          <div>
            <ServicesSection
              selectedServices={selectedServices}
              onServicesChange={onServicesChange}
              customService={customService}
              onCustomServiceChange={onCustomServiceChange}
              errorFields={errorFields}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
