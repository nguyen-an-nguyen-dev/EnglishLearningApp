# Engorace — English Learning Platform

Engorace is a full-stack English-learning product: a React web app, an Expo mobile
client, an Express/TypeScript API and a MariaDB database. It combines a lesson
roadmap, video listening practice, a vocabulary arena, a cosmetic shop, streaks
and an admin content console.

## Stack

| Layer | Technology |
|---|---|
| Web | React 19, TypeScript, Vite, Tailwind 4, Phosphor icons |
| Mobile | Expo / React Native |
| API | Node.js, Express 5, TypeScript, Socket.IO |
| Database | MariaDB / MySQL (`mysql2`) |
| Auth | bcrypt passwords, JWT, Google/Facebook provider identities |

## Repository layout

```
backend/        Express API, modules, migrations and Node test suites
web/            React web application and admin console
mobile/         Expo mobile application
docs/           Specs, UML, audit notes (local documentation)
ARCHITECTURE.md Folder structure and business flows
REFACTOR-AUDIT.md Audit findings, fixes and verification evidence
CODE_STANDARDS.md Naming, layering, UI and testing rules
```

## Local setup

1. **Database**: import the reproducible snapshot.
   ```bash
   mysql -u root -p < backend/database/final.sql
   ```
2. **Backend env**: copy/complete `backend/.env` with at least:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=root
   DB_NAME=english_learning
   JWT_SECRET=<at least 32 characters>
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```
3. **Install & run**:
   ```bash
   cd backend && npm install && npm run dev
   cd web && npm install && npm run dev
   ```

Incremental migrations live in `backend/database/migrations/` and are applied with:
```bash
cd backend
npx tsx scripts/apply-migration.ts database/migrations/2026-11-19-content-social.sql
```

## Demo dataset

The local database includes a complete visual demo (27 users, leaderboard,
5 shared videos with captions, progress, matches, chats, inventory and badges).
Recreate or refresh it with:
```bash
cd backend
npm run seed:demo
```
Demo accounts and exact contents are documented in `DEMO_DATA.md`.

## Quality commands

```bash
# backend
cd backend
npm run typecheck
npm test          # Node test runner + tsx, 119 tests

# web
cd web
npm run lint
npm run typecheck
npm test          # 54 tests
npm run build
```

## Main flows

- **Auth/social**: web registration verifies a six-digit code sent over SMTP; password login, Google/Facebook identity login, explicit link/unlink in Profile. Existing e-mails are never silently linked, and an explicit link only accepts the provider account that uses the same e-mail.
- **Learning**: stages → lessons → questions, only a perfect score unlocks the next lesson.
- **Video**: shared library, caption segmentation, vocabulary panel and saved-word notebook.
- **Arena**: DB-backed battle vocabulary, real-time Socket.IO rounds.
- **Shop**: DB-backed catalogue, transactional purchases, boosters, cosmetics with `style_json`.
- **Streak**: daily chain, one shield charge per missed day (Duolingo-style), and explicit loss notice after a break.
- **Admin**: content tree, shared videos + vocabulary, shop, arena vocabulary, user progression (XP/RC/streak/RP/role; passwords and e-mails are protected).

## Voice dictation

The web orb speaks through the browser's Web Speech API when that service is
reachable. Some networks (and Chromium builds) answer every recognition with a
`network` error; the orb then falls back to recording a clip and posting it to
`POST /api/speech/transcribe`, which transcribes with Workers AI Whisper and,
if that fails, Gemini audio input.

The fallback is automatic: the web calls `GET /api/speech/status` at startup and
uses the backend engine when it reports `backend: true`. No extra config is
needed beyond the existing `CF_API_KEYS` / `AI_API_KEY` in `backend/.env`.
Optional tuning:

```env
SPEECH_WHISPER_MODEL=@cf/openai/whisper-large-v3-turbo
SPEECH_TIMEOUT_MS=25000
SPEECH_MAX_BYTES=4194304
```

`backend/test/speech.test.ts` mocks both providers, and
`backend/test/speech.integration.test.ts` posts a real MP3 fixture to the
running API (it skips itself when no backend session is available).

## Email OTP for web registration

The web registration modal is two steps: submit name/e-mail/password, then enter
the six-digit code mailed to that address. No `users` row is written until the
code is verified.

Add an SMTP account to `backend/.env` (never commit it):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
# Gmail requires 2-Step Verification + an App Password, not the account password.
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=Engorace <your-account@gmail.com>
OTP_EXPIRY_MINUTES=10
OTP_RESEND_SECONDS=60
OTP_MAX_ATTEMPTS=6
# true outside production by default: logs the code and shows it in the modal.
OTP_DEBUG=false
```

Any SMTP provider works (Gmail, Brevo, Resend SMTP bridge, MailHog locally).
Gmail needs all three of `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`; a host with
empty credentials is treated as unconfigured so the dev fallback still works.
For local development without SMTP, leave `SMTP_HOST` empty and `OTP_DEBUG=true`:
the backend logs the code and the second step displays it for testing.

Apply the pending-registration table before running the new flow:

```bash
cd backend
npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-registration-otp.sql
```

## Social login configuration

Live provider login needs operator credentials (only you can supply them):

```env
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=   # recommended: validates app-bound Facebook tokens
```

Until configured, provider endpoints correctly return `503 not configured`.
The full provider architecture is covered by mocked-token integration tests.

See `ARCHITECTURE.md` for module boundaries and `REFACTOR-AUDIT.md` for the
audit/refactoring record.
