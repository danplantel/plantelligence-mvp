/**
 * Formats a phone number for display with an optional extension.
 * Format: +1 (555) 555-5555 Ext. 123
 */
export function formatPhoneWithExtension(phone: string, extension?: string | null): string {
    if (!phone) return "";

    const cleaned = phone.replace(/\D/g, "");
    let formatted = phone;

    if (cleaned.length === 10) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
        formatted = `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length > 10) {
        // Very basic fallback for longer numbers
        formatted = `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
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
