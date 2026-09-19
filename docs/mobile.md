# Mobile app architecture

`frontend/app` (`@hisaab/app`) is the Hisaab React Native client. It is an Expo SDK 54 app that shares `@hisaab/types` and `@hisaab/validation` with the Next.js web client.

The first pass is **UI-first**: screens, navigation, and tokens match `frontend/app/appDesign` and `frontend/app/Hisaab-React-Native-UI`. Demo data lives in `src/data/fixtures.ts`. Auth currently toggles a local session so the product can be walked through in Expo Go.

## Why this shape

The shared UI kit was one `App.tsx`. That is useful as a visual source, not as a codebase. The native app now follows the same layering as `frontend/web`:

```
screens  →  components  →  services/api-client  →  Hisaab gateway
                ↓
           theme + config
```

Finance tool IDs (`ipo`, `loans`, `cards`, …) match web routes so a later API wiring pass can reuse the same domain services.

## Navigation

```
RootNavigator
├── AuthNavigator          (when signed out)
│   Welcome → Login / Register
│   Login → ForgotPassword → Otp → ResetPassword → ResetSuccess
└── AppNavigator           (when signed in)
    ├── Tabs
    │   Home | Finance | Add | Transactions | Profile
    └── Stack
        Feature | Settings | Subscription
```

The tab bar matches the mockups: five items, raised center **Add**. Feature, Settings, and Subscription hide the tab bar by living on the parent stack.

## Theme

Tokens in `src/theme/tokens.ts` come from the UI kit:

- background `#021612`
- panels `#07251E` / `#0A3026`
- accent `#55E7A0`
- gold `#F5D98B` for Premium / PRO

Auth screens stay on this dark system (same as forgot-password / OTP mockups). The light login mock is an alternate marketing frame, not a second theme yet.

## Data and API

| Layer        | Today                                                | Next                                              |
| ------------ | ---------------------------------------------------- | ------------------------------------------------- |
| Session      | `SessionProvider` boolean                            | Better Auth + `expo-secure-store`                 |
| HTTP         | `src/services/api-client.ts` (`EXPO_PUBLIC_API_URL`) | Same envelope as web (`ApiResponse<T>`)           |
| Auth calls   | `auth.service.ts` stubs                              | Gateway `/api/auth/*`                             |
| Domain lists | `src/data/fixtures.ts`                               | Same service files as `frontend/web/src/services` |

React Native cannot use cookie `credentials: "include"` the way the browser does. Production sign-in should store a session token in SecureStore and send `Authorization` (or a dedicated mobile session endpoint) instead of copying the web cookie flow.

Default API origin is the live gateway: `https://hisaab-gateway.blobforges.workers.dev`. Override with `EXPO_PUBLIC_API_URL` for local work. Android emulator localhost is `http://10.0.2.2:8787`.

## Run and check

```bash
pnpm --filter @hisaab/app typecheck
pnpm --filter @hisaab/app start
```

Do not import from `Hisaab-React-Native-UI/`. That folder stays as a visual reference only.
