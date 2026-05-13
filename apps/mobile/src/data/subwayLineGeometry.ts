export type Station = {
  name: string;
  lat: number;
  lng: number;
};

export const subwayLineGeometry: Record<string, Station[]> = {
  '1호선': [
    { name: '서울역', lat: 37.5547, lng: 126.9706 },
    { name: '시청', lat: 37.5659, lng: 126.9768 },
    { name: '종각', lat: 37.5702, lng: 126.9831 },
    { name: '종로3가', lat: 37.5716, lng: 126.9918 },
    { name: '동대문', lat: 37.5714, lng: 127.0095 },
  ],
  '2호선': [
    { name: '홍대입구', lat: 37.5571, lng: 126.9243 },
    { name: '합정', lat: 37.5492, lng: 126.9134 },
    { name: '당산', lat: 37.5344, lng: 126.9020 },
    { name: '영등포구청', lat: 37.5249, lng: 126.8956 },
    { name: '문래', lat: 37.5179, lng: 126.8948 },
    { name: '신도림', lat: 37.5088, lng: 126.8913 },
    { name: '대림', lat: 37.4944, lng: 126.8950 },
    { name: '구로디지털단지', lat: 37.4853, lng: 126.9014 },
    { name: '신대방', lat: 37.4875, lng: 126.9131 },
    { name: '신림', lat: 37.4842, lng: 126.9297 },
    { name: '봉천', lat: 37.4826, lng: 126.9418 },
    { name: '서울대입구', lat: 37.4812, lng: 126.9527 },
  ],
  '3호선': [
    { name: '대화', lat: 37.6762, lng: 126.7476 },
    { name: '주엽', lat: 37.6701, lng: 126.7614 },
    { name: '정발산', lat: 37.6593, lng: 126.7733 },
    { name: '마두', lat: 37.6520, lng: 126.7777 },
  ],
  '4호선': [
    { name: '서울역', lat: 37.5547, lng: 126.9731 },
    { name: '회현', lat: 37.5589, lng: 126.9786 },
    { name: '명동', lat: 37.5609, lng: 126.9863 },
    { name: '충무로', lat: 37.5612, lng: 126.9941 },
  ],
  '5호선': [
    { name: '굽은다리', lat: 37.5455, lng: 127.1429 },
    { name: '길동', lat: 37.5380, lng: 127.1400 },
    { name: '강동', lat: 37.5358, lng: 127.1324 },
    { name: '천호', lat: 37.5385, lng: 127.1239 },
    { name: '강동역', lat: 37.5351, lng: 127.1328 },
    { name: '군자', lat: 37.5570, lng: 127.0790 },
    { name: '왕십리', lat: 37.5612, lng: 127.0370 },
    { name: '동대문역사문화공원', lat: 37.5656, lng: 127.0092 },
    { name: '을지로4가', lat: 37.5666, lng: 126.9978 },
    { name: '종로3가', lat: 37.5726, lng: 126.9903 },
  ],
  '6호선': [
    { name: '합정', lat: 37.5495, lng: 126.9140 },
    { name: '상수', lat: 37.5478, lng: 126.9227 },
    { name: '광흥창', lat: 37.5474, lng: 126.9318 },
    { name: '대흥', lat: 37.5477, lng: 126.9422 },
  ],
  '7호선': [
    { name: '강남구청', lat: 37.5173, lng: 127.0412 },
    { name: '청담', lat: 37.5194, lng: 127.0529 },
    { name: '뚝섬유원지', lat: 37.5315, lng: 127.0678 },
    { name: '건대입구', lat: 37.5404, lng: 127.0700 },
  ],
  '8호선': [
    { name: '잠실', lat: 37.5133, lng: 127.1002 },
    { name: '몽촌토성', lat: 37.5178, lng: 127.1126 },
    { name: '강동구청', lat: 37.5302, lng: 127.1206 },
    { name: '암사', lat: 37.5502, lng: 127.1278 },
  ],
  '9호선': [
    { name: '개화', lat: 37.5787, lng: 126.7981 },
    { name: '김포공항', lat: 37.5624, lng: 126.8013 },
    { name: '염창', lat: 37.5469, lng: 126.8749 },
    { name: '당산', lat: 37.5339, lng: 126.9026 },
  ],
};

export const subwayColors: Record<string, string> = {
  '1호선': '#0052A4',
  '2호선': '#00A84D',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
};

// Backward compatibility exports.
export const SUBWAY_LINE_GEOMETRY = subwayLineGeometry;
export const SUBWAY_LINE_COLORS = subwayColors;
