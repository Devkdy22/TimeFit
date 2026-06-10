# Saved Places Production Readiness Review

Date: 2026-05-29
Owner: TimeFit Senior Staff Engineer Track
Scope: Stabilization only (no new end-user feature)

## 1. 구조 분석 결과

### 1.1 현재 데이터 흐름
- Mobile `RoutineProvider`가 로그인 시 `GET /me/places`로 서버 목록 동기화.
- 생성: `createMyPlace()` -> `POST /me/places` (`Idempotency-Key` 필수) -> 서버 성공 후 로컬 반영.
- 삭제: `deleteMyPlace()` -> `DELETE /me/places/:id` -> 서버 성공 후 로컬 반영.
- 서버는 `AuthAccessGuard`로 `request.authUserId`를 주입하고 ownership 경계를 강제.
- 서버 POST는 `SavedPlaceIdempotencyStore`로 key/payload hash 기반 replay/pending/conflict를 처리.

### 1.2 의존성 구조
- API
  - `SavedPlacesController` -> `SavedPlacesService` -> `SavedPlacesRepository`
  - `AuthAccessGuard`, `ApiResponse`, `HttpExceptionFilter`, global throttler
  - Prisma (`saved_place` table)
- Mobile
  - `useAuth`의 session generation + `authorizedFetch` refresh/retry
  - `useRoutines`가 Saved Places local state를 소유

### 1.3 영향 파일
API:
- `apps/api/src/modules/saved-places/saved-place-label.normalizer.ts` (신규)
- `apps/api/src/modules/saved-places/saved-places.controller.ts`
- `apps/api/src/modules/saved-places/services/saved-places.service.ts`
- `apps/api/src/modules/saved-places/services/saved-places.repository.ts`
- `apps/api/src/modules/saved-places/services/saved-places.metrics.ts` (신규)
- `apps/api/src/modules/saved-places/saved-places.module.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/test/unit/modules/saved-places/saved-place-label.normalizer.spec.ts` (신규)
- `apps/api/test/unit/modules/saved-places/saved-places.repository.concurrency.spec.ts` (신규)

Mobile:
- `apps/mobile/src/features/routine/context.tsx`

## 2. 리스크 분석

### 2.1 런타임 리스크
- 멀티 인스턴스 배포 시 idempotency store(in-memory) cross-instance replay 보장 부재.
- 네트워크 경계(토큰 갱신/네트워크 전환/백그라운드 전환)에서 out-of-order 응답 가능.
- 비로그인 fallback(local place 추가 경로)이 남아 있으면 정책 혼선 가능.

### 2.2 데이터 정합성 리스크
- 기존에는 라벨 정규화가 `trim` 수준이라 의미상 중복(`HOME` vs `home`) 발생 가능.
- 기존 unique가 raw `label` 기준이라 실제 중복 차단 실패 가능.

### 2.3 동시성(Concurrency) 리스크
- Create/Create: 다른 key 동시 요청 시 raw label 기준이면 중복 가능.
- Create/Delete: 동일 논리 개체에 대한 경합에서 최종 상태 일관성 불명확.
- Delete/Delete: 두 번째 삭제 요청의 실패 경계(404) 처리 일관성 필요.
- 다중 디바이스: 한 기기 변경이 다른 기기 foreground 복귀 전까지 stale 가능.

### 2.4 관측성(Observability) 부족
- 기존 Saved Places 경로에 requestId/authUserId/placeId/idempotencyKey 구조화 로그가 부족.
- 운영 지표 카운터 부재로 launch 전후 추세 분석이 어려움.

## 3. 안정화 변경 사항

### PHASE 2 - Label Normalization 적용
정규화 규칙:
- trim
- 연속 공백 제거
- unicode normalize (`NFKC`)
- lowercase (`toLocaleLowerCase('en-US')`)

적용 지점:
- 저장 전 처리: `SavedPlacesService.create()`
- 중복 검사 기준: repository upsert key를 `normalizedLabel` 사용
- unique 검증 기준: DB unique를 `[userId, normalizedLabel]`로 변경

세부 구현:
- `normalizedLabel` 컬럼 추가
- `createOrUpdateByLabel`의 where key: `userId_normalizedLabel`
- update 시에도 `label`을 canonical 값으로 동기화

### PHASE 3 - 동시성 검증
자동화 테스트 추가:
- `Create/Create Race`: 동일 normalized label 동시 저장 시 단일 row 수렴
- `Delete/Delete Race`: 동시 삭제 시 1개 성공 + 1개 실패 경로 확인
- `Create/Delete Race`: 동일 논리 개체 create/delete 경합 후 수렴 상태 확인
- `다중 디바이스 동시 요청`: 동시 create/delete 후 owner/ID 일관성 확인

### PHASE 4 - Foreground Revalidation
- 앱 foreground 진입(`AppState === active`) 시 `GET /me/places` 재동기화 추가
- polling/websocket 미사용, 기존 fetch/authorizedFetch 구조 재사용

### PHASE 5 - Observability Foundation
구조화 로그 추가:
- create/delete 이벤트에 `authUserId`, `placeId`, `idempotencyKey` 포함
- `requestId`는 기존 `SafeLogger` request context 자동 포함

메트릭 카운터 추가(in-process foundation):
- `saved_place_create_total`
- `saved_place_delete_total`
- `saved_place_create_failed_total`
- `saved_place_forbidden_total`
- `saved_place_idempotency_hit_total`

대시보드 구성 권장(운영 시스템 연동 시):
- 패널 1: Create Success/Fail rate (1m, 5m, 1h)
- 패널 2: Forbidden(403) 추이
- 패널 3: Idempotency hit ratio
- 패널 4: Delete success ratio
- 패널 5: p95 latency (POST/DELETE)

### PHASE 6 - Rate Limit 검토/적용
검토 결과:
- 기존 인프라(Nest Throttler global guard) 사용 가능

적용:
- `POST /me/places`: `@Throttle({ default: { limit: 20, ttl: 60000 } })`
- `DELETE /me/places/:id`: `@Throttle({ default: { limit: 30, ttl: 60000 } })`

## 4. 테스트 시나리오

### 자동화(Unit)
- label normalization 규칙 검증
- repository concurrency 수렴성 검증 (create/create, create/delete, delete/delete, multi-device)

### 수동(Runtime)
- duplicate create(button spam)
- idempotency key replay
- logout 중 create/delete
- late response discard
- owner mismatch 403
- token expiry create/delete
- refresh retry 이후 duplicate 여부
- app restart 후 recovery
- WiFi/LTE 전환 mutation
- airplane mode mutation
- background/foreground mutation
- tracking active 상태 mutation
- SSE active 상태 mutation

## 5. 남은 Launch Blocker
- 멀티 인스턴스 환경에서 idempotency store가 메모리 기반인 점(분산 replay 미보장)
- SavedPlace `userId`가 FK가 아닌 독립 string 기반이라는 구조적 리스크(장기)

## 6. 현재 Shipping 가능 여부
판정: **조건부 가능(Conditional Go)**

Go 조건:
- P0 runtime 검증 통과
- 403 ownership 위반 0건
- create duplicate anomaly 0건
- foreground revalidation로 다중기기 stale 이슈 재현 불가

No-Go 조건:
- refresh retry 경로에서 duplicate create 재현
- owner mismatch delete bypass 재현
- logout/session generation 경계에서 stale write 재현

## 7. Known Acceptable Limitation (현 시점 허용)
- 오프라인(airplane mode)에서 mutation 재시도 자동화 없음
- 네트워크 전환 중 일시적 실패 가능(사용자 재시도 필요)
- in-process metrics는 프로세스 재기동 시 초기화됨

## 8. 실패 시 의심 레이어 가이드
- Duplicate 생성: normalize + DB unique + upsert key
- 삭제 권한 이슈: AuthAccessGuard + repository owner check
- 세션 경계 오염: mobile auth generation invalidation + authorizedFetch retry
- 다중 디바이스 stale: foreground revalidation hook
- 이상 탐지 누락: saved places metrics/log ingestion pipeline

