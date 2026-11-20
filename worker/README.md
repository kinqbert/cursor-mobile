# Push worker

This is the Cloudflare Worker that sends instant notifications for your Cursor agents.

Cron runs every minute and does three things:

1. Lists your agents and diffs them against the last tick. Any agent that stopped working triggers a notification. This is the fallback path.
2. Updates the silent "N Active" summary notification when the set of running agents changes. It replaces itself in place.
3. Opens each running agent's live stream for about 55 s. Notifications go out the moment a run finishes or fails.

Notifications are deduplicated per run, so a run never alerts twice.

## Deploy (one time)

```sh
cd worker
npm install
npx wrangler login                      # opens the browser
npx wrangler secret put CURSOR_API_KEY  # paste your Cursor API key
npx wrangler secret put APP_SECRET      # paste a long random string (e.g. `openssl rand -hex 24`)
npx wrangler secret put GITHUB_TOKEN    # optional: adds "+80 −230 · 3 files" to alerts
npm run deploy                          # prints https://cursor-mobile-push.<you>.workers.dev
```

Then in the app: **Settings → Notifications**. Paste the worker URL and the same APP_SECRET, tap **Enable notifications**, then **Send test notification**.

## Operate

- `npm run logs` streams live logs (cron runs, push results).
- `GET /health` with header `Authorization: Bearer <APP_SECRET>` returns the number of registered devices.

**Free-plan limits:** 10 ms of CPU per run, and KV allows 1,000 writes/day. The worker only scans stream lines for status changes and only writes to KV when something changes, so it should fit.

If logs show `exceededCpu`, the "≤60 s" cron fallback still delivers every notification. The Workers Paid plan ($5/mo) removes the limit.
