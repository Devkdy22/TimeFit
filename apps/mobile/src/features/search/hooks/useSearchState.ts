import { useMemo, useState } from 'react';
import { inferPlaceIconType, useCommutePlan, type LocationField, type SavedPlace } from '../../commute-state/context';

const baseTravelMinutesByOption = {
  fastest: 37,
  lowTransfer: 42,
  lowWalk: 45,
} as const;

type TravelOption = keyof typeof baseTravelMinutesByOption;

const searchableLocations: SavedPlace[] = [
  {
    id: 'loc-gangnam-exit2',
    name: '강남역 2번 출구',
    address: '서울 강남구 강남대로 390',
    latitude: 37.4972,
    longitude: 127.0276,
    iconType: 'location',
  },
  {
    id: 'loc-seoul-station',
    name: '서울역',
    address: '서울 용산구 한강대로 405',
    latitude: 37.5547,
    longitude: 126.9706,
    iconType: 'location',
  },
  {
    id: 'loc-cityhall',
    name: '시청역',
    address: '서울 중구 세종대로 110',
    latitude: 37.5657,
    longitude: 126.9769,
    iconType: 'location',
  },
  {
    id: 'loc-jamsil-gym',
    name: '잠실 헬스장',
    address: '서울 송파구 올림픽로 240',
    latitude: 37.5122,
    longitude: 127.1,
    iconType: 'gym',
  },
  {
    id: 'loc-office-main',
    name: '회사',
    address: '서울 강남구 테헤란로 212',
    latitude: 37.5013,
    longitude: 127.0396,
    iconType: 'office',
  },
];

function parseArrivalMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function toClockText(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function withNamedId(place: SavedPlace) {
  return {
    ...place,
    id: `${place.id}-${Date.now()}`,
    iconType: place.iconType ?? inferPlaceIconType(place.name),
  };
}

export function useSearchState() {
  const {
    origin,
    destination,
    arrivalAt,
    savedPlaces,
    recentPlaces,
    latestSelectedPlace,
    setArrivalAt,
    applyPlaceToField,
    saveLatestPlace,
  } = useCommutePlan();

  const [selectedOption, setSelectedOption] = useState<TravelOption>('fastest');
  const [activeField, setActiveField] = useState<LocationField>('destination');
  const [query, setQuery] = useState('');
  const [isSaveNameOpen, setIsSaveNameOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  const options = useMemo(
    () => [
      { key: 'fastest' as const, label: '최소 시간' },
      { key: 'lowTransfer' as const, label: '환승 최소' },
      { key: 'lowWalk' as const, label: '도보 최소' },
    ],
    [],
  );

  const filteredSearchResults = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (keyword.length === 0) {
      return searchableLocations.slice(0, 4);
    }

    return searchableLocations.filter((location) => {
      const nameMatch = location.name.toLowerCase().includes(keyword);
      const addressMatch = location.address.toLowerCase().includes(keyword);
      return nameMatch || addressMatch;
    });
  }, [query]);

  const preview = useMemo(() => {
    const totalMinutes = baseTravelMinutesByOption[selectedOption];
    const bufferMinutes = selectedOption === 'fastest' ? 4 : selectedOption === 'lowTransfer' ? 6 : 8;
    const arrivalMinutes = parseArrivalMinutes(arrivalAt ?? '');

    const recommendedDeparture =
      arrivalMinutes == null
        ? `도착 시간 형식을 확인하세요`
        : `${toClockText(arrivalMinutes - totalMinutes - bufferMinutes)} 출발`;

    return {
      recommendedDeparture,
      estimatedTravel: `${totalMinutes}분`,
      buffer: `${bufferMinutes}분`,
    };
  }, [arrivalAt, selectedOption]);

  return {
    activeField,
    originLabel: origin?.name ?? '출발지를 선택하세요',
    destinationLabel: destination?.name ?? '어디로 가시나요?',
    arrivalAt: arrivalAt ?? '09:00',
    selectedOption,
    options,
    query,
    preview,
    savedPlaces,
    recentPlaces,
    filteredSearchResults,
    latestSelectedPlace,
    isSaveNameOpen,
    saveName,
    setQuery,
    setSaveName,
    setArrivalAt,
    setSelectedOption,
    setActiveField,
    selectPlace: (place: SavedPlace) => {
      applyPlaceToField(activeField, withNamedId(place));
      setIsSaveNameOpen(false);
      setSaveName('');
    },
    selectMapSample: () => {
      applyPlaceToField(activeField, {
        id: `map-picked-${Date.now()}`,
        name: '지도에서 선택한 위치',
        address: '서울 중구 을지로 66',
        latitude: 37.5662,
        longitude: 126.9913,
        iconType: 'location',
      });
      setIsSaveNameOpen(false);
      setSaveName('');
    },
    openSaveName: () => {
      if (!latestSelectedPlace) {
        return;
      }
      setSaveName(latestSelectedPlace.name);
      setIsSaveNameOpen(true);
    },
    savePlace: () => {
      const saved = saveLatestPlace(saveName);
      if (saved) {
        setIsSaveNameOpen(false);
        setSaveName('');
      }
    },
    cancelSavePlace: () => {
      setIsSaveNameOpen(false);
      setSaveName('');
    },
  };
}
