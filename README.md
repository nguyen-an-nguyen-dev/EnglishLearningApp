# Engorace — English Learning Platform

Engorace is an online English-learning application for web and mobile.
Learners progress through structured lessons, practice listening with videos,
and build vocabulary through exercises and real-time word matches. The app
integrates En Buddy, an AI assistant that can answer questions, explain
exercises and suggest what to practice next. The web app also includes weekly
rankings, a cosmetic shop and an admin console.

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
backend/        Express API, modules and Node test suites
web/            React web application and admin console
mobile/         Expo mobile application
docs/           Specs, UML, audit notes (local documentation)
ARCHITECTURE.md Folder structure and business flows
```

## Local setup

1. **Database**: create the schema, then load the data. `init.sql` contains the
   current schema; `seeds.sql` contains data only.
   ```bash
   mysql -u root -p < backend/database/init.sql
   mysql -u root -p english_learning < backend/database/seeds.sql
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
   # Optional; fill these values from the Cloudinary Console
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   ```
3. **Install & run**:
   ```bash
   cd backend && npm install && npm run dev
   cd web && npm install && npm run dev
   ```

Vite proxies `/api`, `/media` and `/socket.io` to `http://localhost:3000`.
Open `/admin` for the admin console.

The backend prefers Cloudinary for avatar uploads when configured and can fall
back to local storage under `/media/avatars`. For an existing database missing
the avatar columns, apply `backend/database/migrations/2026-11-22-user-avatars.sql`
after backing it up. Fresh databases get those columns from `init.sql`.

## Demo dataset

The seed includes the captured reference/content/activity dataset. Add or refresh
the 60 deterministic league demo learners with:
```bash
cd backend
npm run seed:demo
```
The script requires an active season and upserts `demo_*` learner accounts and
their active-season standings. See [the seed script](backend/scripts/seed-demo.mjs)
for the generated accounts.

To verify the current split files against a fresh scratch database (the script
drops `english_learning_verify` when it finishes):

```bash
cd backend
npm run db:verify
```

`backend/database/seeds.sql` is a point-in-time data snapshot: a live database may
contain newer activity. The incremental migration files remain available for
upgrades.

## Quality commands

```bash
# backend
cd backend
npm run typecheck
npm test          # Node test runner + tsx

# web
cd web
npm run lint
npm run typecheck
npm test
npm run build
```

## Main flows

- **Auth/social**: web registration verifies a six-digit code sent over SMTP; password login, Google/Facebook identity login, explicit link/unlink in Profile. Existing e-mails are never silently linked, and an explicit link only accepts the provider account that uses the same e-mail.
- **Learning**: the backend derives lesson access from the furthest lesson completed at 100%. An unfinished lesson inserted earlier in the roadmap remains available for catch-up. The web lesson player starts each run with three hearts, checks answers through the API, and brings missed questions back later in the run. A completed replay earns base XP only.
- **Review**: wrong answers can enter a persistent review queue. The profile shows learning analytics and opens review sessions. The lesson result also offers immediate practice of missed questions within that lesson.
- **En Buddy**: a rule-based plan uses progress, mistakes and items due for review. The web assistant can explain a next step, open a supported destination and offer a reminder for the learner to confirm.
- **Video**: shared library and personal YouTube imports, caption segmentation, playback progress, vocabulary panel and saved-word notebook.
- **Translation**: English–Vietnamese text and file translation with a saved history.
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

Fresh installs already include pending registrations in `init.sql`. An older
database needs the `pending_registrations` table added manually before OTP
registration works.

## Social login configuration

Live provider login needs operator credentials (only you can supply them):

```env
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=   # recommended: validates app-bound Facebook tokens
```

Until configured, provider endpoints correctly return `503 not configured`.
The full provider architecture is covered by mocked-token integration tests.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the web-to-backend flows and
[the AI module documentation](backend/src/modules/ai/README.md) for En Buddy.
