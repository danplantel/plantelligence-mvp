/**
 * Extract primary and secondary colors from an image
 * Uses canvas to analyze pixel data and find dominant colors
 */

interface ColorResult {
  primary: string;
  secondary: string;
}

/**
 * Convert RGB to Hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

/**
 * Get color distance (simple Euclidean distance in RGB space)
 */
function getColorDistance(color1: [number, number, number], color2: [number, number, number]): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Extract primary and secondary colors from image
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ColorResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Set canvas size to image size (limit to 200x200 for performance)
        const maxSize = 200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Collect all colors with their frequencies
        const colorMap = new Map<string, number>();
        const colors: [number, number, number][] = [];

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip near-white and near-black pixels (often backgrounds)
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;

          const hex = rgbToHex(r, g, b);
          colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
          colors.push([r, g, b]);
        }

        if (colors.length === 0) {
          // Fallback if no suitable colors found
          resolve({
            primary: "#1F3A60",
            secondary: "#4A90E2"
          });
          return;
        }

        // Sort colors by frequency
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Get top 10 colors
          .map(([hex]) => hex);

        // Primary color is the most frequent
        const primaryColor = sortedColors[0];

        // Secondary color is the most different from primary
        let secondaryColor = sortedColors[1] || primaryColor;
        let maxDistance = 0;

        const primaryRGB = [
          parseInt(primaryColor.slice(1, 3), 16),
          parseInt(primaryColor.slice(3, 5), 16),
          parseInt(primaryColor.slice(5, 7), 16)
        ] as [number, number, number];

        for (const hex of sortedColors.slice(1)) {
          const rgb = [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
          ] as [number, number, number];

          const distance = getColorDistance(primaryRGB, rgb);
          if (distance > maxDistance) {
            maxDistance = distance;
            secondaryColor = hex;
          }
        }

        resolve({
          primary: primaryColor,
          secondary: secondaryColor
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
}
