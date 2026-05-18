import html2canvas from 'html2canvas';

export interface PreviewImageData {
  branding: string | null;
  eligibility: string | null;
  employeeDeferrals: string | null;
  employerContributions: string | null;
  investments: string | null;
  resources: string | null;
}

export interface PreviewConfig {
  width: number;
  height: number;
  quality: number;
  format: 'png' | 'jpeg' | 'webp';
}

const DEFAULT_CONFIG: PreviewConfig = {
  width: 800,
  height: 600,
  quality: 0.9,
  format: 'png'
};

/**
 * Generates a preview image from a DOM element
 */
export async function generatePreviewImage(
  element: HTMLElement,
  config: Partial<PreviewConfig> = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  try {
    // Check if element is visible and has content
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Element has no dimensions');
    }

    // Ensure the element has proper styling for image generation
    const originalStyle = element.style.cssText;
    
    // Apply consistent styling for image generation
    element.style.background = 'transparent';
    element.style.padding = '20px';
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.justifyContent = 'center';
    element.style.alignItems = 'flex-end';
    element.style.minHeight = '400px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.width = `${finalConfig.width}px`;
    element.style.height = `${finalConfig.height}px`;

    // Check if the element has any visible content
    const hasContent = element.textContent && element.textContent.trim().length > 0;
    const hasImages = element.querySelectorAll('img').length > 0;
    
    // If no content, add a placeholder to ensure the image is generated
    if (!hasContent && !hasImages) {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        color: #666;
        font-size: 24px;
        text-align: right;
        padding-right: 32px;
        font-family: Arial, sans-serif;
      `;
      placeholder.textContent = 'Preview content will appear here';
      element.appendChild(placeholder);
    }

    const canvas = await html2canvas(element, {
      width: finalConfig.width,
      height: finalConfig.height,
      scale: 2, // Higher resolution like generateEligibilityImage
      useCORS: true,
      allowTaint: true,
      backgroundColor: null, // Transparent background like generateEligibilityImage
      logging: false,
      imageTimeout: 15000,
      removeContainer: true,
      foreignObjectRendering: true,
    });

    // Restore original styling
    element.style.cssText = originalStyle;

    const dataURL = canvas.toDataURL(`image/${finalConfig.format}`, finalConfig.quality);
    return dataURL;
  } catch (error) {
    throw new Error(`Failed to generate preview image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Converts a data URL to a File object for upload
 */
export function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Uploads a preview image to the server
 */
export async function uploadPreviewImage(imageFile: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', imageFile);
  try {
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload preview image: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    if (!result.url) {
      throw new Error('Upload response missing URL');
    }
    return result.url;
  } catch (error) {
    throw error;
  }
}

/**
 * Generates all preview images for a plan
 */
export async function generateAllPreviewImages(
  previewElements: Record<keyof PreviewImageData, HTMLElement | null>,
  config: Partial<PreviewConfig> = {}
): Promise<PreviewImageData> {
  const results: PreviewImageData = {
    branding: null,
    eligibility: null,
    employeeDeferrals: null,
    employerContributions: null,
    investments: null,
    resources: null,
  };
  for (const [key, element] of Object.entries(previewElements)) {
    if (element) {
      try {
        const imageDataURL = await generatePreviewImage(element, config);
        const filename = `${key}-preview.${config.format || 'png'}`;
        const imageFile = dataURLtoFile(imageDataURL, filename);
        const imageUrl = await uploadPreviewImage(imageFile);
        results[key as keyof PreviewImageData] = imageUrl;
      } catch (error) {
        // Continue with other images even if one fails
      }
    }
  }
  return results;
} 