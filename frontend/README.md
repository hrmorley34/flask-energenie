# Energenie Frontend

Next.js frontend for viewing Energenie device status and managing repeating and dated schedule events.

## Requirements

- Node.js 20+
- npm 10+
- Backend API available (default expected at `http://127.0.0.1:5001`)

Set `BACKEND_API_URL` in `.env` to override the backend target used by frontend API proxy routes.

Set `NEXT_PUBLIC_WRITABLE_OWNER_ID` in `.env` to choose which owner is allowed to create, edit, and delete events from this frontend build.

## Local Development

From `frontend/`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - Start development server
- `npm run lint` - Run ESLint checks
- `npm run build` - Build production bundle
- `npm run start` - Start production server

## Architecture

- `app/page.tsx`: View composition layer for dashboard sections
- `app/useSchedulePageState.ts`: State orchestration, polling, CRUD handlers, and derived selectors
- `app/schedule-api.ts`: Typed client wrappers for frontend API routes
- `app/api/*`: Next.js API proxy routes forwarding to backend API
- `app/components/*`: Presentational sections for header, status cards, timeline, and event tables
- `app/page-utils.ts`: Scheduling and timeline computation helpers

## Data Flow

1. Browser UI calls `schedule-api.ts` wrappers.
2. Wrappers call frontend `/api/*` routes.
3. Frontend routes proxy requests to backend API using `BACKEND_API_URL`.
4. Write routes are proxied as owner-scoped backend calls using `NEXT_PUBLIC_WRITABLE_OWNER_ID`.
5. UI state is updated through `useSchedulePageState` handlers.

## Notes

- Status polling is visibility-aware and uses bounded backoff for transient failures.
- CRUD actions keep drafts during failed saves to avoid losing user edits.
- Delete actions require confirmation.
