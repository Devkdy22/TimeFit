# Timey Rive Keyframe Recipe (MVP)

Source SVG:
- `/Users/kimdoyeon/Dev/TimeFit/design/mascot/rive/source/timey-rive-ready.svg`

Output `.riv`:
- `/Users/kimdoyeon/Dev/TimeFit/apps/mobile/assets/animations/timey/timey.riv`

---

## 1) Import 후 Layer 확인 방법
1. Rive Editor에서 `New File` 생성.
2. 좌측 `Assets` 또는 캔버스에 `Import` -> `timey-rive-ready.svg` 선택.
3. Artboard 이름을 `Timey`로 설정, Size `1024 x 1024`.
4. Hierarchy에서 아래 그룹이 정확히 있는지 확인:
- `body`
- `face`
- `leftBell`
- `rightBell`
- `bellPins`
- `leftEye`
- `rightEye`
- `mouth`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- `clockMarks`
- `cheekLeft`
- `cheekRight`
- `sweat`
- `questionMark`
- `alertIcon`
- `confetti`
5. 누락 시 SVG 재import(레이어명 수동 변경 금지).

---

## 2) Layer별 Pivot 설정 위치
`Select Layer` -> 우측 `Transform` -> Pivot 값 입력(정규화 좌표로 중앙 근사치):

- `body`: Pivot `(0.50, 0.58)`
- `face`: Pivot `(0.50, 0.50)`
- `leftBell`: Pivot `(0.52, 0.78)` (bell hinge)
- `rightBell`: Pivot `(0.48, 0.78)` (bell hinge)
- `bellPins`: Pivot `(0.50, 0.50)`
- `leftEye`: Pivot `(0.50, 0.50)`
- `rightEye`: Pivot `(0.50, 0.50)`
- `mouth`: Pivot `(0.50, 0.50)`
- `leftArm`: Pivot `(0.30, 0.55)` (shoulder)
- `rightArm`: Pivot `(0.70, 0.55)` (shoulder)
- `leftLeg`: Pivot `(0.50, 0.25)` (hip)
- `rightLeg`: Pivot `(0.50, 0.25)` (hip)
- `clockMarks`: Pivot `(0.50, 0.50)`
- `cheekLeft`: Pivot `(0.50, 0.50)`
- `cheekRight`: Pivot `(0.50, 0.50)`
- `sweat`: Pivot `(0.50, 0.90)`
- `questionMark`: Pivot `(0.50, 0.50)`
- `alertIcon`: Pivot `(0.50, 0.50)`
- `confetti`: Pivot `(0.50, 0.80)`

초기 visibility:
- `sweat`, `questionMark`, `alertIcon`, `confetti`는 `opacity 0`.

---

## 3) Animation별 Timeline Duration
- `idle`: 1200ms (루프)
- `searching`: 900ms (루프)
- `warning`: 900ms (루프)
- `urgent`: 900ms (루프)
- `rerouting`: 900ms (루프)
- `success`: 1200ms (원샷, 트리거)

---

## 4) Keyframe Recipe (0/300/600/900/end)

기본값(모든 레이어 공통 초기값):
- `translateX=0`, `translateY=0`, `scaleX=1`, `scaleY=1`, `rotation=0`, `opacity=100`
- 단, hidden FX(`sweat/questionMark/alertIcon/confetti`)는 `opacity=0`

### A. idle (0ms / 300ms / 600ms / 900ms / 1200ms)
Loop: ON

`body`
- 0: `tY 0`, `sY 1.000`
- 300: `tY -2`, `sY 1.010`
- 600: `tY 0`, `sY 1.000`
- 900: `tY 1`, `sY 0.995`
- 1200: `tY 0`, `sY 1.000`

`leftBell`
- 0: `rot 0`
- 300: `rot 1.5`
- 600: `rot 0`
- 900: `rot -1.5`
- 1200: `rot 0`

`rightBell`
- 0: `rot 0`
- 300: `rot -1.5`
- 600: `rot 0`
- 900: `rot 1.5`
- 1200: `rot 0`

`leftEye`, `rightEye` (blink)
- 0: `sY 1.00`
- 300: `sY 1.00`
- 600: `sY 0.20`
- 900: `sY 1.00`
- 1200: `sY 1.00`

`mouth`
- 0..1200: 변화 없음 (`neutral`)

### B. searching (0/300/600/900/900)
Loop: ON

`body`
- 0: `rot -1.0`, `tY 0`
- 300: `rot 0.8`, `tY -2`
- 600: `rot -0.8`, `tY -1`
- 900: `rot 1.0`, `tY 0`
- end(900): same as 0로 자연 루프

`leftEye`, `rightEye`
- 0: `tX -3`
- 300: `tX 3`
- 600: `tX -2`
- 900: `tX 2`
- end: 0프레임과 이어지게 보정

`questionMark`
- 0: `opacity 0`, `tY 4`, `sX 0.95`, `sY 0.95`
- 300: `opacity 100`, `tY -2`, `sX 1.00`, `sY 1.00`
- 600: `opacity 65`, `tY -5`, `sX 1.03`, `sY 1.03`
- 900: `opacity 0`, `tY -8`, `sX 1.05`, `sY 1.05`

`mouth`
- 0..900: slight worried-neutral (`tY 1` 정도만)

### C. warning (0/300/600/900/900)
Loop: ON

`body`
- 0: `rot -0.8`, `tX 0`
- 300: `rot 0.8`, `tX 1`
- 600: `rot -0.6`, `tX -1`
- 900: `rot 0.6`, `tX 0`

`leftBell`
- 0: `rot 0`
- 300: `rot 4`
- 600: `rot -3`
- 900: `rot 2`

`rightBell`
- 0: `rot 0`
- 300: `rot -4`
- 600: `rot 3`
- 900: `rot -2`

`sweat`
- 0: `opacity 0`, `tY 0`, `sX 0.92`, `sY 0.92`
- 300: `opacity 100`, `tY 3`, `sX 1.00`, `sY 1.00`
- 600: `opacity 75`, `tY 7`, `sX 1.02`, `sY 1.02`
- 900: `opacity 0`, `tY 10`, `sX 1.04`, `sY 1.04`

`leftEye`, `rightEye`
- 0: `sY 1.0`
- 300: `sY 0.92`
- 600: `sY 0.88`
- 900: `sY 0.94`

`mouth`
- 0: `tY 0`
- 300: `tY 2`
- 600: `tY 3`
- 900: `tY 1`

### D. urgent (0/300/600/900/900)
Loop: ON

`body`
- 0: `tY 0`, `sY 1.00`, `rot -1.5`
- 300: `tY -3`, `sY 1.03`, `rot 1.5`
- 600: `tY 1`, `sY 0.97`, `rot -1.2`
- 900: `tY -1`, `sY 1.01`, `rot 1.2`

`leftBell`
- 0: `rot 0`
- 300: `rot 8`
- 600: `rot -7`
- 900: `rot 6`

`rightBell`
- 0: `rot 0`
- 300: `rot -8`
- 600: `rot 7`
- 900: `rot -6`

`alertIcon`
- 0: `opacity 0`, `sX 0.7`, `sY 0.7`
- 300: `opacity 100`, `sX 1.08`, `sY 1.08`
- 600: `opacity 100`, `sX 1.00`, `sY 1.00`
- 900: `opacity 70`, `sX 0.96`, `sY 0.96`

`leftEye`, `rightEye`
- 0: `sX 1.00`, `sY 1.00`
- 300: `sX 1.08`, `sY 1.10`
- 600: `sX 1.06`, `sY 1.08`
- 900: `sX 1.03`, `sY 1.04`

### E. rerouting (0/300/600/900/900)
Loop: ON

`body`
- 0: `rot -2.0`, `tY 0`
- 300: `rot 0.0`, `tY -2`
- 600: `rot 1.8`, `tY -1`
- 900: `rot 0.2`, `tY 0`

`leftEye`, `rightEye`
- 0: `tX -2`, `tY 0`
- 300: `tX 1`, `tY -1`
- 600: `tX 2`, `tY -1`
- 900: `tX 0`, `tY 0`

`questionMark`
- 0: `opacity 30`, `tY 2`
- 300: `opacity 100`, `tY -3`
- 600: `opacity 65`, `tY -6`
- 900: `opacity 20`, `tY -2`

`mouth`
- 0: `tY 1`
- 300: `tY 2`
- 600: `tY 1`
- 900: `tY 1`

### F. success (0/300/600/900/1200)
Loop: OFF (One-shot)

`body`
- 0: `tY 0`, `sY 1.00`
- 300: `tY -10`, `sY 1.04`
- 600: `tY 2`, `sY 0.97`
- 900: `tY -2`, `sY 1.01`
- 1200: `tY 0`, `sY 1.00`

`leftBell`
- 0: `rot 0`
- 300: `rot 6`
- 600: `rot -4`
- 900: `rot 2`
- 1200: `rot 0`

`rightBell`
- 0: `rot 0`
- 300: `rot -6`
- 600: `rot 4`
- 900: `rot -2`
- 1200: `rot 0`

`confetti`
- 0: `opacity 0`, `tY 8`, `sX 0.8`, `sY 0.8`
- 300: `opacity 100`, `tY -2`, `sX 1.06`, `sY 1.06`
- 600: `opacity 80`, `tY -6`, `sX 1.02`, `sY 1.02`
- 900: `opacity 40`, `tY -10`, `sX 0.98`, `sY 0.98`
- 1200: `opacity 0`, `tY -12`, `sX 0.95`, `sY 0.95`

`cheekLeft`, `cheekRight`
- 0: `opacity 18`
- 300: `opacity 38`
- 600: `opacity 32`
- 900: `opacity 24`
- 1200: `opacity 18`

---

## 5) Easing Curve 추천
- 기본 loop 구간: `Ease In Out Cubic`
- bell/alert/confetti pop: `Ease Out Back` (overshoot 약하게)
- settle 구간(성공 후 복귀): `Ease Out Cubic`
- 금지: linear 직선 모션, 과도한 elastic/bounce

---

## 6) State Machine 연결 방법
1. `State Machine` 탭에서 `TimeyStateMachine` 생성.
2. Inputs 추가:
- Number: `stateNumber`
- Number: `urgency` (0..1)
- Boolean: `isMoving`
- Trigger: `triggerSuccess`
- Trigger: `triggerReroute`
- Trigger: `triggerOffroute`
3. Animations를 state로 배치:
- `idle`, `searching`, `warning`, `urgent`, `rerouting`, `success`
4. Number condition 연결:
- `stateNumber==0` -> `idle`
- `stateNumber==1` -> `searching`
- `stateNumber==8` -> `warning`
- `stateNumber==9` -> `urgent`
- `stateNumber==12` -> `rerouting`
- `stateNumber==13` -> `success` (base path도 두되 trigger 우선)
5. Trigger override:
- Any -> `success` on `triggerSuccess`
- Any -> `rerouting` on `triggerReroute`
- Any -> `urgent` 또는 `offroute 대체 클립` on `triggerOffroute`
6. `urgency` 적용:
- `warning`, `urgent` state에서 bell/body shake amplitude를 `urgency`로 0.6x~1.0x modulation.
7. `isMoving` 적용:
- `true`일 때 body에 `tY ±1` 보조 모션만 추가.

---

## 7) QA 체크 방법
1. Rive Input 패널에서 순차 확인:
- `stateNumber=0,1,8,9,12,13`
- `urgency=0.2`, `0.6`, `1.0`
- `isMoving=false/true`
2. Trigger 테스트:
- `triggerSuccess` 연타 시 1회 자연 재생 확인
- `triggerReroute` 전환 시 jerk 없는지 확인
- `triggerOffroute` 전환 시 과도한 흔들림 없는지 확인
3. 모션 품질 기준:
- 2~8deg 범위 내 회전
- 과도한 XY 이동 금지(대부분 0~10px)
- 1s 내 고주파 떨림 금지
4. 성능 기준:
- transform/opacity 중심만 사용
- path morph 최소화
- 저사양 Android 가정 시 confetti는 짧고 가볍게

---

## 8) Export
1. Export -> `Rive` 선택
2. 파일명 `timey.riv`
3. 저장:
- `/Users/kimdoyeon/Dev/TimeFit/apps/mobile/assets/animations/timey/timey.riv`
4. 앱 확인:
- `/dev/timey-preview`에서 `animationMode=rive` + input harness로 검증

