/**
 * Validates if a string is a valid domain (accepts various formats)
 * Accepts: example.com, www.example.com, https://example.com, https://www.example.com
 */
export function isValidDomain(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmedUrl = url.trim();
  
  // Must contain a dot
  if (!trimmedUrl.includes('.')) {
    return false;
  }

  // Basic domain validation - check it has valid characters
  const domainRegex = /^[a-zA-Z0-9.-]+$/;
  
  return domainRegex.test(trimmedUrl);
}

/**
 * Validates if a string is a clean domain name without www. or https://
 * Only accepts domains like: example.com, subdomain.example.com
 */
export function isValidCleanDomain(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmedUrl = url.trim();
  
  // Must not start with www. or https:// or http://
  if (trimmedUrl.startsWith('www.') || 
      trimmedUrl.startsWith('https://') || 
      trimmedUrl.startsWith('http://')) {
    return false;
  }

  // Must contain a dot
  if (!trimmedUrl.includes('.')) {
    return false;
  }

  // Basic domain validation - just check it has valid characters
  const domainRegex = /^[a-zA-Z0-9.-]+$/;
  
  return domainRegex.test(trimmedUrl);
}

/**
 * Normalizes a clean domain by ensuring it doesn't have www. or protocol
 */
export function normalizeCleanDomain(url: string): string {
  if (!url || url.trim() === '') {
    return '';
  }

  let normalizedUrl = url.trim();

  // Remove protocol if present
  if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
  }

  // Remove www. if present
  if (normalizedUrl.startsWith('www.')) {
    normalizedUrl = normalizedUrl.replace(/^www\./, '');
  }

  return normalizedUrl;
}
