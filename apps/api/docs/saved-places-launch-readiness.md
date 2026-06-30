# Saved Places Launch Readiness Report

## Current Storage

- `SavedPlace` stores `id`, `userId`, `label`, `normalizedLabel`, `address`, `lat`, `lng`, `createdAt`, and `updatedAt`.
- Prisma schema has `@@unique([userId, normalizedLabel])` and `@@index([userId])`.
- There is no explicit Prisma relation from `SavedPlace.userId` to `User.id` yet.

## Owner Structure

- List uses `findMany({ where: { userId } })`.
- Create/upsert scopes uniqueness by `{ userId, normalizedLabel }`.
- Delete first fetches `{ id, userId }`, then rejects non-owner access with `ForbiddenException`.
- The controller takes `authUserId` only from `AuthAccessGuard`.

## Auth Connection

- `SavedPlacesController` is guarded by `AuthAccessGuard`.
- With Sprint 1 auth changes, guard resolves `authUserId` from DB-backed access session state.
- Access to saved places is therefore session-backed, but referential integrity is not DB-enforced until `SavedPlace.userId` has a `User` relation.

## Idempotency

- `POST /me/places` requires `Idempotency-Key`.
- Scope key is `${authUserId}:POST:/me/places:${normalizedKey}`.
- Replays with the same payload return the cached response from `SavedPlaceIdempotencyStore`.
- The idempotency store is still process memory; multi-instance replay consistency is not guaranteed.
- DB upsert by `{ userId, normalizedLabel }` prevents duplicate saved place rows for the same normalized label even without cross-instance idempotency.

## Duplicate Creation Risks

- Same user and same normalized label: protected by DB unique constraint and upsert.
- Same user and semantically same place with different labels: allowed by current model.
- Same label with changed coordinates/address: updates the existing row by normalized label.
- Concurrent creates across API instances: DB upsert should converge to one row for identical normalized labels.

## Delete Authorization

- Delete is owner-checked in `SavedPlacesRepository.deleteOwned`.
- Missing row returns `NotFoundException`.
- Existing row owned by another user returns `ForbiddenException`.

## Foreground Refetch

- Mobile `RoutineProvider` fetches `/me/places` on login/profile availability.
- It also refetches `/me/places` when `AppState` becomes `active`.
- Failed foreground refetch logs a warning and keeps existing local state.

## Launch Readiness

- Ready for single-instance idempotent create/list/delete flows.
- Not launch-complete for multi-instance idempotency replay guarantees.
- Recommended Sprint 2 hardening:
  - Add explicit `SavedPlace.user` relation and FK cascade to Prisma schema.
  - Move saved place idempotency records to DB or Redis if exact replay semantics matter.
  - Add PostgreSQL-backed HTTP E2E for list/create/delete/ownership.
  - Decide whether duplicate semantic places with different labels are acceptable product behavior.
