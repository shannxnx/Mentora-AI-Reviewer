# Practice tests and student profiles

The signed-in workspace now includes `/dashboard/practice` and `/dashboard/profile`. Practice tests accept one to five saved reviewers within a subject, or a PDF through the existing reviewer API. The PDF path also saves its generated reviewer into the subject library. All four question types support easy, medium, hard, or mixed difficulty, 1–50 questions, and optional 1–180 minute limits. The count must be at least the number of selected types.

## Runtime configuration

Keep the existing Supabase and Gemini variables. Add a private `MENTORA_TEST_SECRET` consisting of 64 hexadecimal characters (32 cryptographically random bytes). It is configured in the local project's `.env.local`; when deploying, copy that same value to the hosting environment's secret store. Never prefix it with `NEXT_PUBLIC_`, commit it, or rotate it without migrating existing encrypted test keys. Existing tests depend on it. Generate a key for a new installation with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Apply the `practice_tests_and_profiles` database migration before running these features. This installation's migration has already been applied to the existing Mentora Supabase project. No existing study data is removed or rewritten.

## Design and data flow

- `lib/practice/model.ts` contains question types, validation, objective grading, and topic aggregation. `ai.ts` handles evidence-checked generation and semantic short-answer grading. `crypto.ts` encrypts answer keys with AES-256-GCM, and `server.ts` handles authentication and grading transitions.
- Practice API handlers read the authenticated student's saved reviewers, reuse `sourceTopics`, validate generated evidence against their facts, and save immutable tests. Answer keys and explanations are excluded from active-attempt responses. The stored answer blob is encrypted, with a separate hashed grading capability for database finalization.
- `practice_attempts` persists answers, a revision, a server deadline, and a final result snapshot. Private, ownership-checked database functions perform atomic transitions. Public RPC wrappers use security invoker. Direct client writes to attempts and scores are denied. These are personal study tests, not a proctored assessment system.
- Saves reject stale revisions from another tab. Submission freezes answers before AI grading. A grading failure leaves an attempt submitted and retryable. Repeated finalization preserves the original result. Retakes create separate attempts; starting the same test while an unfinished attempt exists resumes that attempt.
- Timers use the server's deadline and reject answers received after it. While open, expiry triggers submission. If the page is closed, the deadline still fixes the submission time; expiry is materialized on the next read/start/save, and grading completes when results are opened. No background AI job or cron service is required. Only answers saved before expiry count.
- MCQ and true/false answers are checked deterministically. Identification accepts generated equivalent terms with case/spacing normalization. Short answers use AI grading at 0, 0.5, or 1 point, with specific feedback. Blank answers receive zero without calling AI. Each question is worth one point.
- The profile's average is the mean percentage over all graded attempts, including retakes. Topic scores aggregate question points by reviewer/topic identity. Pending grading is excluded from averages. The trend uses graded attempts within the ten most recent history entries. History pages show 20 attempts; the library shows the 50 most recently generated tests.
- Active study tracking sends a heartbeat every 15 seconds only while the study page is visible, focused, and recently used. A per-account database clock avoids double-counting concurrent tabs, excludes long gaps, and records daily totals plus recent activity. Earlier study time is not fabricated or backfilled.
- Profile photos are cropped/resized locally to 256×256 JPEGs, then stored with owner-only profile data. Source uploads accept JPEG, PNG, and WebP up to 5 MB. Email and membership date remain account-owned fields.
- `lib/reviewer/library.ts` is shared by existing flashcards and the new PDF-to-test flow, preserving the existing fingerprint-based duplicate detection.

## Verification

Run `node --test tests/practice-model.test.cjs`, `npx tsc --noEmit`, and ESLint on the changed feature modules. Integration coverage includes real Supabase authentication, profile save/reload, live Gemini generation of all four types, autosave/reload, live short-answer grading, persisted scores/history, PDF-to-test generation, retakes, deadline expiry while closed, direct-score-write rejection, activity tracking, and desktop/mobile layouts.

Database transaction checks cover cross-account reads and writes, stale revisions, submission immutability, grading capability checks, idempotent grading, independent retakes, late-answer rejection, and summary calculations. Temporary QA data is removed after verification.

Security advisories include pre-existing public flashcard security-definer functions and the existing password-protection setting. The new private activity clock intentionally has RLS with no direct-access policy and no client table privileges; only the ownership-checked heartbeat function can touch it. New index-unused notices are expected before production use.
