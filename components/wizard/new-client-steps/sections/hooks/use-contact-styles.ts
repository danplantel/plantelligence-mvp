import { useState, useEffect, useRef, useCallback } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";

export function useContactStyles() {
    const { stepData, saveStepDataLocally, saveStepDataToServer } = useNewClientWizardStore();

    // Track whether we're currently syncing FROM the store (to avoid writing
    // back what we just read). Using a ref avoids adding it to effect deps.
    const isSyncingFromStore = useRef(false);

    // Keep a ref to the latest store keyContacts so the "Save" effect can
    // read it without listing `stepData.keyContacts` as a dependency.
    // This breaks the circular effect chain:
    //   styles change → save to store → store changes → sync from store → styles change → …
    const latestKeyContactsRef = useRef(stepData.keyContacts);
    latestKeyContactsRef.current = stepData.keyContacts;

    const getInitialStyles = () => {
        const keyContacts = stepData.keyContacts;
        return {
            cardPrimaryColor: keyContacts?.cardPrimaryColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            cardSecondaryColor: keyContacts?.cardSecondaryColor || stepData.companyBasics?.secondaryColor || "#000000",
            cardBackgroundColor: keyContacts?.cardBackgroundColor || "#ffffff",
            logoScale: keyContacts?.logoScale || 1,
        };
    };

    const [styles, setStyles] = useState(getInitialStyles());

    // Save local styles to the store when they change.
    // Does NOT depend on `stepData.keyContacts` — uses a ref instead.
    useEffect(() => {
        if (isSyncingFromStore.current) {
            isSyncingFromStore.current = false;
            return;
        }

        const currentKeyContacts = latestKeyContactsRef.current || { contacts: [] };
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
        saveStepDataToServer("keyContacts", updatedKeyContacts);
    }, [styles, saveStepDataLocally, saveStepDataToServer]);

    // Sync local styles FROM the store when the store changes externally.
    useEffect(() => {
        const keyContacts = stepData.keyContacts;
        const storeStyles = {
            cardPrimaryColor: keyContacts?.cardPrimaryColor || stepData.companyBasics?.primaryColor || "#1F3A60",
            cardSecondaryColor: keyContacts?.cardSecondaryColor || stepData.companyBasics?.secondaryColor || "#000000",
            cardBackgroundColor: keyContacts?.cardBackgroundColor || "#ffffff",
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

    const updateStyle = useCallback(
        (field: "cardPrimaryColor" | "cardSecondaryColor" | "cardBackgroundColor" | "logoScale", value: any) => {
            setStyles((prev) => ({ ...prev, [field]: value }));
        },
        [],
    );

    return {
        styles,
        setStyles,
        updateStyle,
    };
}
