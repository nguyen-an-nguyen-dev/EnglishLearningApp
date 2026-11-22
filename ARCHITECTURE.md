# Engorace — Architecture & Refactoring Guide

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
6. **Web services** are the only place that calls `fetch`; components never build API URLs.

## Core business flows

### Authentication & social identity
- Password: register → bcrypt(12) → login → HS256 JWT (`sub=user id`).
- Social: provider token verified → identity lookup in `user_providers` → login or create.
- Existing e-mail **never** auto-links; account owner must log in and link from Profile.
- Unlink runs in a transaction and refuses to remove the last sign-in method.
- `users.password_set` distinguishes social-only accounts, enabling “set first password”.

### Learning / video
- Lesson completion is scored; only 100% unlocks the next lesson.
- Video import extracts YouTube captions, segments them (AI with rule fallback), stores segments and optional vocabulary.
- Vocabulary seeds/admin rows power the in-lesson word panel, saved-word lookup and the public landing demo.

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
- Content tree, videos + video vocabulary, shop catalogue, arena vocabulary, user progression.
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

- `backend`: `npm run typecheck`, `npm test` (119 tests).
- `web`: `npm run lint`, `npm run typecheck`, `npm test` (54 tests), `npm run build`.
- CI workflow: `.github/workflows/ci.yml` (MariaDB service + both apps).
- Tests include API integration, auth/security, admin permissions, streaks, shop
  transactions and a cross-module E2E journey.

## Known refactoring backlog

- Some older modules still have repetitive manual controller `try/catch`; a shared async route wrapper would reduce noise.
- A few historical admin list endpoints duplicate activity SQL; extract a shared activity subquery.
- Mobile UI does not yet show social sign-in actions (API is ready).
- End-to-end browser tests are not committed as a runner; the current suites are unit/integration plus manual browser verification.
