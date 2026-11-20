# Cursor Mobile (Android)

A personal Android client for Cursor Cloud Agents. It copies the UX of Cursor for iOS. See [PLAN.md](PLAN.md) for the design and what's done.

- `mobile/`: Expo (React Native + TypeScript) app
- `worker/`: Cloudflare Worker that sends instant push notifications ([setup](worker/README.md))

## Quick try in Expo Go (no build needed)

Voice input and push notifications don't work in this mode. Everything else does.

```sh
cd mobile && npm install
npx expo start --tunnel     # scan the QR code with Expo Go (Play Store)
```

## Install the real app (one time, ~20 min)

1. **Expo account and project**
   ```sh
   cd mobile
   npx eas-cli@latest login
   npx eas-cli@latest init          # writes the EAS projectId into app.json
   ```
2. **Firebase, needed for Android push**
   - Go to console.firebase.google.com, create a project, then add an **Android app** with package `com.kinqbert.cursormobile`.
   - Download `google-services.json` and upload it to EAS as a secret file:
     ```sh
     npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment development --environment preview --environment production
     ```
   - In Firebase, go to Project settings → Service accounts → **Generate new private key**. Then run `npx eas-cli@latest credentials`, choose Android → development → Google Service Account → **FCM V1**, and upload that key.
3. **Build and install**
   ```sh
   npx eas-cli@latest build --profile development --platform android   # dev build with live reload
   # or, a standalone app that doesn't need your laptop:
   npx eas-cli@latest build --profile preview --platform android
   ```
   Open the link or QR code that EAS prints on your phone to install the APK.
   With the dev build, run `npx expo start` and the app connects to it.
4. **Notifications:** deploy the worker ([worker/README.md](worker/README.md)). Then in the app go to **Settings → Notifications**, paste the worker URL and APP_SECRET, and tap **Enable**.
5. **GitHub (optional):** in **Settings → GitHub**, paste a fine-grained token. This enables the PR screen, checks, diffs and Squash & Merge.

## Checks

```sh
cd mobile && npm run typecheck && npm run lint
cd worker && npm run typecheck
```
