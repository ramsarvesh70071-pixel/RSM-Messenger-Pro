/**
 * Escapes special regex characters from user input string to prevent ReDoS and regex injection.
 */
export function escapeRegex(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.slice(0, 64).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
