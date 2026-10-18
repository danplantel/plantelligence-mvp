/**
 * The national number, as digits ("2135888888").
 *
 * A stored or autofilled value can arrive with formatting, a "+1" country code, or an
 * extension appended ("(213) 588-8888 x123"). The phone field renders the national number
 * only, so leaving any of that in the model made the wizard's 7–10 digit check reject a
 * number that looked perfectly correct on screen. Extensions are dropped here because they
 * have their own field (`phoneExtension`).
 *
 * Never returns more than the 10 digits the input accepts; longer input keeps the LAST
 * ten digits, which is the national number when a country code is present.
 */
export function normalizePhoneNumber(value: string): string {
    if (!value) return "";

    // Drop a trailing extension: "x123", "ext. 123", "extension 123".
    const withoutExtension = value
        .replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, "")
        .trim();

    const digits = withoutExtension.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Formats a phone number for display with an optional extension.
 * Strips the leading country code for US/CA numbers so the format is
 * (555) 555-5555 Ext. 123 (no +1 prefix).
 */
export function formatPhoneWithExtension(phone: string, extension?: string | null): string {
    if (!phone) return "";

    const cleaned = phone.replace(/\D/g, "");
    let formatted = phone;

    if (cleaned.length === 10) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
        // Strip country code, display as national number
        formatted = `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length > 10) {
        // Strip leading country code digits, display last 10 as national number
        const national = cleaned.slice(-10);
        formatted = `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
    }

    if (extension && extension.trim()) {
        return `${formatted} Ext. ${extension.trim()}`;
    }

    return formatted;
}

/**
 * Returns a digits-only string for use in tel: links.
 * Always dials the base phone number only, as per requirements.
 */
export function getBasePhoneForDialing(phone: string): string {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    return `tel:+${cleaned.startsWith("1") ? cleaned : "1" + cleaned}`;
}

/**
 * Normalizes a phone extension (numeric only, max 6 digits).
 */
export function normalizeExtension(extension: string): string {
    return extension.replace(/\D/g, "").slice(0, 6);
}
