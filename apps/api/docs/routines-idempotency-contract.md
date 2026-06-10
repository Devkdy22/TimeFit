# Routines POST Idempotency Contract (Phase 5-0)

대상: `POST /routines` (구현 전 계약 고정)

## 1) Header
- 요청 헤더: `Idempotency-Key`
- 형식: UUID 문자열 권장
- 누락 시:
  - Phase 5-1 구현 시점 정책 선택 필요
  - 기본 권장: `400 IDEMPOTENCY_KEY_REQUIRED`

## 2) Scope
- 멱등 키 스코프: `userId + method + path + key`
- `userId`는 body/query가 아닌 인증 컨텍스트(`request.authUserId`) 기준

## 3) TTL
- 보관 TTL: 24시간

## 4) 재요청 정책
- 동일 `scope` + 동일 payload:
  - 기존 성공 응답(201/200)을 그대로 반환
- 동일 `scope` + 다른 payload:
  - `409 IDEMPOTENCY_CONFLICT`
- 동일 `scope` + 상태 `PENDING`:
  - `409 IDEMPOTENCY_PENDING` 으로 확정
  - 이유: 클라이언트가 재시도/백오프를 명시적으로 제어하기 쉬움

## 5) 저장소 정책
- Phase 5-1 임시 구현: 인메모리 저장소 허용
- Production backlog 필수:
  - DB 또는 Redis 기반 영속/공유 저장소로 전환
  - 멀티 인스턴스 환경에서 중복 생성 방지 보장

## 6) 클라이언트 계약
- createRoutine 요청마다 UUID 기반 `Idempotency-Key` 생성
- 네트워크 재시도/refresh 재시도 시 동일 key 재사용
- logout/session generation mismatch 발생 시 응답 폐기

## 7) 상태 코드/에러 코드 계약
- `409 IDEMPOTENCY_CONFLICT`: key 재사용 + payload 불일치
- `409 IDEMPOTENCY_PENDING`: 동일 key가 처리 중

## 8) 비범위 (본 커밋)
- `POST /routines` 실제 구현
- Prisma schema 변경
- routines write API 전환
- refresh architecture 변경
