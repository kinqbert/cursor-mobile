# Cursor Mobile for Android — Build Plan

Personal Android client for Cursor Cloud Agents. It copies the UX of Cursor for iOS (public beta, June 2026)
and is built on the public Cloud Agents API. It is for personal use only and is sideloaded, not published.

## 1. What the iOS app does (from App Store screenshots + launch blog)

| Area | iOS behaviour | Notes for us |
|---|---|---|
| Home — "All Workspaces" | Grouped list: **Pinned**, **Today**, then per-repo sections. Row = title + meta line `repo · ✓ Passed · +8 -23` / `Working` / `No Changes` / `Merged`. Leading dot: blue = unread/new, grey = seen, animated sparkle = working. Floating round buttons top: back, search, filter. | Pins + unread state are local (MMKV). |
| Composer | Floating pill at bottom: `+`, "Plan, ask, build…", mic. Expands to a sheet: `repo  branch ⌄` header, multiline prompt, `+` (attach), model picker (`Composer 2.5 ⌄`), voice recording with timer + waveform. | Voice = Android on-device speech recognition. |
| Agent conversation | User message in a right-aligned grey bubble. Agent output below: status line (`Finished 5m`), markdown sections (e.g. **Walkthrough**), inline video/screenshot artifacts with play button. Top: back, `…` menu. | Live via SSE stream. |
| PR view | Title, `Open` pill, `+2 -2 · 1 File │ 1 Commit`. Card: **Ready to Merge** / **Waiting for Checks** (ring `5/7 Checks Passing, 1 Running`), reviewers, black **Squash & Merge** button. **Deployments** list (preview links, age, ↗). **Demos** horizontal carousel. **N Files** list with per-file `+/-`, expandable diff. Top: back, history/link, `…`. | Needs GitHub API (PAT). |
| Notifications | Push when an agent **finishes**, **needs input**, or is ready for review. Rich card: `Finished` / title / `+80 -230 · 3 Files` / **Review** button. Live Activity: `5 Active` with per-agent elapsed times. | Android: rich notification with action button + ongoing "N active" notification. |
| Other | Remote control of agents running on your Mac, local↔cloud handoff, annotate screenshots, slash commands. | Later or not possible, see §6. |

Visual language: warm off-white background (~`#F7F7F4`), near-black text, grey secondary text, hairline dividers
inset from the left, frosted round icon buttons, black pill primary buttons, green/red for diff counts, a soft green
"Open" pill. System font, medium weight titles, lots of whitespace. Dark mode equivalent.

## 2. Stack

- **App:** Expo (React Native) + TypeScript, Expo Router (file-based nav), dev build via EAS (cloud builds, no Android Studio).
- **Data:** TanStack Query (cache, pull-to-refresh, polling), `expo/fetch` for SSE streaming, MMKV for local state (pins, read markers, drafts).
- **Secrets:** `expo-secure-store` (Cursor API key, GitHub token).
- **UI:** react-native-reanimated, gesture-handler, `@gorhom/bottom-sheet` (composer), `expo-blur` (frosted buttons),
  `expo-haptics`, `expo-image`, `expo-video` (demos), markdown renderer.
- **Voice:** `expo-speech-recognition` (Android on-device SpeechRecognizer).
- **Push:** `expo-notifications` + FCM (Firebase project), Expo Push service.
- **Backend:** one Cloudflare Worker + Durable Object + KV (free tier), deployed with `wrangler`.

## 3. Auth

1. Log into cursor.com with the **company email** → Dashboard → API Keys → create a **personal user key**.
   Agents run under the company seat, so they use team limits. (Verify on the usage page after the first run.)
2. First launch: paste the key. The app calls `GET /v1/me` to validate it and show the account email, then stores it in SecureStore.
3. Optional: GitHub fine-grained PAT (repo contents read, pull requests + checks read/write) for the PR screen and merging.
4. The Worker gets its own copy of the Cursor key as a Wrangler secret (needed for server-side watching, see §4).

There is no "Sign in with Cursor" OAuth for third-party apps; the app does not scrape web sessions.

## 4. Notifications architecture

The v1 API has **no webhooks yet** (only v0 has them, and they only fire on FINISHED/ERROR for agents created with a
webhook URL). Instead, the Worker watches agents itself. This covers **every** agent, including ones started from desktop, web or Slack:

```
Cron (every minute, holds ~55 s)
 ├─ GET /v0/agents → diff vs KV → agent stopped working? ─────────────┐   (fallback, ≤60 s)
 ├─ set of running agents changed? → silent "N Active" (tag-replaced) │
 └─ for each running agent: hold GET /v1/agents/{id}/stream ──────────┤   (instant)
                                                                      ▼
                     notifyRunEnded (dedupe per run id) → Expo Push → FCM → phone
```

- Durable Objects were dropped: a per-minute cron holding the streams for 55 s gives near-continuous coverage with less moving parts.
- `/webhook` (HMAC `X-Webhook-Signature`) is kept ready for when v1 gets webhooks. `/register`, `/unregister`, `/test`, `/health` are authenticated with `APP_SECRET`.
- Notification: title = agent name, body = `Finished · +80 −230 · 3 files` + first line of the result. Actions: **Review PR** / **Open agent**. Tap → deep link into the app.
- "Needs input": the API has no such status today.

## 5. API mapping (Cloud Agents API v1, `https://api.cursor.com`, Bearer key)

| Feature | Endpoint |
|---|---|
| Validate key / show account | `GET /v1/me` |
| Home list | `GET /v1/agents?limit=50&cursor=` (+ `GET /v1/agents/{id}` and its latest run for meta) |
| Repo picker / model picker | `GET /v1/repositories`, `GET /v1/models` |
| Launch agent | `POST /v1/agents` `{prompt{text,images}, model, repos[{url,startingRef}], mode: agent\|plan, autoCreatePR}` |
| Live output | `GET /v1/agents/{id}/stream` (SSE: `status`, `assistant`, `thinking`, `tool_call`, `heartbeat`) |
| History | `GET /v1/agents/{id}/runs` + `GET /v1/agents/{id}/runs/{runId}` (`result`, `git.branches[].prUrl`) |
| Follow-up / steer | `POST /v1/agents/{id}/runs` (`delivery: "steer"` while running) |
| Stop | `POST /v1/agents/{id}/runs/{runId}/cancel` |
| Archive / unarchive / delete | `POST …/archive`, `POST …/unarchive`, `DELETE /v1/agents/{id}` |
| Screenshots, videos, logs | `GET /v1/agents/{id}/artifacts`, `GET …/artifacts/download?path=` (15-min presigned URL) |
| PR status, checks, diff, merge, deployments | GitHub REST: pulls, check-runs, files, merge (`squash`), deployments |

Known gap: v1 has no full-transcript endpoint for old runs (streams have limited retention). Past runs show the
prompt and final `result`. Spike: check whether `GET /v0/agents/{id}/conversation` still works with the same key for full history.

## 6. Out of scope / later

- **Remote control of local Cursor desktop agents:** no public API. A possible later path is the `env.type: "machine"` self-hosted worker ("My Machines").
- Local↔cloud handoff: desktop-only feature.
- Screenshot annotation before sending (phase 8 nice-to-have).
- Slash commands: only if the API exposes them; otherwise templates/snippets stored locally.
- Home-screen widget with the active agents (phase 8).

## 7. Phases

Status (2026-11-21): phases 0–7 are implemented and pushed. Phase 0 still needs the account setup in README, and the app hasn't been tested on a device yet. Phase 8 is open.

**Phase 0: Environment (½ day)**
Install Node (Homebrew). Create Expo, Firebase and Cloudflare accounts. `create-expo-app`, first EAS dev build, install it on the phone, live reload working.

**Phase 1: Foundations**
Theme tokens (light/dark copied from iOS), typography, round frosted icon button, pill button, list row, section header.
API client with typed models, error handling, 401 → back to key screen. Onboarding: paste key → `/v1/me` → home.

**Phase 2: Home ("All Workspaces")**
Grouped list (Pinned / Today / per repo), status dots including the animated working indicator, meta line, search, filter
(repo, status, archived), pull to refresh, background polling while open, long-press → pin / archive, swipe actions.

**Phase 3: Composer & launch**
Floating composer pill → bottom sheet. Repo + branch picker, model picker, Agent/Plan toggle, image attach (camera/gallery,
≤5), voice dictation with timer + waveform, haptics. Launch, then navigate to the agent screen.

**Phase 4: Agent screen**
Transcript (user bubbles, markdown assistant output, collapsible thinking/tool-call rows), live SSE with resume via
`Last-Event-ID`, "Working…/Finished 5m" status line, follow-up composer (auto-steers while running), stop, `…` menu
(archive, open on web, copy link). Artifacts gallery: screenshots full-screen, video player.

**Phase 5: PR screen**
GitHub token in settings. Title, Open/Merged pill, +/− · files · commits, checks card (ring + counts), Squash & Merge with
confirmation, deployments list, demos carousel (artifacts), file list with expandable unified diff.

**Phase 6: Notifications**
Firebase + FCM credentials → EAS. Worker (cron + Durable Object watchers + KV + `/register` + `/webhook`), deploy with wrangler.
App: permission prompt, token registration, rich notification with a **Review** action, deep links, ongoing "N Active" notification.

**Phase 7: Polish**
Dark mode pass, animations (list insert, sheet springs, working sparkle), empty/error states, app icon, splash.
Release APK via EAS, installed over the dev build.

**Phase 8: Nice-to-haves**
Home-screen widget, screenshot annotation, prompt snippets, Projects support, self-hosted "My Machine" target.

## 8. Open items to confirm

- [ ] Personal API key can be created on the company account (Enterprise admins can block this).
- [ ] Usage from that key shows up under team usage.
- [ ] Company GitHub org allows fine-grained PATs (otherwise use a classic PAT or skip merge-from-phone).
- [ ] v0 `/conversation` still works (full history).
- [ ] Durable Object can hold SSE streams long enough (else cron-only).
