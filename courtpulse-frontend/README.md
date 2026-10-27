# CourtPulse Frontend

A responsive React + TypeScript + Vite frontend for the CourtPulse badminton tournament backend.

## Run it

1. Extract this folder inside your existing project, so the structure is:

   ```
   courtpulse/
     src/                 # your existing Express backend
     frontend/            # this React frontend
       package.json
       src/
   ```

2. Open a terminal in `courtpulse/frontend` and run:

   ```bash
   npm install
   npm run dev
   ```

3. Keep your backend running in another terminal on `http://localhost:3000`.
4. Open `http://localhost:5173`.

## Backend API expected

- `GET /api/health`
- `GET, POST /api/players`
- `GET, POST /api/tournaments`
- `GET, POST /api/matches`
- `GET /api/matches/:id/events`
- `POST /api/matches/:id/start`
- `POST /api/matches/:id/points` body: `{ "winnerSide": 0, "expectedVersion": 1 }`
- `POST /api/matches/:id/pause`
- `POST /api/matches/:id/resume`

The UI expects list endpoints to return either an array or `{ "data": [...] }`, and single-item responses to return `{ "data": ... }` or the item itself. Match start/point/pause/resume requests use the optimistic `expectedVersion` field from the current match record.

## Configure a deployed backend

Create `frontend/.env` with:

```env
VITE_API_URL=https://your-backend-domain.example
```

Restart the Vite dev server after changing environment variables.

## Notes

- The frontend intentionally handles backend/network errors with a visible toast.
- If the player/tournament route payloads or create fields differ from the expected contract, adjust `src/api.ts` or `CreateModal` in `src/App.tsx` to match the existing route schemas.
- This is a UI layer; it does not replace the Express backend or database migrations.
