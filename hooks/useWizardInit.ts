import { useEffect, useState } from 'react';
import { useOnboardingWizardStore } from '@/lib/onboarding-wizard-store';

export function useWizardInit() {
  const { loadAllWizardData, resetWizard, currentStep } = useOnboardingWizardStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeWizard = async () => {
      if (isInitialized) return;
      
      try {
        await loadAllWizardData();
      } catch (error) {
        console.error('useWizardInit: Error loading wizard data:', error);
        resetWizard();
      }
      
      setIsInitialized(true);
    };

    // Use setTimeout to avoid blocking the main thread
    setTimeout(initializeWizard, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]); // Only run when isInitialized changes

  return { isInitialized, currentStep };
}
