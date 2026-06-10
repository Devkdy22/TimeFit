# Saved Places Runtime Validation Sprint

Date: 2026-05-28
Owner: Feature Track / Reliability Validation
Status: Draft for execution

## 1) 목적
- Saved Places가 production runtime 환경에서 정합성(consistency), 소유권(ownership), 멱등성(idempotency), 세션 경계(auth generation invalidation)를 유지하는지 검증한다.
- 기능 추가보다 실패 모드 탐지와 launch blocker 식별을 우선한다.
- 기존 discipline(`request.authUserId`, `authorizedFetch`, Idempotency-Key, server-success-after-local-apply)을 유지한 상태에서 실환경 내구성을 평가한다.

## 2) 범위 및 비범위
범위:
- `GET /me/places`
- `POST /me/places`
- `DELETE /me/places/:id`
- 모바일 `authorizedFetch` 연동 경로
- 세션 갱신/만료/로그아웃 경계

비범위:
- PATCH 금지
- bulk operation 금지
- offline sync 금지
- notification 구현 금지
- 지도/UI 고도화 금지
- SSE auth migration 금지

## 3) 사전 조건
- API 서버가 Saved Places 스키마를 반영한 DB로 실행 중
- 모바일 앱이 최신 Saved Places 연동 빌드로 실행 중
- 테스트 계정 2개 준비
- 네트워크 토글 가능 환경(WiFi/LTE/airplane mode)
- API/모바일 로그 수집 가능
- 토큰 만료를 유도할 수 있는 환경(짧은 TTL 또는 강제 만료 시나리오)

## 4) 검증 시나리오 (Step-by-step, Expected, Failure Criteria, Logs, Priority, Suspect Layer)

### P0-1. Duplicate Create (Button Spam)
목적:
- 동일 입력으로 빠른 연속 create 시 중복 생성 없이 일관성 유지 확인

실행:
1. 로그인 상태에서 동일한 라벨/주소로 저장 버튼을 10~20회 연타
2. 요청 완료 후 `GET /me/places` 결과 확인

예상 결과:
- 동일 label 기준 단일 레코드만 유지
- 앱 목록과 서버 목록이 동일

실패 판정:
- 동일 label 중복 레코드 2개 이상
- 앱/서버 목록 불일치

확인 로그:
- API: POST 호출 횟수, upsert 결과 id
- Mobile: addSavedPlace 호출 횟수, 최종 state 길이

관련 리스크:
- race condition으로 인한 중복 생성

의심 레이어:
- Repository upsert uniqueness, DB unique index, UI trigger debounce 부재

### P0-2. Same Request Retry (Idempotency-Key Replay)
목적:
- 동일 key + 동일 payload 재시도 시 정확한 replay 보장

실행:
1. 동일 `Idempotency-Key`로 POST 2회 전송(수동 API 도구 포함)
2. 응답 페이로드 및 최종 저장 결과 비교

예상 결과:
- 2번째 응답은 replay된 동일 결과
- 레코드 1건 유지

실패 판정:
- 2번째 호출이 신규 생성됨
- replay가 아닌 상이 응답

확인 로그:
- API: idempotency store begin/complete hit
- API: scopeKey, payload hash

관련 리스크:
- 멱등성 store TTL/상태 오작동

의심 레이어:
- Idempotency store 구현, controller scopeKey 규칙

### P0-3. Logout During Create/Delete
목적:
- logout 중 in-flight mutation 응답이 이후 세션에 오염되지 않는지 검증

실행:
1. create 또는 delete 요청 직후 즉시 logout
2. 응답 지연 상황(네트워크 throttling)에서 앱 state 확인

예상 결과:
- late response discard
- logout 이후 로컬 state 오염 없음

실패 판정:
- logout 이후 place가 추가/삭제 반영됨

확인 로그:
- Mobile: sessionGeneration 변화, stale discard 로그
- API: 정상 처리 여부(서버 성공 자체는 가능)

관련 리스크:
- 세션 경계 붕괴로 계정 간 데이터 오염

의심 레이어:
- Mobile context generation check, auth context invalidation

### P0-4. Late Response Discard
목적:
- 오래 걸린 응답이 최신 세션/화면 상태를 덮어쓰지 않는지 확인

실행:
1. 네트워크 지연 후 create 요청
2. 요청 중 계정 재로그인 또는 화면 재진입
3. 지연 응답 도착 후 state 확인

예상 결과:
- stale response는 폐기
- 최신 세션 기준 상태만 유지

실패 판정:
- 과거 응답이 현재 state를 수정

확인 로그:
- Mobile: generation mismatch discard 로그

관련 리스크:
- 데이터 역전(out-of-order apply)

의심 레이어:
- client context mutation apply guard

### P0-5. DELETE Owner Mismatch (403)
목적:
- 소유권 경계 보장

실행:
1. 계정 A에서 place 생성
2. 계정 B 토큰으로 A의 place id DELETE 호출

예상 결과:
- HTTP 403
- 데이터 미삭제

실패 판정:
- 200/204 또는 실제 삭제 발생

확인 로그:
- API: `SAVED_PLACE_FORBIDDEN`

관련 리스크:
- 데이터 격리 실패 (launch blocker)

의심 레이어:
- repository owner check, authUserId binding

### P0-6. Token Expiry During Create/Delete
목적:
- 만료 토큰에서 refresh/retry 경로의 안전성 확인

실행:
1. 만료 직전/직후 토큰으로 create/delete 시도
2. refresh 성공/실패 케이스 분리 검증

예상 결과:
- refresh 성공 시 단일 mutation만 반영
- refresh 실패 시 mutation 미반영 + auth failure 처리

실패 판정:
- 중복 create/delete
- refresh 실패 후에도 state 반영

확인 로그:
- Mobile: authorizedFetch 401, refresh 시작/완료/실패
- API: mutation 호출 횟수

관련 리스크:
- 재시도로 인한 중복/유실

의심 레이어:
- authorizedFetch retry, idempotency, state apply timing

### P0-7. Refresh Retry 이후 Duplicate 여부
목적:
- 401->refresh->retry에서 중복 생성 방지

실행:
1. POST 전송 시 첫 호출 401 유도
2. refresh 후 자동 재시도 발생
3. 최종 레코드 수 확인

예상 결과:
- 1건만 생성

실패 판정:
- 2건 이상 생성

확인 로그:
- API: POST 횟수, idempotency replay 여부
- Mobile: retry path trace

관련 리스크:
- 네트워크/인증 경계 중복 생성

의심 레이어:
- header 전달(Idempotency-Key), refresh retry path

### P1-1. App Restart 후 Places Recovery
목적:
- 앱 재시작 시 서버 원본으로 복구되는지 검증

실행:
1. place 생성/삭제 후 앱 완전 종료
2. 앱 재시작 후 목록 동기화 확인

예상 결과:
- `GET /me/places` 기준 동일 상태 복구

실패 판정:
- 재시작 후 유령 데이터/누락 발생

확인 로그:
- Mobile: sync 시작/완료 로그

관련 리스크:
- 메모리 상태 의존 잔존

의심 레이어:
- bootstrap sync effect, auth readiness timing

### P1-2. WiFi ↔ LTE 전환 중 Mutation
목적:
- 네트워크 핸드오버 중 요청 일관성 확인

실행:
1. create/delete 요청 직전 네트워크 전환
2. 요청 결과와 최종 목록 확인

예상 결과:
- 성공 시 단일 반영
- 실패 시 로컬 미반영

실패 판정:
- 반쯤 반영된 상태(로컬만 반영 등)

확인 로그:
- Mobile: fetch error/abort reason
- API: 실제 처리 여부

관련 리스크:
- 네트워크 경계에서 false success

의심 레이어:
- client fetch error handling, server commit visibility

### P1-3. Airplane Mode Mutation
목적:
- 오프라인 상태에서 mutation 불변성 확인

실행:
1. 비행기 모드 ON
2. create/delete 시도
3. 다시 ON->OFF 전환 후 목록 확인

예상 결과:
- 오프라인 중 로컬 반영 없음
- 온라인 복귀 후 자동 재시도 없음(현재 정책상)

실패 판정:
- 오프라인 중 로컬 반영됨
- 온라인 복귀 후 의도치 않은 재시도 발생

확인 로그:
- Mobile: network failure 로그

관련 리스크:
- 사용자 인지와 실제 저장 상태 불일치

의심 레이어:
- client mutation apply policy

### P1-4. Background ↔ Foreground Mutation
목적:
- 앱 lifecycle 전환 중 in-flight 처리 안정성 검증

실행:
1. mutation 전송 후 즉시 background
2. foreground 복귀 후 state/서버 상태 확인

예상 결과:
- 성공 응답 수신 시에만 반영
- 실패 시 미반영

실패 판정:
- foreground 복귀 시 state 꼬임

확인 로그:
- Mobile app state transition + mutation completion 로그

관련 리스크:
- lifecycle race

의심 레이어:
- React state lifecycle, abort handling

### P2-1. Tracking Active 상태에서 Create/Delete
목적:
- trip tracking 활성 중 Saved Places mutation이 다른 실시간 상태와 충돌 없는지 확인

실행:
1. tracking active 상태에서 create/delete 반복
2. tracking UI/상태 이상 유무 확인

예상 결과:
- tracking 기능 영향 없음
- Saved Places 정상 처리

실패 판정:
- tracking state 오류 또는 mutation 유실

확인 로그:
- tracking hook 로그 + saved places mutation 로그

관련 리스크:
- shared state contention

의심 레이어:
- mobile context/provider composition

### P2-2. SSE Active 상태에서 Create/Delete
목적:
- SSE 연결 활성 중 mutation 간섭 여부 검증

실행:
1. SSE 구독 활성 상태 유지
2. create/delete 반복

예상 결과:
- SSE 연결 유지
- Saved Places mutation 정상

실패 판정:
- SSE 끊김/재연결 폭주, mutation 실패율 급증

확인 로그:
- SSE connection lifecycle 로그
- mutation 응답 로그

관련 리스크:
- 네트워크 리소스 경쟁

의심 레이어:
- transport layer concurrency, mobile networking stack

## 5) Saved Places Runtime Risk Matrix

| Risk | 발생 확률 | 치명도 | Launch Blocker | Known Acceptable Limitation |
|---|---|---:|---|---|
| Owner mismatch delete 허용 | Low | Critical | Yes | No |
| Refresh retry 중 duplicate create | Medium | High | Yes | No |
| Logout/late response로 state 오염 | Medium | High | Yes | No |
| Airplane mode에서 저장 실패(재시도 없음) | High | Medium | No | Yes |
| 네트워크 전환 중 일시 실패 | Medium | Medium | No | Yes |
| App restart 직후 일시적 stale UI | Low | Medium | No | Yes |
| SSE/tracking 동시성으로 mutation 지연 | Low | Medium | No | Yes |
| userId string 독립 영속으로 orphan 누적 | Medium | High | No (short-term) | No (long-term) |

## 6) Architecture Risk 문서화 (SavedPlace.userId string 독립 영속)

현재 선택 이유:
- 현재 auth 계층이 메모리 세션 기반이며, 기존 Prisma `User` lifecycle과 즉시 정합 연결이 준비되지 않음
- 기능 안정화 시점에서 FK migration은 blast radius가 크고 회귀 위험이 높음

장점:
- 구현 속도와 독립 배포 용이
- authUserId 경계 검증 로직 단순
- 기존 `request.authUserId` discipline 유지가 쉬움

Production 장기 리스크:
- orphan risk: 실제 user entity 삭제/변경과 SavedPlace 정리 불가
- provider migration risk: 소셜 provider id 체계 변경 시 기존 userId mapping 누락 가능
- user merge risk: 다중 identity 통합 시 SavedPlace 통합 전략 부재
- cascade cleanup limitation: FK 부재로 DB cascade delete 불가

왜 지금 FK migration을 하지 않는지:
- 현재 스프린트 목표가 기능 확장보다 runtime consistency 검증
- FK migration은 auth domain 재설계, 백필, 데이터 정합성 검증, 무중단 전환 전략을 동반해야 하며 별도 트랙 필요

향후 User FK migration 전략 초안:
1. `saved_places`에 nullable `user_fk` 컬럼 추가 (dual-write 준비)
2. authUserId -> User.id 매핑 테이블/규칙 확정
3. 백필 배치로 `user_fk` 채움, mismatch 레코드 격리
4. 읽기 경로를 `user_fk` 우선으로 전환, fallback 제거
5. FK + onDelete cascade 활성화
6. `userId string` 단계적 폐기

## 7) Settings Persistence Foundation 계획

대상:
- user settings persistence
- notification preference
- tracking preference
- routine preference

확장 원칙:
- optimistic update 정책: 기본 비활성 유지 (server success 후 반영)
- auth generation invalidation: 기존 세션 세대(generation) 검증 유지
- authorizedFetch 재사용: protected mutation/read 모두 공통 경로 사용
- ownership boundary: `request.authUserId` 단일 소유권 기준 유지
- mutation discipline: POST/DELETE 멱등성 적용 범위 명시, PATCH/bulk 미도입

권장 모델:
- `UserSettings` aggregate 1개 + 도메인별 하위 필드(알림/트래킹/루틴)
- 초기 단계는 GET + POST(업서트 성격) 중심
- write는 idempotency key 필수

Migration 위험:
- 설정 스키마 버전 불일치
- 앱 버전 혼재 시 필드 누락 처리
- FK migration과 동시 진행 시 blast radius 급증

완화:
- settings schema version 필드 도입
- backward-compatible default 서버 적용
- 단계적 rollout + 관측 지표(실패율/중복율/403율)

## 8) Saved Places QA Sprint 완료 기준 (Definition of Done)
- P0 시나리오 100% 통과
- P1 시나리오 90% 이상 통과, 실패 원인/완화책 문서화
- P2 시나리오 결과 기록 및 known limitation 분류 완료
- launch blocker 0건 또는 승인된 완화책 존재
- 운영 로그에서 duplicate/create-delete mismatch/403 bypass 없음

## 9) Launch Blocker 목록
- owner mismatch delete가 403이 아닌 경우
- refresh retry 경로에서 duplicate create 발생
- logout/late response에서 세션 오염 발생
- token expiry 처리 중 성공/실패 경계가 무너져 잘못된 로컬 반영 발생

## 10) Shipping 가능 여부
- 조건부 가능:
- 위 Launch blocker가 모두 해소되고, P0 전부 통과 시 shipping 가능
- P1/P2에서 남는 항목은 known acceptable limitation으로 명시 시 제한적 승인 가능

## 11) 지금은 무시 가능한 리스크
- airplane mode에서 mutation 자동 재시도 미지원
- WiFi/LTE 전환 중 일시 실패
- SSE/tracking 동시 실행 시 경미한 지연

## 12) 다음 단계(Settings persistence) 착수 조건
- Saved Places P0 완료 + blocker 0
- idempotency/authorizedFetch/session-generation 규약 준수 체크리스트 확정
- User FK migration과 설정 영속화를 분리한 로드맵 승인
- 운영 관측 대시보드(401/403/409/5xx, mutation success rate, duplicate rate) 준비
