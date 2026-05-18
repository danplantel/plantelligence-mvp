/**
 * Utility for compressing and downscaling images on the client side using Canvas.
 * This helps stay within API payload limits (e.g., Vercel's 4.5MB limit).
 */

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Compresses an image data URL.
 * Returns the original if it's already small enough or if compression fails.
 */
export async function compressImage(
    dataUrl: string,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.8,
        mimeType = 'image/jpeg'
    } = options;

    // Don't compress small strings (SVG or tiny icons)
    if (dataUrl.length < 50000 && !dataUrl.startsWith('data:image/')) {
        return dataUrl;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Only downscale if larger than limits
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            } else if (dataUrl.length < 500000) {
                // If it fits well in payload and doesn't need scaling, return as is
                // (unless it's over 500KB, then we still want to compress the quality)
                // Note: JPEG compression usually reduces size even without scaling.
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }

            // Draw image on canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Export as compressed data URL
            const compressed = canvas.toDataURL(mimeType, quality);

            // Only return compressed version if it's actually smaller
            resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        };

        img.onerror = () => {
            resolve(dataUrl);
        };

        img.src = dataUrl;
    });
}

/**
 * Checks if a string payload is potentially too large for the API.
 * Vercel limit is 4.5MB, so we target ~4MB to be safe.
 */
export function isPayloadTooLarge(payload: string): boolean {
    return payload.length > 4 * 1024 * 1024;
}
