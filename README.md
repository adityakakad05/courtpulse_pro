# CourtPulse — Live Badminton Scoring

CourtPulse is a full-stack badminton scoring application with a React/Vite client, an Express/TypeScript API, Prisma ORM, and Neon PostgreSQL. It is designed to manage players, tournaments, matches, and a live scoreboard that refreshes by polling the REST API.

> **Verification note:** Update this section after running the final checks on your machine. Backend tests were previously reported as 15 passing. The frontend production build previously reported TypeScript errors; do not claim that the production build passes until it has been rerun successfully.

## Features

- Player and tournament management through REST endpoints.
- Match creation and match lifecycle operations.
- Server-side badminton scoring logic and validation.
- Persistent match state and scoring-event history.
- Live scoreboard updates using client-side polling (not WebSockets/SSE).
- Match version field for tracking state changes.
- Automated backend tests with Vitest and Supertest.

Only describe undo/replay or any other feature as complete if you verify its endpoint and behavior in the current code.

## Technology stack

- **Frontend:** React 18, TypeScript, Vite, Lucide React
- **Backend:** Node.js, Express 5, TypeScript
- **Database:** Neon PostgreSQL
- **ORM:** Prisma 7
- **Validation:** Zod
- **Tests:** Vitest, Supertest

## Project structure

```text
courtpulse/
├── courtpulse-frontend/       # React/Vite client
├── prisma/
│   ├── migrations/            # Committed database migration SQL
│   └── schema.prisma
├── prisma7.config.ts
├── src/
│   ├── routes/                # REST API routes
│   ├── services/scoring.ts    # Badminton scoring rules
│   ├── *.test.ts              # Backend tests
│   └── server.ts
├── package.json
└── .env.example
```

## Prerequisites

- Node.js compatible with the versions in the project lockfiles
- npm
- A Neon PostgreSQL database (or compatible PostgreSQL database)
- Git

## Setup

### 1. Clone and install backend dependencies

```bash
git clone <YOUR_REPOSITORY_URL>
cd courtpulse
npm ci
```

### 2. Configure environment variables

Create a local `.env` in the repository root based on `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

Replace the placeholder with your own Neon connection string. Never commit `.env` or share its credentials. The repository also has a `prisma/.env` in some local setups; keep any real credentials out of Git as well.

The Prisma configuration reads `DATABASE_URL` from the environment.

### 3. Generate Prisma Client and apply/check migrations

```bash
npx prisma generate
npx prisma migrate status
```

For a fresh development database, apply the committed migrations:

```bash
npx prisma migrate deploy
```

For local schema development only, `npx prisma migrate dev` may be used when appropriate. Do not run destructive database commands against a production database.

### 4. Start the backend

```bash
npm run dev
```

The API is expected to listen on port `3000` unless your local configuration overrides it.

Check health:

```bash
curl http://localhost:3000/api/health
```

Expected response shape:

```json
{
  "status": "ok",
  "application": "CourtPulse",
  "message": "CourtPulse API is running"
}
```

### 5. Install and start the frontend

Open a second terminal at the repository root:

```bash
npm --prefix courtpulse-frontend ci
npm --prefix courtpulse-frontend run dev
```

Open the Vite URL printed by the command, commonly `http://localhost:5173`. The Vite configuration proxies `/api` requests to the backend.

### 6. Production frontend build

```bash
npm --prefix courtpulse-frontend run build
```

A successful build must finish without TypeScript or Vite errors. Record the actual result in your submission notes.

## Tests

Run backend tests:

```bash
npm test
```

Previously reported baseline: **15 tests passed across 3 files**. Re-run before submission and update this statement if the result changes.

The frontend package currently defines `dev`, `build`, and `preview` scripts; it does not define a dedicated frontend test script.

## API reference

The route names below reflect the currently identified route structure. Confirm request and response schemas from the route source before publishing this README as a final API contract.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health check |
| GET | `/api/players` | List players |
| POST | `/api/players` | Create a player |
| GET | `/api/tournaments` | List tournaments |
| POST | `/api/tournaments` | Create a tournament |
| GET | `/api/participants` | List or manage tournament participants (confirm exact route behavior) |
| GET | `/api/matches` | List matches |
| POST | `/api/matches` | Create a match |
| GET | `/api/matches/:id/events` | Read a match's scoring-event history |
| POST | `/api/matches/:id/start` | Start a match |
| POST | `/api/matches/:id/points` | Award a point |
| POST | `/api/matches/:id/pause` | Pause a match |
| POST | `/api/matches/:id/resume` | Resume a match |

Check `src/routes/` for exact methods, validation schemas, request bodies, status codes, and error response shapes. Do not claim an undo endpoint unless it is implemented and tested.

## Scoring and consistency

The scoring service is responsible for validating scoring transitions and deriving the resulting match state. Scoring events include sequence numbers and before/after snapshots in the database schema. The match `version` field can be used to identify state changes and reject stale updates if the route implementation enforces that behavior.

## Polling behavior

The client periodically requests updated match data while a match is in a live or paused state. This is simple to deploy and works through standard HTTP infrastructure, at the cost of repeated requests and update latency determined by the polling interval.

Verify the actual polling interval and status conditions in `courtpulse-frontend/src/App.tsx` before documenting a precise interval.

## Database and migrations

The Prisma schema is in `prisma/schema.prisma`. The initial migration is committed under `prisma/migrations/`. A seed script was not found during the last repository inspection, so do not document a seed command unless you add and verify one.

## Known limitations / final verification

Before submitting, verify and update this list:

- [ ] `npm test` passes on the final commit.
- [ ] `npx prisma generate` succeeds.
- [ ] `npx prisma migrate status` reports the database is up to date.
- [ ] `npm --prefix courtpulse-frontend run build` succeeds.
- [ ] Live polling updates the score without a page reload.
- [ ] Scores persist after a browser refresh.
- [ ] Invalid scoring actions are rejected.
- [ ] Match lifecycle and event history work as documented.
- [ ] Any claimed undo/replay feature has a verified endpoint and test.
- [ ] `.env` and `prisma/.env` are not tracked.
- [ ] Demo video is 3–5 minutes long.

## Design trade-offs

- **Polling instead of WebSockets/SSE:** simpler to reason about and deploy, but creates periodic requests and can delay updates until the next poll.
- **PostgreSQL persistence:** match state survives server restarts and browser refreshes.
- **Scoring service separated from routes:** centralizes rules and makes them easier to test.
- **Event snapshots:** provide a useful audit history, while increasing stored data and requiring consistent event sequencing.

## License

Add the license required by your project or assignment before public release.
