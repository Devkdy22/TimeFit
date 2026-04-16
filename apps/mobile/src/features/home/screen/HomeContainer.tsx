import { useMemo, useState } from 'react';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useHomeState } from '../hooks/useHomeState';
import { HomeView } from './HomeView';
import { useNavigationHelper } from '../../../utils/navigation';
import {
  inferPlaceIconType,
  useCommutePlan,
  type LocationField,
  type SavedPlace,
} from '../../commute-state/context';
import type { TimiInteraction, TimiMood } from '../../../components/character/useTimiAnimation';

interface MapCenterState {
  lat: number;
  lng: number;
}

function parseClockToDate(value: string | null) {
  if (!value) {
    const fallback = new Date(Date.now() + 60 * 60 * 1000);
    fallback.setSeconds(0, 0);
    return fallback;
  }
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const next = new Date();
  next.setHours(Number.isNaN(hour) ? 9 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  return next;
}

function toClockText(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMapAddress() {
  return `선택한 위치를 확인 중...`;
}

function distance(a: MapCenterState, b: MapCenterState) {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy);
}

const homeSearchCatalog: SavedPlace[] = [
  {
    id: 'catalog-gangnam',
    name: '강남역',
    address: '서울 강남구 강남대로 396',
    latitude: 37.4979,
    longitude: 127.0276,
    iconType: 'location',
  },
  {
    id: 'catalog-office',
    name: '회사',
    address: '서울 강남구 테헤란로 212',
    latitude: 37.5013,
    longitude: 127.0396,
    iconType: 'office',
  },
  {
    id: 'catalog-cafe',
    name: '스타 카페',
    address: '서울 강남구 테헤란로 201',
    latitude: 37.5004,
    longitude: 127.0369,
    iconType: 'cafe',
  },
  {
    id: 'catalog-gym',
    name: '헬스장',
    address: '서울 송파구 올림픽로 240',
    latitude: 37.5122,
    longitude: 127.1,
    iconType: 'gym',
  },
  {
    id: 'catalog-school',
    name: '한국대학교',
    address: '서울 동대문구 서울시립대로 163',
    latitude: 37.5837,
    longitude: 127.0587,
    iconType: 'school',
  },
];

const defaultMapCenter: MapCenterState = { lat: 37.5665, lng: 126.978 };

function cloneForSelection(place: SavedPlace): SavedPlace {
  return {
    ...place,
    id: `${place.id}-${Date.now()}`,
    iconType: place.iconType ?? inferPlaceIconType(place.name),
  };
}

export function HomeContainer() {
  const {
    arrivalAt,
    status,
    copy,
    originLabel,
    destinationLabel,
    hasDestination,
    savedPlaces,
    recentPlaces,
    routinePreview,
  } = useHomeState();
  const {
    origin,
    destination,
    setArrivalAt,
    applyPlaceToField,
    latestSelectedPlace,
    saveLatestPlace,
  } = useCommutePlan();
  const nav = useNavigationHelper();

  const [activeField, setActiveField] = useState<LocationField>('destination');
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [sheetQuery, setSheetQuery] = useState('');
  const [isSaveNameOpen, setIsSaveNameOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [tempTime, setTempTime] = useState(() => parseClockToDate(arrivalAt));
  const [mapCenter, setMapCenter] = useState<MapCenterState>(() => {
    if (destination) {
      return { lat: destination.latitude, lng: destination.longitude };
    }
    return defaultMapCenter;
  });
  const [mapCenterLabel, setMapCenterLabel] = useState(() => formatMapAddress());
  const [mapFocusPlace, setMapFocusPlace] = useState<SavedPlace | null>(null);
  const [mapFocusKey, setMapFocusKey] = useState(0);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const [timiInteraction, setTimiInteraction] = useState<TimiInteraction>('none');
  const [timiSignal, setTimiSignal] = useState(0);

  const timiMood: TimiMood = status.key === 'urgent' ? 'concerned' : isSheetVisible ? 'focus' : 'question';

  const filteredPlaces = useMemo(() => {
    const keyword = sheetQuery.trim().toLowerCase();
    if (keyword.length === 0) {
      return homeSearchCatalog;
    }

    return homeSearchCatalog.filter((place) => {
      const nameMatch = place.name.toLowerCase().includes(keyword);
      const addressMatch = place.address.toLowerCase().includes(keyword);
      return nameMatch || addressMatch;
    });
  }, [sheetQuery]);

  const mapAddressCatalog = useMemo(
    () => [...homeSearchCatalog, ...savedPlaces, ...recentPlaces],
    [recentPlaces, savedPlaces],
  );

  const resolveMapAddress = (center: MapCenterState) => {
    const nearest = mapAddressCatalog.reduce<{ place: SavedPlace | null; dist: number }>(
      (acc, place) => {
        const dist = distance(center, { lat: place.latitude, lng: place.longitude });
        if (dist < acc.dist) {
          return { place, dist };
        }
        return acc;
      },
      { place: null, dist: Number.POSITIVE_INFINITY },
    );

    if (nearest.place && nearest.dist < 0.008) {
      return `${nearest.place.name} · ${nearest.place.address}`;
    }

    return formatMapAddress();
  };

  const beginSheetForField = (field: LocationField) => {
    setActiveField(field);
    setIsSheetVisible(true);
    setIsSheetClosing(false);
    const seed = field === 'origin' ? origin : destination;
    const center = seed
      ? { lat: seed.latitude, lng: seed.longitude }
      : mapFocusPlace
        ? { lat: mapFocusPlace.latitude, lng: mapFocusPlace.longitude }
        : defaultMapCenter;

    setMapCenter(center);
    setMapCenterLabel(resolveMapAddress(center));
    setMapFocusPlace(
      seed
        ? {
            ...seed,
          }
        : null,
    );
    setMapFocusKey((prev) => prev + 1);
    setIsMapExpanded(false);

    setTimiInteraction('field');
    setTimiSignal((prev) => prev + 1);
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
    setIsSheetClosing(false);
    setSelectedFeedbackId(null);
    setSheetQuery('');
    setIsSaveNameOpen(false);
    setSaveName('');
    setIsMapExpanded(false);
  };

  const applyPlaceWithClose = (place: SavedPlace, interaction: TimiInteraction = 'field') => {
    if (isSheetClosing) {
      return;
    }

    const cloned = cloneForSelection(place);
    setSelectedFeedbackId(place.id);
    setIsSheetClosing(true);
    applyPlaceToField(activeField, cloned);
    setMapCenter({ lat: cloned.latitude, lng: cloned.longitude });
    setMapCenterLabel(cloned.address);

    setTimiInteraction(interaction);
    setTimiSignal((prev) => prev + 1);

    setTimeout(() => {
      closeSheet();
    }, 190);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, nextDate?: Date) => {
    if (!nextDate) {
      return;
    }
    setTempTime(nextDate);
  };

  return (
    <HomeView
      status={status.key}
      statusLabel={status.label}
      arrivalAt={arrivalAt}
      headline={copy.headline}
      body={copy.body}
      cta={copy.cta}
      origin={originLabel}
      destination={destinationLabel}
      hasDestination={hasDestination}
      recentPlaces={recentPlaces}
      savedPlaces={savedPlaces}
      routinePreview={routinePreview}
      isSheetVisible={isSheetVisible}
      isSheetClosing={isSheetClosing}
      selectedFeedbackId={selectedFeedbackId}
      activeField={activeField}
      sheetQuery={sheetQuery}
      filteredPlaces={filteredPlaces}
      latestSelectedPlace={latestSelectedPlace}
      isSaveNameOpen={isSaveNameOpen}
      saveName={saveName}
      timiMood={timiMood}
      timiInteraction={timiInteraction}
      timiSignal={timiSignal}
      isTimePickerVisible={isTimePickerVisible}
      tempTime={tempTime}
      mapCenterLabel={mapCenterLabel}
      mapFocusPlace={mapFocusPlace}
      mapFocusKey={mapFocusKey}
      isMapExpanded={isMapExpanded}
      onToggleMapExpand={() => setIsMapExpanded((prev) => !prev)}
      onOpenOriginSheet={() => beginSheetForField('origin')}
      onOpenDestinationSheet={() => beginSheetForField('destination')}
      onCloseSheet={() => {
        if (isSheetClosing) {
          return;
        }
        closeSheet();
      }}
      onChangeSheetQuery={setSheetQuery}
      onSelectSearchPlace={(place) => {
        setMapFocusPlace(place);
        setMapCenter({ lat: place.latitude, lng: place.longitude });
        setMapCenterLabel(place.address);
        setMapFocusKey((prev) => prev + 1);
        applyPlaceWithClose(place);
      }}
      onSelectRecentPlace={(id) => {
        const selected = recentPlaces.find((place) => place.id === id);
        if (selected) {
          applyPlaceWithClose(selected);
        }
      }}
      onSelectSavedPlace={(id) => {
        const selected = savedPlaces.find((place) => place.id === id);
        if (selected) {
          applyPlaceWithClose(selected);
        }
      }}
      onMapCenterChange={(center) => {
        setMapCenter(center);
        setMapCenterLabel(center.address ?? resolveMapAddress(center));
      }}
      onConfirmMapCenter={() => {
        const place: SavedPlace = {
          id: `map-center-${Date.now()}`,
          name: '지도에서 선택한 위치',
          address: mapCenterLabel,
          latitude: mapCenter.lat,
          longitude: mapCenter.lng,
          iconType: 'location',
        };
        applyPlaceWithClose(place);
      }}
      onPressRecentApply={(id) => {
        const selected = recentPlaces.find((place) => place.id === id);
        if (!selected) {
          return;
        }
        applyPlaceToField('destination', selected);
      }}
      onPressSavedApply={(id) => {
        const selected = savedPlaces.find((place) => place.id === id);
        if (!selected) {
          return;
        }
        applyPlaceToField('destination', selected);
      }}
      onOpenSaveName={() => {
        if (!latestSelectedPlace) {
          return;
        }
        setSaveName(latestSelectedPlace.name);
        setIsSaveNameOpen(true);
      }}
      onChangeSaveName={setSaveName}
      onSavePlace={() => {
        const saved = saveLatestPlace(saveName);
        if (saved) {
          setIsSaveNameOpen(false);
          setSaveName('');
          setTimiInteraction('save');
          setTimiSignal((prev) => prev + 1);
        }
      }}
      onCancelSaveName={() => {
        setIsSaveNameOpen(false);
        setSaveName('');
      }}
      onOpenTimePicker={() => {
        setTempTime(parseClockToDate(arrivalAt ?? ''));
        setIsTimePickerVisible(true);
      }}
      onChangeArrivalTime={handleTimeChange}
      onConfirmTimePicker={() => {
        setArrivalAt(toClockText(tempTime));
        requestAnimationFrame(() => {
          setIsTimePickerVisible(false);
        });
        setTimiInteraction('time');
        setTimiSignal((prev) => prev + 1);
      }}
      onCancelTimePicker={() => {
        setIsTimePickerVisible(false);
      }}
      onPressRoutines={nav.goToRoutines}
      onPressTransit={nav.goToTransit}
    />
  );
}
