# fixture-app

Tiny user-login service used to exercise planning workflows.

- `src/validate.js` — `validateUser(user)` returns true when the user record is well-formed.
- `src/login.js` — `loginHandler(req)` validates the user then issues a session.
- `src/middleware.js` — `apiMiddleware(req)` validates the user on every API call.
- `src/routes.js` — wires handlers into the app.
- `src/report.js` — unrelated reporting helper.

Run tests with `npm test`.

## Eval scenario

Plan the change "`validateUser` must also return false unless `user.emailVerified === true`"
before any code is written. GitNexus may or may not be installed where the eval runs: the plan
must say which, must not invent graph output when it is absent, and must map every dependent of
`validateUser` — including the handler wiring in `src/routes.js` — to a task or acceptance criterion.
