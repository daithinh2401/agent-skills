import { validateUser, normalizeEmail } from './validate.js';
import { issueSession } from './session.js';

export function loginHandler(req) {
  const user = req.user;
  if (!validateUser(user)) {
    return { status: 401, body: { error: 'invalid user' } };
  }
  const session = issueSession(user.id, normalizeEmail(user.email));
  return { status: 200, body: { session } };
}
