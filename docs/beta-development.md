# Host Upgrade Planner: next beta milestone

Updated 22 October 2026 (Europe/Rome).

## Product focus

The current product helps a host or small property manager turn guest feedback into a costed improvement plan that an authorized property owner can approve, then track through implementation. The useful first outcome is a reviewable, source-backed plan with clear costs and outstanding conditions. Revenue or guest-rating improvements remain hypotheses to validate with users.

The first beta should prove that someone can complete that workflow on one property, understand the difference between approval and purchase readiness, and return to record the work. This iteration strengthens that path before adding billing or more integrations.

## Delivered in this iteration

1. **A concrete next step.** Each project explains the appropriate next action for its current state and actor. It covers empty projects, manual observations, changed evidence, incomplete costs, pending decisions, requested changes, purchase checks and follow-up. The overview's Continue action opens the suggested stage.
2. **Working non-purchase interventions.** Rearrange, keep, operational change, inspect and defer no longer fail because a hidden quantity field becomes zero. Existing quantities survive edits and conversion from a purchase.
3. **Protection against lost input.** Sidebar/back/home navigation, workspace/persona changes and sign-out respect pending form edits. A handled save failure does not mark input as saved. Accepting a persona change resets the relevant form to the stored data.
4. **Invitation continuity.** The invitation stays attached through sign-in, email confirmation and password recovery. Callback errors are visible and preserve the invitation. This code does not send invitations or validate a production mail service.
5. **Preserved work during live AI issue reanalysis.** Selected issue links, operator observations, explicit assessments, intervention lines and costs survive extraction refresh. Invalid protected citations stop the request before the provider call; duplicate extracted IDs cannot become a completed run.

No dependency versions, database schema, purchase rules or paid infrastructure were changed.

## Try the changed workflow

Run the app using the README instructions and open `/demo`.

- Open the studio project. Use Suggested next step to jump to Approval; the initial estimate can be reviewed but is not purchase-ready.
- In Options, add an operational change or inspection and save it. Reload to verify persistence.
- Edit the Brief without saving, then use the sidebar or change persona. Cancel the prompt to keep the input; confirm to discard it.
- Submit a revision and switch to an authorized demo persona. Record a decision and inspect how the next-step advice changes.
- Visit `/auth/callback` without a confirmation code to see a recoverable authentication error. This is a failure-path check, not proof of working hosted authentication.

## Remaining priorities before real customer data

| Priority | Work                                                                                         | Acceptance condition                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Configure a dedicated Supabase test environment, migration, Auth redirects and mail delivery | Sign-up, confirmation, recovery, invitation acceptance, property-specific access, private uploads and reload all pass against the actual services              |
| 1        | Make live deletion and private-file cleanup recoverable under concurrent edits               | A stale project-deletion request cannot remove files belonging to a project that remains in the database; failed cleanup has a recorded, authorized retry path |
| 2        | Separate current-revision tasks from historical task records                                 | Overview and Completion show current work clearly while retaining historical expenditure and decisions                                                         |
| 2        | Validate optional live AI with authorized synthetic inputs                                   | Evidence and protected links survive one real extraction/refresh; cost, timeout and retry behavior are observed                                                |
| 3        | Run a small invited pilot                                                                    | Each participant completes a property-to-decision workflow; record where they stop, what they trust and whether they would pay for the result                  |
| 4        | Decide pricing and billing after pilot evidence                                              | A specific buyer, paid outcome and repeat-use pattern are established before subscription development                                                          |

### Known live deletion issue

The existing `server/repository.ts` deletion path removes storage objects before its revision-checked project deletion. A concurrent project update can make the database deletion fail after files have been removed. This iteration does not alter that path or claim production-safe cleanup. Resolve it with a transactional deletion state/outbox and recoverable storage cleanup before using real assets.

### Evidence boundaries

The test suite uses synthetic data, mocked AI/auth requests, and an embedded PostgreSQL engine. The separate live Supabase suite remains skipped without a disposable local instance. Neither these tests nor a successful build establish that a hosted account, real email delivery, real AI provider or deployment is configured.

See [verification results](test-results.md) for the exact checks and environment-specific build notes.
