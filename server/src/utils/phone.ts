import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Normalizes any phone number into standard international E.164 format (e.g., +919876543210).
 * Supports default country fallback if number does not begin with '+'.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountry: CountryCode = 'IN'): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Phone number is required');
  }

  const trimmed = rawPhone.trim();
  try {
    const parsed = parsePhoneNumber(trimmed, trimmed.startsWith('+') ? undefined : defaultCountry);
    if (!parsed || !parsed.isValid()) {
      throw new Error(`Invalid phone number: ${rawPhone}`);
    }
    return parsed.number; // E.164 standard, e.g. "+919876543210"
  } catch (err: any) {
    throw new Error(`Invalid phone number: ${rawPhone} (${err.message || 'parse failure'})`);
  }
}

/**
 * Validates whether a given raw phone string is a valid phone number.
 */
export function isValidPhoneNumber(rawPhone: string, defaultCountry: CountryCode = 'IN'): boolean {
  try {
    normalizePhoneNumber(rawPhone, defaultCountry);
    return true;
  } catch {
    return false;
  }
}
