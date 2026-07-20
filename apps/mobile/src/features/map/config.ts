import { NativeModules } from 'react-native';

const isProduction = process.env.NODE_ENV === 'production';

export const MAP_ADAPTER_TYPE: 'mock' | 'kakao' =
  NativeModules.KakaoMaps || isProduction ? 'kakao' : 'mock';
