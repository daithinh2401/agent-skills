// Returns true when the user record is well-formed.
export function validateUser(user) {
  if (!user) return false;
  if (typeof user.id !== 'string' || user.id.length === 0) return false;
  if (typeof user.email !== 'string' || !user.email.includes('@')) return false;
  return true;
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
