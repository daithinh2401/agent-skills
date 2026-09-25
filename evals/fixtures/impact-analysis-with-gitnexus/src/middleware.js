import { validateUser } from './validate.js';

export function apiMiddleware(req) {
  if (!validateUser(req.user)) {
    return { status: 403, body: { error: 'forbidden' } };
  }
  return null;
}
