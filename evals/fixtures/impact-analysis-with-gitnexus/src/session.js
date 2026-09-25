let counter = 0;

export function issueSession(userId, email) {
  counter += 1;
  return { token: `${userId}:${email}:${counter}`, issuedAt: Date.now() };
}
