import { useState, useEffect, useRef } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

export function useContactStyles() {
    const { stepData, saveStepDataLocally, saveStepDataToServer } = useNewClientWizardStore();
    const isSyncingFromStore = useRef(false);


    const getInitialStyles = () => {
        const keyContacts = stepData.keyContacts;
        return {
            cardPrimaryColor: keyContacts?.cardPrimaryColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            cardSecondaryColor: keyContacts?.cardSecondaryColor || stepData.companyBasics?.secondaryColor || "#000000",
            cardBackgroundColor: keyContacts?.cardBackgroundColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            logoScale: keyContacts?.logoScale || 1,
        };
    };

    const [styles, setStyles] = useState(getInitialStyles());

    // Save data when it changes
    useEffect(() => {
        if (isSyncingFromStore.current) {
            isSyncingFromStore.current = false;
            return;
        }

        const currentKeyContacts = stepData.keyContacts || { contacts: [] };
        if (
            currentKeyContacts.cardPrimaryColor === styles.cardPrimaryColor &&
            currentKeyContacts.cardSecondaryColor === styles.cardSecondaryColor &&
            currentKeyContacts.cardBackgroundColor === styles.cardBackgroundColor &&
            currentKeyContacts.logoScale === styles.logoScale
        ) {
            return;
        }

        const updatedKeyContacts = {
            ...currentKeyContacts,
            cardPrimaryColor: styles.cardPrimaryColor,
            cardSecondaryColor: styles.cardSecondaryColor,
            cardBackgroundColor: styles.cardBackgroundColor,
            logoScale: styles.logoScale,
        };

        saveStepDataLocally("keyContacts", updatedKeyContacts);

        // Also persist to server to ensure data survives page refresh and wizard completion
        saveStepDataToServer("keyContacts", updatedKeyContacts);
    }, [styles, saveStepDataLocally, saveStepDataToServer, stepData.keyContacts]);


    // Sync with store when it changes externally
    useEffect(() => {
        const keyContacts = stepData.keyContacts;
        const storeStyles = {
            cardPrimaryColor: keyContacts?.cardPrimaryColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            cardSecondaryColor: keyContacts?.cardSecondaryColor || stepData.companyBasics?.secondaryColor || "#000000",
            cardBackgroundColor: keyContacts?.cardBackgroundColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            logoScale: keyContacts?.logoScale || 1,
        };

        if (
            (storeStyles.cardPrimaryColor !== styles.cardPrimaryColor ||
                storeStyles.cardSecondaryColor !== styles.cardSecondaryColor ||
                storeStyles.cardBackgroundColor !== styles.cardBackgroundColor ||
                storeStyles.logoScale !== styles.logoScale) &&
            !isSyncingFromStore.current
        ) {
            isSyncingFromStore.current = true;
            setStyles(storeStyles);
        }
    }, [
        stepData.keyContacts?.cardPrimaryColor,
        stepData.keyContacts?.cardSecondaryColor,
        stepData.keyContacts?.cardBackgroundColor,
        stepData.keyContacts?.logoScale,
        stepData.companyBasics?.primaryColor,
        stepData.companyBasics?.secondaryColor,
    ]);

    const updateStyle = (field: "cardPrimaryColor" | "cardSecondaryColor" | "cardBackgroundColor" | "logoScale", value: any) => {
        setStyles((prev) => ({ ...prev, [field]: value }));
    };

    return {
        styles,
        setStyles,
        updateStyle,
    };
}
