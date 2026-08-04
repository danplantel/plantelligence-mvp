/**
 * Validates if a string is a valid domain or website URL (accepts various formats)
 * Accepts: example.com, www.example.com, https://example.com, https://www.example.com,
 *          example.com/path, https://example.com/path?query=1#hash, example.com:8080
 */
export function isValidDomain(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }

  const trimmedUrl = url.trim();

  // Reject strings containing whitespace
  if (/\s/.test(trimmedUrl)) {
    return false;
  }

  // Prepends a protocol when missing so `new URL` can parse bare domains too
  try {
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const parsed = new URL(candidate);

    // Hostname must contain a dot and have a valid domain suffix
    const hostname = parsed.hostname;
    return hostname.includes('.') && hostname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a clean domain name without www. or https://
 * Accepts domains and subdomains with optional paths, e.g.:
 * example.com, subdomain.example.com, example.com/path
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

  if (/\s/.test(trimmedUrl)) {
    return false;
  }

  try {
    const parsed = new URL(`https://${trimmedUrl}`);
    const hostname = parsed.hostname;
    return hostname.includes('.') && hostname.length > 1;
  } catch {
    return false;
  }
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
