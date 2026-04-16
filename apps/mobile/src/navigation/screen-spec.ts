import { APP_ROUTES, type AppRoutePath } from '../constants/routes';

export interface ScreenSpec {
  path: AppRoutePath;
  role: string;
  singleAction: string;
  usesStatus: boolean;
  showsTimy: boolean;
}

export const screenSpecs: ScreenSpec[] = [
  {
    path: APP_ROUTES.beforeStartOnboarding,
    role: '행동 중심 UX를 빠르게 학습',
    singleAction: '시작하기',
    usesStatus: false,
    showsTimy: true,
  },
  {
    path: APP_ROUTES.beforeStartHome,
    role: '현재 상황에서 바로 해야 할 행동 제시',
    singleAction: '지금 출발',
    usesStatus: true,
    showsTimy: true,
  },
  {
    path: APP_ROUTES.reengagementRoutines,
    role: '출발 전 루틴 확인',
    singleAction: '루틴 시작',
    usesStatus: true,
    showsTimy: true,
  },
  {
    path: APP_ROUTES.reengagementSettings,
    role: '알림/기준 시간 설정',
    singleAction: '설정 변경',
    usesStatus: false,
    showsTimy: false,
  },
  {
    path: APP_ROUTES.beforeStartSearch,
    role: '목적지 선택',
    singleAction: '추천 경로 보기',
    usesStatus: true,
    showsTimy: true,
  },
  {
    path: APP_ROUTES.beforeDepartureRecommendation,
    role: '추천 경로 확정',
    singleAction: '경로 상세 보기',
    usesStatus: true,
    showsTimy: false,
  },
  {
    path: APP_ROUTES.beforeDepartureDetail,
    role: '리스크 상세 확인',
    singleAction: '이동 시작',
    usesStatus: true,
    showsTimy: true,
  },
  {
    path: APP_ROUTES.transitMain,
    role: '이동 상태 유지',
    singleAction: '홈으로',
    usesStatus: true,
    showsTimy: false,
  },
];
