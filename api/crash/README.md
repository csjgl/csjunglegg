# Crash Game API Endpoints

All crash game endpoints are now in this folder:

- `POST /api/crash/create-game` — Create a new crash game (admin/server only)
- `POST /api/crash/bet` — Place a bet on a crash game
- `POST /api/crash/cashout` — Cash out a bet
- `GET /api/crash/status` — Get the current crash game and all bets
- `GET /api/crash/history` — Get recent crash games (history)

All endpoints use Supabase and expect the following environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

You can now build your frontend to interact with these endpoints.
