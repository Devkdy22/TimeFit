# External Data Boundaries

TimeFit keeps server-only provider credentials and mobility API calls behind `apps/api`.
The mobile app calls TimeFit API endpoints and may only hold public Expo configuration or public web keys.

## Live Data

- Route candidates: mobile calls `POST /routes`; API calls ODsay or returns an explicit empty state.
- Walking geometry: mobile calls `GET /kakao-local/directions/walk`; API calls Kakao Mobility Directions.
- Reverse geocoding and POI search: mobile calls `GET /kakao-local/...`; API calls Kakao Local.
- Seoul bus route IDs, path geometry, and station lists: mobile calls `GET /kakao-local/bus/...`; API calls Seoul Bus.

Server-only environment variables stay in `apps/api/.env`:

- `ODSAY_API_KEY`
- `KAKAO_REST_API_KEY`
- `SEOUL_BUS_KEY` or compatible Seoul API key variables documented in `apps/api/.env.example`

Mobile environment variables stay public:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_KAKAO_JS_KEY`
- `EXPO_PUBLIC_KAKAO_WEBVIEW_BASE_URL`
- Expo owner/slug and non-secret UI flags

Do not add ODsay, Kakao REST, Seoul Bus, or public data service keys to `apps/mobile/.env`.

## Fallbacks

Fallbacks are allowed only when they preserve product behavior without pretending to be live provider data.
Fallback responses or derived UI paths must be identifiable through `source`, `provider`, `isFallback`, `fallbackReason`, logs, or existing route metadata.

Allowed examples:

- Route geometry derived from backend route pass stops when Seoul route geometry is unavailable.
- Cached or stale realtime data where the source remains explicit.
- Explicit empty states from route search when no provider candidate exists.

Disallowed examples:

- Mobile-side direct calls to server-only providers.
- Replacing a provider failure with demo data in production.
- Shipping `EXPO_PUBLIC_*` server credentials for ODsay, Kakao REST, Seoul Bus, or public data APIs.

## Demo And Mock Flags

Demo and visual mock flags are development-only.
`apps/mobile/src/config/features.ts` forces those flags off when `NODE_ENV=production`.
The map adapter may use the mock adapter for local development without a native Kakao Maps module, but production must use the Kakao adapter path.

## Deferred Routing Work

Phase 4 mobile routing cleanup is intentionally not part of this change.
The current routing tree still needs a separate pass to remove obsolete screens or redirects without mixing that work into data-boundary changes.
