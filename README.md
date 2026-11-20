# Cursor Mobile (Android)

A personal Android client for Cursor Cloud Agents. It copies the UX of Cursor for iOS. See [PLAN.md](PLAN.md) for the full plan.

- `mobile/` is the Expo (React Native + TypeScript) app
- `worker/` is the Cloudflare Worker for push notifications (phase 6)

## Run it on your phone (development)

1. Install **Expo Go** from the Play Store.
2. Start the dev server:
   ```sh
   cd mobile
   npm install
   npx expo start --tunnel   # --tunnel works even if the phone isn't on the same Wi‑Fi
   ```
3. Scan the QR code with Expo Go.
4. Paste your Cursor API key (cursor.com → Dashboard → API Keys).

Voice input and push notifications need the real app build, not Expo Go:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

## Checks

```sh
cd mobile
npm run typecheck
npm run lint
```
