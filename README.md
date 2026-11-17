# Mentora AI Reviewer

Mentora turns lecture PDFs and PowerPoint presentations into study guides, flashcards, and practice tests. Students can organize saved reviewers by subject and folder, rate flashcard recall, resume tests, and track study activity in their profile.

## Run locally

1. Install the locked dependencies with `npm ci` and copy `.env.example` to `.env.local`.
2. Set the Supabase URL and publishable key, the server-side `GEMINI_API_KEY`, and the private `MENTORA_TEST_SECRET`. For a new installation, generate the test secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep the same secret across deployments of an existing database so saved practice tests can be graded.
3. On a new database, apply the SQL files in `supabase/migrations` in timestamp order. Configure the site URL and allowed confirmation and recovery redirects in Supabase Auth.
4. Start the app with `npm run dev`. For a production build, run `npm run build` followed by `npm start`.

## Study workflow

- Upload one PDF, PowerPoint 97–2003 (.ppt), or PowerPoint (.pptx) file up to 10 MB. PowerPoint slides are extracted in presentation order with readable notes and table text. PPTX also supports chart labels, SmartArt text, and embedded PNG/JPEG images (up to 12 images and 4 MB total). For legacy pictures, other visual formats, or complex layouts, export to PDF to preserve the appearance.
- **Concise** prioritizes short explanations. **Balanced** can include worked examples, comparisons, and recall checks. The server sends the PDF or extracted slide content to Gemini. Mentora stores the generated reviewer when the student saves it to a subject.
- The signed-in student’s latest reviewer and reading progress are remembered in the current tab. Uploading identical bytes at the same depth reopens that reviewer. Newly saved reviewers can also be reused across sessions for the same account. Older records remain accessible through My Materials. Select **Generate a fresh version** to request a new one.
- Open **My Materials** to reopen saved reviewers. In **Flashcards**, select a reviewer, generate a deck, and rate recall. In **Practice Tests**, choose saved reviewers or upload a document. The profile shows graded attempts and recorded activity.

## Verification

Run `node --test tests/*.test.cjs`, `npm run lint`, and `npm run build`. The production build also checks TypeScript.

Successful `POST /api/reviewer` responses include `Server-Timing` durations in milliseconds for account verification (`auth`), receiving and validating the PDF body (`pdf`) or extracting a presentation (`slides`), and the Gemini call plus response validation (`gemini`). The browser upload indicator reports bytes sent. The signed-in APIs return JSON errors when a session expires.

Practice-test encryption, grading, autosave, deadlines, and profile statistics are documented in [Practice tests and profiles](docs/practice-and-profile.md).
