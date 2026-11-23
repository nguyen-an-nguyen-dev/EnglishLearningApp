# Engorace architecture

Engorace delivers online English lessons, listening and vocabulary practice,
and learning progress tracking. En Buddy adds AI-assisted explanations and
study suggestions within the application. The lesson roadmap and grading
rules are part of the core learning module.

## Stack

- **Backend**: Node.js + TypeScript + Express 5 + MariaDB (`mysql2`) + Socket.IO.
- **Web**: React 19 + TypeScript + Vite + Tailwind 4, CSS variables/design tokens.
- **Mobile**: Expo/React Native (auth, lessons, battle, video).
- **Data**: `backend/database/init.sql` creates the schema and `backend/database/seeds.sql` loads the reference/content/activity snapshot.

## Folder structure

```
backend/
  src/
    config/        env + runtime configuration validation
    db/            connection pool
    middleware/    auth, role guard, errors, rate limits, security headers, request logging
    modules/       feature modules (auth, admin, learning, video, battle, gamification, ...)
      <module>/    routes -> controller -> service -> repository -> types/validation
    routes/        platform routes (health)
    utils/         logger, database error helpers, Cloudflare rotation
  test/            Node test runner integration/unit suites
  scripts/         maintenance and database verification scripts
web/
  src/
    admin/         admin shell, navigation, stats, login
    components/    feature UI, admin panels, cosmetics, auth, video, shop
    context/       Auth, Language, Learning, Wallet providers
    services/      API client, auth storage, feature API wrappers
    types/         API domain types
    utils/         validation, formatting, playback, social SDK loader
mobile/            Expo client; consumes the same JSON API
docs/              specs, UML, audits (local documentation)
```

## Layering rules

1. **Routes** only wire middleware and controllers.
2. **Controllers** translate HTTP to service calls and envelopes.
3. **Services** own business rules, transactions orchestration and permission decisions.
4. **Repositories** own SQL; no HTTP or UI concerns. All user input is bound.
5. **Types/validation** are colocated with each module; shared cross-cutting helpers live in `utils/`.
6. **Web API services** normally share `services/apiClient.ts` for JSON requests. Speech audio and Arena sockets have dedicated clients.

## Web entry points

`web/src/main.tsx` mounts the language, auth, learning and wallet providers.
`App.tsx` renders the public landing page or the learner shell and loads the
admin console for `/admin` or its hash route. In development Vite proxies
`/api`, `/media` and `/socket.io` to Express. `backend/src/app.ts` mounts the
HTTP routers, and `server.ts` attaches the Arena Socket.IO server to the HTTP
server.

## Core business flows

### Authentication & social identity
- Password: register → bcrypt(12) → login → HS256 JWT (`sub=user id`).
- Social: provider token verified → identity lookup in `user_providers` → login or create.
- Existing e-mail **never** auto-links; account owner must log in and link from Profile.
- Unlink runs in a transaction and refuses to remove the last sign-in method.
- `users.password_set` distinguishes social-only accounts, enabling “set first password”.

### Lesson roadmap and practice

`LearningContext` loads `GET /api/progress` through `learningService.ts`.
`roadmap.ts` maps the API states to the learner map, and `RouteMapCard.tsx`
renders the stages and lesson checkpoints. The backend orders lessons by stage
order, lesson order and lesson ID. It assigns four states from the last lesson
completed at 100%:

| State | Meaning |
| --- | --- |
| `completed` | The learner already completed the lesson at 100%. |
| `unlocked` | The checkpoint immediately after the furthest completed lesson, or the first checkpoint for a new learner. |
| `available` | An unfinished lesson before that checkpoint, such as a lesson added to an earlier stage. |
| `locked` | A lesson beyond the next checkpoint. |

`LessonPlayer.tsx` fetches the questions and calls the
`POST /api/lessons/:lessonId/questions/:questionId/check` endpoint to grade each answer. The
backend records the attempt and tries to add misses to the persistent review
queue. The web run has three hearts. An incorrect answer spends a heart and
returns up to three positions later in the queue while hearts remain. After
the last heart is spent, the learner sees the feedback before the run ends.

When the normal run clears, the player sends the latest answer per question
to `POST /api/lessons/:lessonId/complete`. The server grades the submission
again and requires every question to be correct. The repository records a
successful completion and applies rewards in one transaction. The base lesson
reward is 20 XP, 15 RC and 10 RP on the first completion and 10 XP on each
successful replay. Stage rewards are handled separately. The result includes
`is_first_completion`. A short review from the result screen
practices the missed questions without submitting a lesson completion.

### Analytics, scheduled review and En Buddy

`ProfileView.tsx` uses `analyticsService.ts` to read learning analytics and the
review queue. `ReviewSession.tsx` submits review answers separately from lesson
completion. The backend can backfill review items from past mistakes and uses
answer correctness and response time to update the next review date.

`VoiceOrb.tsx` calls `/api/buddy/nudges`, `/api/buddy/ask` and the reminders API.
The backend builds study steps from stored progress, error counts and items
due for review. The model generates contextual explanations and chat replies,
and the coach can fall back to a response generated from stored data. A
proposed reminder is saved when the learner confirms it. The roadmap and
coach currently select the next lesson independently. See the
[AI module notes](backend/src/modules/ai/README.md) for the difference.

### Video, translation and Arena

- The video UI uses `/api/videos` for the shared library, personal YouTube imports and playback progress. The backend stores caption segments, using rule-based segmentation when the model fails. Saved words appear in the learner's notebook.
- `TranslateView.tsx` uses `/api/translate` and `/api/translate/file` for English–Vietnamese translation. `/api/translations` serves the learner's history and supports clearing it.
- The Arena UI connects through `battleService.ts`. The Socket.IO server authenticates the connection, matches learners and runs the rounds. The backend saves match results and serves summaries through `/api/battle/summary`.

### Streak
- `streak` advances only once per day; yesterday → +1.
- Missing two or more days is detected lazily on `/auth/me`, `/wallet` and login.
- A held `streak_shield` consumes one charge and bridges one missed day.
- Without a shield the streak becomes 0 and `streak_lost` / `streak_lost_at` keep the loss notice.

### Shop & economy
- Catalogue is DB-driven (`shop_items`), including booster kind/charges/duration.
- Purchases are transactional, idempotent ledger-backed (`economy_ledger`).
- Cosmetics render from `style_json`, so admin-created cars/frames/nameplates need no CSS registry entry.

### Admin
- Content tree and ordering, shared videos and video vocabulary, shop catalogue, Arena vocabulary, user progression and statistics dashboards.
- User management exposes XP, RC, streak, RP and role only. Passwords/emails/names are rejected with `PROTECTED_FIELD`.
- All admin routes require a live DB role check (`admin`), not just a JWT claim.

## Centralized modules added/used

- `backend/src/utils/db-errors.ts` — duplicate/foreign-key detection.
- `backend/src/utils/logger.ts` — structured JSON logging.
- `backend/src/utils/validation.ts` — shared request-field validation primitives.
- `backend/src/middleware/security-headers.ts` — baseline browser hardening.
- `backend/src/middleware/request-id.ts` + `request-logger.ts` — traceable request ids and latency logs.
- `backend/src/config/runtime.ts` — fail-fast deployment configuration.
- `backend/src/modules/admin/admin.activity.ts` — one definition of learner activity / last-seen SQL.
- `web/src/services/authStorage.ts` — session persistence split from HTTP/auth logic.
- `web/src/services/endpoints.ts` — auth endpoint builders (pattern for feature endpoints).
- `web/src/services/apiClient.ts` — single request/envelope/401 policy.
- `web/src/components/ErrorBoundary.tsx` — render-failure recovery.
- `web/src/components/admin/AdminAsyncState.tsx` — shared admin loading/error/empty switch.
- `web/src/utils/socialSdk.ts` — single SDK loader.

## Quality gates

- `backend`: `npm run typecheck`, `npm test`.
- `web`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Tests include API integration, auth/security, admin permissions, streaks, shop
  transactions and a cross-module E2E journey.

## Known refactoring backlog

- Some older modules still have repetitive manual controller `try/catch`; a shared async route wrapper would reduce noise.
- A few historical admin list endpoints duplicate activity SQL; extract a shared activity subquery.
- Mobile UI does not yet show social sign-in actions (API is ready).
- End-to-end browser tests are not committed as a runner; the current suites are unit/integration plus manual browser verification.
