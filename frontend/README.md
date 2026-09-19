# Frontend

Hisaab frontend is split into two clients:

| Directory | Package       | Status                  |
| --------- | ------------- | ----------------------- |
| `web/`    | `@hisaab/web` | Current Next.js web app |
| `app/`    | `@hisaab/app` | Expo / React Native app |

The Next.js App Router lives in `web/src/app/`. Do not put Next routes in `frontend/app`. Native screens live in `app/src/screens/`. See [docs/mobile.md](../docs/mobile.md).
