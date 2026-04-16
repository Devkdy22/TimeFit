import { NativeModules } from 'react-native';

export const MAP_ADAPTER_TYPE: 'mock' | 'kakao' = NativeModules.KakaoMaps ? 'kakao' : 'mock';
