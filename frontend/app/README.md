# @hisaab/app

Expo / React Native client for Hisaab. It sits next to `@hisaab/web` under `frontend/`.

## Run

```bash
pnpm --filter @hisaab/app start
```

Then scan the QR code with Expo Go, or press `a` / `i` for Android / iOS simulators.

## Layout

| Path                          | Role                                          |
| ----------------------------- | --------------------------------------------- |
| `src/theme`                   | Dark premium tokens from the UI kit           |
| `src/navigation`              | Auth stack + tab shell + nested feature stack |
| `src/screens`                 | One screen per flow                           |
| `src/components`              | Shared UI and finance widgets                 |
| `src/services`                | Gateway client stubs (same paths as web)      |
| `src/data`                    | Local demo data until APIs are wired          |
| `src/config/finance-tools.ts` | Tool catalog aligned with `frontend/web` nav  |
| `appDesign/`                  | Pixel mockups                                 |
| `Hisaab-React-Native-UI/`     | Original single-file UI kit (reference only)  |

See [docs/mobile.md](../../docs/mobile.md) for architecture and the API wiring plan.
