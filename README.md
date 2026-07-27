# TimeFit Monorepo

TimeFit는 도착 시간 역산 기반 이동 추천 서비스를 위한 pnpm workspace 모노레포입니다.

## Workspace
- `apps/api`: NestJS API + Prisma
- `apps/mobile`: Expo Router 앱
- `packages/shared`: 공통 타입
- `packages/config`: 공통 TS 설정

## 설치 및 실행
```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm prisma:generate
pnpm dev:api
pnpm dev:mobile
```

Android Dev Client에서 Expo CLI의 포트 탐색 오류가 발생하면 Metro를 직접 실행할 수 있습니다.

```bash
pnpm --filter @timefit/mobile dev:metro
adb reverse tcp:8081 tcp:8081
```

그 다음 Dev Client에서 `http://localhost:8081`을 선택합니다. 이 경로는 Metro 번들링만 제공하며 OAuth, 지도, Push 같은 네이티브 기능은 development build에서 검증해야 합니다.

## Health Check
```bash
curl http://localhost:3000/health
curl https://timefit-api.onrender.com/health
```

## GitHub 연결 방법
```bash
git init
git add .
git commit -m "init: timefit"
git branch -M main
git remote add origin https://github.com/<username>/timefit.git
git push -u origin main
```

## 브랜치 전략
- `main`: production
- `develop`: 개발 통합
- `feature/*`: 기능 개발

## 환경변수 설정
### API (`apps/api/.env`)
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (최소 32자)
- `JWT_REFRESH_SECRET` (최소 32자)
- `KAKAO_REST_API_KEY`
- `ODSAY_API_KEY`
- `SEOUL_BUS_KEY`
- `FCM_SERVER_KEY`
- `EXPO_PUSH_API_URL` (기본값: Expo Push Send API)
- `EXPO_PUSH_TIMEOUT_MS` (기본값: 8000, 1000~30000)
- `CORS_ORIGINS` (운영에서 whitelist)
- `RATE_LIMIT_TTL_MS` (기본 60000)
- `RATE_LIMIT_MAX` (기본 60)

### MOBILE (`apps/mobile/.env`)
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_KAKAO_JS_KEY`
- `EXPO_PUBLIC_KAKAO_WEBVIEW_BASE_URL`
- `EXPO_PUBLIC_ENABLE_DEMO_MOCKS` (개발용, 운영에서는 강제 비활성)

외부 데이터 경계와 fallback 정책은 `docs/architecture/external-data-boundaries.md`를 기준으로 관리합니다.

## 보안 가이드
- `.env`는 절대 커밋하지 않습니다.
- Mobile에 API key/JWT secret을 절대 넣지 않습니다.
- Kakao/FCM 등 외부 API는 반드시 backend를 통해 호출합니다.
- API는 `ValidationPipe + Helmet + Throttler + ExceptionFilter`를 기본 적용합니다.
- CORS 정책:
  - 개발(`NODE_ENV=development`): 전체 허용
  - 운영(`NODE_ENV=production`): `CORS_ORIGINS` whitelist만 허용
- Rate limit 초과 시 `RATE_LIMIT_EXCEEDED` 포맷으로 응답합니다.
- 에러 응답은 stack trace를 외부에 노출하지 않습니다.
- JWT secret은 env schema에서 길이 검증 후 서버가 기동합니다.

## 추가 보안 체크
- Refresh token은 원문 저장 대신 **해시 저장** 구조를 사용해야 합니다(구현 단계에서 적용).
- 운영 환경은 HTTPS 전제를 기준으로 설정해야 합니다.
- 민감정보는 `SafeLogger`를 통해 마스킹 후 로깅합니다.

## CI
- 파일: `.github/workflows/ci.yml`
- Node 20 + pnpm 기준
- `pnpm install -> pnpm lint -> pnpm build` 실행
