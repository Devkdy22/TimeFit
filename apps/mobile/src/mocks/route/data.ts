import type { QuickDestination, RecentDestination, RouteItem, RoutineItem, TimelineItem } from './types';

export const quickDestinations: QuickDestination[] = [
  { id: 'dest-office', name: '회사', actionHint: '정문 앞 하차' },
  { id: 'dest-gym', name: '헬스장', actionHint: '도보 5분 포함' },
  { id: 'dest-home', name: '집', actionHint: '환승 1회' },
];

export const bestRoute: RouteItem = {
  id: 'best-route',
  name: '2호선 급행 + 7016 버스',
  summary: '도착 안정성 최고 · 환승 1회',
  eta: '도착 08:52',
};

export const alternativeRoutes: RouteItem[] = [
  {
    id: 'alt-route-1',
    name: '9호선 일반 + 9401 버스',
    summary: '혼잡도 낮음 · 도보 4분',
    eta: '도착 08:55',
  },
  {
    id: 'alt-route-2',
    name: '버스 471 단일',
    summary: '환승 없음 · 지연 위험 보통',
    eta: '도착 08:57',
  },
  {
    id: 'alt-route-3',
    name: '2호선 일반 + 143 버스',
    summary: '비용 절약 · 혼잡도 높음',
    eta: '도착 08:58',
  },
];

export const routeDetailProgress = 0.58;

export const routeTimeline: TimelineItem[] = [
  {
    id: 'timeline-1',
    time: '08:18',
    title: '정류장까지 도보 이동',
    description: '횡단보도 1회, 도보 약 6분',
    status: 'warning',
  },
  {
    id: 'timeline-2',
    time: '08:24',
    title: '7016 버스 탑승',
    description: '혼잡도 보통, 3정거장 이동',
    status: 'relaxed',
  },
  {
    id: 'timeline-3',
    time: '08:38',
    title: '2호선 급행 환승',
    description: '환승 이동 2분, 출입구 우측 이용',
    status: 'urgent',
  },
  {
    id: 'timeline-4',
    time: '08:52',
    title: '목적지 도착',
    description: '정문 앞 하차 후 도보 1분',
    status: 'relaxed',
  },
];

export const routineItems: RoutineItem[] = [
  { id: 'routine-1', title: '가방 챙기기', hint: '노트북 · 지갑 · 이어폰' },
  { id: 'routine-2', title: '물병 채우기', hint: '출발 전 1분' },
  { id: 'routine-3', title: '날씨 확인', hint: '우산/겉옷 체크' },
  { id: 'routine-4', title: '집중 모드 켜기', hint: '이동 중 방해 최소화' },
];

export const recentDestinations: RecentDestination[] = [
  { id: 'recent-1', name: '강남역 2번 출구', hint: '마지막 검색 · 08:42' },
  { id: 'recent-2', name: '서울역 KTX', hint: '최근 3회 방문' },
  { id: 'recent-3', name: '시청역 4번 출구', hint: '도보 6분 포함' },
];
