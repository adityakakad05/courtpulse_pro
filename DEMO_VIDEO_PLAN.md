# CourtPulse Demo Video Plan (3–5 minutes)

Aim for approximately 4 minutes. Record the actual application and terminal/browser only as needed. Do not show `.env`, database passwords, or private credentials.

## Suggested timeline

**0:00–0:25 — Introduction**
- State the problem: provide a live badminton scoreboard with server-validated scoring and persistent match state.
- Briefly name the stack: React/Vite, Express/TypeScript, Prisma, Neon PostgreSQL.

**0:25–0:55 — Dashboard**
- Show the dashboard, player list, tournaments, and available matches.
- Explain that the frontend communicates with the REST API.

**0:55–1:45 — Live scoring**
- Open a match.
- Award a point and show the score update.
- Demonstrate the event timeline if visible.
- Explain that scoring is validated on the server.

**1:45–2:20 — Polling and persistence**
- If a second browser window is available, show the scoreboard refreshing through polling.
- Refresh the page and demonstrate that the persisted score remains.
- Do not claim a polling interval unless you've verified it in the code.

**2:20–2:55 — Match lifecycle**
- Demonstrate start, pause, and resume if these work reliably.
- Show completion/winner only if you can reach a valid finished state during the demo.
- Demonstrate undo only if the feature is implemented and tested.

**2:55–3:30 — Engineering verification**
- Show `npm test` passing.
- Show `npx prisma migrate status` reporting the database schema is up to date.
- Show the frontend build succeeding only after it actually succeeds.

**3:30–4:00 — Architecture and close**
- Show the architecture diagram or explain browser polling → REST API → scoring service → Prisma → PostgreSQL.
- Briefly state one trade-off: polling is simpler than a persistent socket connection but causes periodic HTTP requests.

## Recording checklist

- [ ] Video is between 3 and 5 minutes.
- [ ] Browser text is readable and the dashboard is loaded before recording.
- [ ] No `.env` or secret credentials appear.
- [ ] Every feature shown works live.
- [ ] No unverified claims are spoken.
- [ ] Audio is clear.
- [ ] Export and play back the final video to verify it.
