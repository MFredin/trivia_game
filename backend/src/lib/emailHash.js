import crypto from 'node:crypto';

// A one-way fingerprint of an email address, kept for banned accounts only so the address cannot
// simply be registered again after the account is deleted. Normalised first, so Case@Example.com
// and case@example.com are the same address.
export function hashEmail(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}
