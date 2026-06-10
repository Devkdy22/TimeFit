# Tracking Stability Manual Validation Checklist

## 목적
실제 단말 환경에서 추적 안정성, 재연결 동작, 전송 루프 제어를 확인한다.

## 공통 관찰 포인트
- `tripId` 유지 여부
- `sessionGeneration` 증가 타이밍
- `reconnectAttempt` 증가/리셋
- `activeLoopCount`가 0~3 범위를 벗어나지 않는지
- `EventSourceState` 전이(`connecting -> open -> error/closed`)
- `lastPositionTimestamp` 갱신 여부

## 시나리오
1. background -> foreground
- 이동 화면에서 추적 시작
- 앱을 백그라운드 30초 유지 후 복귀
- 위치 전송 간격이 foreground로 복귀되는지 확인
- 중복 interval 또는 reconnect 폭증이 없는지 확인

2. airplane mode
- 추적 중 비행기 모드 ON
- SSE 에러 후 백오프 재시도 증가 확인
- 비행기 모드 OFF 후 연결 복구와 `reconnectAttempt` 리셋 확인

3. Wi-Fi/LTE 전환
- 추적 중 네트워크를 Wi-Fi에서 LTE로 변경
- SSE 재연결 1회 이내 안정 복구 확인
- route/status 상태 불일치가 없는지 확인

4. app pause/resume
- 홈 버튼으로 앱 pause 후 다시 resume
- `activeLoopCount`가 비정상 증가하지 않는지 확인
- 위치 전송이 재개되고 중복 요청이 없는지 확인

5. trip stop
- 추적 중 `stop` 실행
- 이후 reconnect/position 전송이 더 이상 발생하지 않는지 확인
- `EventSourceState`가 `closed`로 유지되는지 확인

6. reroute during reconnect
- 네트워크 불안정 상황에서 reroute 이벤트 유도
- reconnect 이후 `REROUTED` 이벤트 반영 확인
- stale callback으로 과거 세션 상태가 덮어쓰이지 않는지 확인
