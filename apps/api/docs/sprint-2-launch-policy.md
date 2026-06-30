# Sprint 2 Launch Policy

## Legacy Routine Weekdays

Legacy `Routine` rows do not have a reliable source for weekdays. During migration
`202606160001_saved_places_fk_idempotency`, any routine with
`weekdays = ARRAY[]::INTEGER[]` is set to `active = false`.

This prevents automatic routine execution and notifications for migrated rows that
cannot be scheduled safely. The user must open the routine edit flow, select
weekdays, and save before the routine can be used as active again.

## Saved Places Ownership

`SavedPlace.userId` is enforced as a `User(id)` foreign key with cascade delete.
Existing orphan rows are removed by the migration before the FK is added because
they cannot be surfaced to an authenticated owner.

The existing unique constraint on `{ userId, normalizedLabel }` remains the
primary duplicate guard for requests without an `Idempotency-Key`.

## Idempotency

Create idempotency uses `IdempotencyKey` rows scoped by `{ userId, scope, key }`.
The current scopes are:

- `saved-place:create`
- `routine:create`

Policy:

- New key: create `PENDING`, run the operation, then store `COMPLETED` with the
  API response snapshot.
- Same key and same payload after completion: replay the response snapshot.
- Same key and different payload: `409 IDEMPOTENCY_CONFLICT`.
- Same key and same payload while pending: `409 IDEMPOTENCY_PENDING`.
- Failed operation: delete the pending row so the same request can retry.
- Expired key: reusable after cleanup. The store removes expired matching keys
  on begin; broader cleanup can run with `expiresAt <= now()`.

## Launch Gate Queries

```sql
SELECT count(*) AS active_empty_weekday_routines
FROM "Routine"
WHERE "weekdays" = ARRAY[]::INTEGER[]
  AND "active" = true;
```

```sql
SELECT count(*) AS orphan_saved_places
FROM "SavedPlace" sp
WHERE NOT EXISTS (
  SELECT 1
  FROM "User" u
  WHERE u."id" = sp."userId"
);
```

```sql
SELECT "userId", "scope", "key", count(*)
FROM "IdempotencyKey"
GROUP BY "userId", "scope", "key"
HAVING count(*) > 1;
```
