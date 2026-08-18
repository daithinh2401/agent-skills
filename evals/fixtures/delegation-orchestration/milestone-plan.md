# Milestone: checkout service — plan items ready to delegate

The plan is approved. These items are about to be dispatched to implementation
subagents. No task cards have been written yet; the spawn prompts so far are
one-line asks typed from memory.

Plan items:

1. Add an idempotency-key column to the `orders` table and enforce it on the
   create-order endpoint.
2. Bulk-rename the legacy `custId` field to `customerId` across 40 files.
3. Refactor the payment-retry loop to use the shared backoff helper.

Environment facts (currently rediscovered by every agent):

- API runs at `http://localhost:8080`; gate command is `npm run verify`.
- Commit hook requires a Conventional Commits message with a `Refs:` trailer.
- The test DB must be reset with `npm run db:reset` before integration tests.

Known friction: agents keep verifying against an in-memory stub instead of the
real service, two agents committed at once last week and raced the git index,
and re-briefs are rewritten from scratch on every follow-up.
