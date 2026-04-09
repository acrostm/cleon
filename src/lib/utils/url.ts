/**
 * Extracts the first absolute HTTP/HTTPS URL from a given text string.
 * This handles dirty share links pasted from social media platforms.
 * 
 * @param text - The raw input string potentially containing a URL
 * @returns The extracted URL string, or null if no URL is found
 */
export function extractUrl(text: string): string | null {
  if (!text) return null;
  // Match http:// or https:// followed by any non-whitespace characters
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
}
