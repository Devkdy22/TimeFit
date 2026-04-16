import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { uiTheme } from '../../constants/theme';
import type { PlaceIconType } from '../../features/commute-state/context';

export interface LocationIconProps {
  type: PlaceIconType;
  size?: number;
}

const accentByType: Record<PlaceIconType, string> = {
  home: '#7CC8FF',
  office: '#A5B6FF',
  cafe: '#FFBE7A',
  gym: '#FF9CA8',
  school: '#B8D58B',
  location: '#97DCC8',
};

function SymbolPath({ type }: { type: PlaceIconType }) {
  if (type === 'home') {
    return (
      <>
        <Path d="M8 12L16 6L24 12V23H18V17H14V23H8V12Z" fill="#FFFFFF" />
        <Path d="M6 12L16 4L26 12" stroke="#1F2A44" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }

  if (type === 'office') {
    return (
      <>
        <Rect x="9" y="8" width="14" height="16" rx="2" fill="#FFFFFF" />
        <Rect x="13" y="18" width="6" height="6" rx="1" fill="#DDE3FF" />
        <Path d="M12 11H13.5M16 11H17.5M20 11H21.5M12 14H13.5M16 14H17.5M20 14H21.5" stroke="#1F2A44" strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  }

  if (type === 'cafe') {
    return (
      <>
        <Rect x="9" y="12" width="14" height="8" rx="3" fill="#FFFFFF" />
        <Path d="M23 14H24.5C25.8 14 26.8 15 26.8 16.2C26.8 17.4 25.8 18.4 24.5 18.4H23" stroke="#1F2A44" strokeWidth="1.3" />
        <Path d="M12 10.2V8.6M16 10.2V8.2M20 10.2V8.6" stroke="#1F2A44" strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  }

  if (type === 'gym') {
    return (
      <>
        <Rect x="9" y="14" width="3" height="6" rx="1" fill="#FFFFFF" />
        <Rect x="20" y="14" width="3" height="6" rx="1" fill="#FFFFFF" />
        <Rect x="12" y="15.5" width="8" height="3" rx="1.5" fill="#FFFFFF" />
        <Rect x="7" y="13" width="2" height="8" rx="1" fill="#1F2A44" opacity="0.9" />
        <Rect x="23" y="13" width="2" height="8" rx="1" fill="#1F2A44" opacity="0.9" />
      </>
    );
  }

  if (type === 'school') {
    return (
      <>
        <Path d="M7.5 12L16 8L24.5 12L16 16L7.5 12Z" fill="#FFFFFF" />
        <Path d="M11 15V19.5C11 21 13.2 22.2 16 22.2C18.8 22.2 21 21 21 19.5V15" stroke="#1F2A44" strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  }

  return (
    <>
      <Path d="M16 6.8C12.5 6.8 9.6 9.5 9.6 13.1C9.6 17.7 16 25.1 16 25.1C16 25.1 22.4 17.7 22.4 13.1C22.4 9.5 19.5 6.8 16 6.8Z" fill="#FFFFFF" />
      <Circle cx="16" cy="13" r="2.3" fill="#D2F4E9" />
    </>
  );
}

export function LocationIcon({ type, size = 28 }: LocationIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="16" r="15" fill={accentByType[type]} />
      <Circle cx="16" cy="16" r="14.4" stroke={uiTheme.colors.divider} strokeWidth="1" />
      <Circle cx="12" cy="10" r="3.2" fill="#FFFFFF" opacity="0.24" />
      <SymbolPath type={type} />
    </Svg>
  );
}
