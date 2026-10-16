# AgroSense mobile

React Native + Expo (SDK 54) app for Android and iOS. Expo Router for navigation, React Query for server state, Zustand for the session.

## Run it

```bash
cd mobile
npm ci
cp .env.example .env        # optional: point at a local backend
npx expo start              # Expo Go works for everything except Google Sign-In
```

Google Sign-In needs a development build (`eas build --profile development`), because it uses a native module.

## Checks

```bash
npm run typecheck           # tsc --noEmit
npm run lint                # eslint, zero warnings
npx expo-doctor             # native dependency versions
```

## Builds

| Profile | Command | Output |
|---|---|---|
| development | `eas build -p android --profile development` | APK with dev client |
| preview | `eas build -p android --profile preview` | Installable APK for testers |
| production | `eas build -p android --profile production` / `-p ios` | Play Store AAB / App Store IPA |

Before the first iOS build, set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (EAS secret or `.env`) so Google Sign-In is configured. Without it, the Google button is hidden on iOS and phone sign-in is used.

## Structure

```
app/                 Screens (file-based routes)
  (auth)/            Sign in, create account
  (tabs)/            Home, Market, Scan, Weather, History + custom tab bar
  diagnosis/         Photo confirm + result/detail
  onboarding/        First-run slides, complete profile (after Google sign-up)
  settings/          Account, profile & farm, password
api/                 Axios client, React Query hooks, response types
components/ui/       Design-system primitives (Text, Button, fields, sheets, cards)
constants/theme.ts   Colour, type, spacing and elevation tokens
lib/                 Formatting, photo preparation, storage, query client
store/authStore.ts   Session: token, cached profile, sign-in/out
```

## Notes

- `expo-secure-store` is pinned to 14.x on purpose (an interop bug in 15.x at the time); it's excluded from `expo install --check`.
- Photos are resized to ≤1280px JPEG on the device before upload (handles iPhone HEIC and keeps uploads small on mobile data).
- The app is light-mode only by design — it's used outdoors in bright sun.
