import { useState, useRef, useCallback } from 'react';
import { generateAllPreviewImages, PreviewImageData, PreviewConfig } from '@/lib/preview-image-generator';

export interface PreviewElementRefs {
  branding: React.RefObject<HTMLDivElement>;
  eligibility: React.RefObject<HTMLDivElement>;
  employeeDeferrals: React.RefObject<HTMLDivElement>;
  employerContributions: React.RefObject<HTMLDivElement>;
  investments: React.RefObject<HTMLDivElement>;
  resources: React.RefObject<HTMLDivElement>;
}

export function usePreviewImages() {
  const [previewImages, setPreviewImages] = useState<PreviewImageData>({
    branding: null,
    eligibility: null,
    employeeDeferrals: null,
    employerContributions: null,
    investments: null,
    resources: null,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Create refs for each preview section
  const previewRefs: PreviewElementRefs = {
    branding: useRef<HTMLDivElement>(null),
    eligibility: useRef<HTMLDivElement>(null),
    employeeDeferrals: useRef<HTMLDivElement>(null),
    employerContributions: useRef<HTMLDivElement>(null),
    investments: useRef<HTMLDivElement>(null),
    resources: useRef<HTMLDivElement>(null),
  };

  const generateImages = useCallback(async (config?: Partial<PreviewConfig>) => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      // Convert refs to elements
      const previewElements: Record<keyof PreviewImageData, HTMLElement | null> = {
        branding: previewRefs.branding.current,
        eligibility: previewRefs.eligibility.current,
        employeeDeferrals: previewRefs.employeeDeferrals.current,
        employerContributions: previewRefs.employerContributions.current,
        investments: previewRefs.investments.current,
        resources: previewRefs.resources.current,
      };
      
      // Filter out null elements
      const validElements = Object.entries(previewElements).filter(([_, element]) => element !== null);
      const totalElements = validElements.length;

      if (totalElements === 0) {
        throw new Error('No preview elements found');
      }

      const results: PreviewImageData = {
        branding: null,
        eligibility: null,
        employeeDeferrals: null,
        employerContributions: null,
        investments: null,
        resources: null,
      };

      // Generate images one by one to track progress
      for (let i = 0; i < validElements.length; i++) {
        const [key, element] = validElements[i];
        
        if (element) {
          try {
            // Import the function dynamically to avoid SSR issues
            const { generatePreviewImage, dataURLtoFile, uploadPreviewImage } = await import('@/lib/preview-image-generator');
            
            // Ensure the element has content for image generation
            // If the element is empty or has no visible content, it will still generate an "empty" image with proper styling
            const imageDataURL = await generatePreviewImage(element, {
              ...config,
              width: 800,
              height: 600,
              format: 'png',
              quality: 0.9
            });
            
            const filename = `${key}-preview.png`;
            const imageFile = dataURLtoFile(imageDataURL, filename);
            const imageUrl = await uploadPreviewImage(imageFile);
            
            results[key as keyof PreviewImageData] = imageUrl;
            
            // Update progress
            setGenerationProgress(((i + 1) / totalElements) * 100);
          } catch (error) {
            console.error(`Error generating image for ${key}:`, error);
            // Continue with other images even if one fails
          }
        }
      }

      setPreviewImages(results);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate preview images';
      setError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [previewRefs]);

  const generateImagesFromDataUrls = useCallback(async (
    imageDataArray: Array<{ key: string; dataUrl: string }>,
    config?: Partial<PreviewConfig>
  ) => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      const results: PreviewImageData = {
        branding: null,
        eligibility: null,
        employeeDeferrals: null,
        employerContributions: null,
        investments: null,
        resources: null,
      };

      // Process images one by one to track progress
      for (let i = 0; i < imageDataArray.length; i++) {
        const { key, dataUrl } = imageDataArray[i];
        
        try {
          // Import the functions dynamically to avoid SSR issues
          const { dataURLtoFile, uploadPreviewImage } = await import('@/lib/preview-image-generator');
          
          const filename = `${key}-preview.png`;
          const imageFile = dataURLtoFile(dataUrl, filename);
          const imageUrl = await uploadPreviewImage(imageFile);
          
          results[key as keyof PreviewImageData] = imageUrl;
          
          // Update progress
          setGenerationProgress(((i + 1) / imageDataArray.length) * 100);
        } catch (error) {
          console.error(`Error processing image for ${key}:`, error);
          // Continue with other images even if one fails
        }
      }

      setPreviewImages(results);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process preview images';
      setError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, []);

  const clearImages = useCallback(() => {
    setPreviewImages({
      branding: null,
      eligibility: null,
      employeeDeferrals: null,
      employerContributions: null,
      investments: null,
      resources: null,
    });
    setError(null);
  }, []);

  const hasImages = useCallback(() => {
    return Object.values(previewImages).some(image => image !== null);
  }, [previewImages]);

  return {
    previewImages,
    previewRefs,
    isGenerating,
    generationProgress,
    error,
    generateImages,
    generateImagesFromDataUrls,
    clearImages,
    hasImages,
  };
} 