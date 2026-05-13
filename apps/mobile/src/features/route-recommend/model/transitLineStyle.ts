export type TransitMode = 'bus' | 'subway';

export interface TransitLineInput {
  mode: TransitMode;
  lineName?: string;
  routeNo?: string;
  routeType?: string;
  city?: string;
}

export interface TransitLineStyle {
  color: string;
  textColor: string;
  label: string;
  type: string;
}

export function getTransitLineStyle(input: TransitLineInput): TransitLineStyle {
  if (input.mode === 'bus') {
    return getBusStyle(input);
  }

  return getSubwayStyle(input);
}

function getBusStyle(input: TransitLineInput): TransitLineStyle {
  const no = normalizeBusNo(input.routeNo || input.lineName || '');
  const type = normalizeText(input.routeType || '');
  const city = normalizeText(input.city || '');
  const isDistrictVillageNo =
    /^(강남|강동|강북|강서|관악|광진|구로|금천|노원|도봉|동대문|동작|마포|서대문|서초|성동|성북|송파|양천|영등포|용산|은평|종로|중|중랑)\d{1,2}(-\d{1,2})?$/.test(no) ||
    /^(수원|성남|고양|용인|부천|안산|안양|남양주|화성|평택|의정부|시흥|파주|김포|광명|군포|오산|이천|구리|하남|의왕|양주|동두천|과천|여주|포천|광주)\d{1,2}(-\d{1,2})?$/.test(no);

  if (
    type.includes('마을') ||
    no.includes('마을') ||
    no.includes('VILLAGE') ||
    /(^|[^0-9])마을/i.test(no) ||
    isDistrictVillageNo
  ) {
    return style('#8CD654', '#103000', '마을버스', 'village-bus');
  }

  if (type.includes('심야') || /^N\d+/.test(no)) {
    return style('#2B2B2B', '#FFFFFF', '심야버스', 'night-bus');
  }

  if (type.includes('공항') || no.includes('공항') || no.includes('AIRPORT')) {
    return style('#7A57D1', '#FFFFFF', '공항버스', 'airport-bus');
  }

  if (
    type.includes('광역') ||
    type.includes('직행') ||
    type.includes('급행') ||
    type.includes('좌석') ||
    /^M\d+/.test(no)
  ) {
    return style('#E34D4D', '#FFFFFF', '광역/직행버스', 'express-bus');
  }

  if (city.includes('경기') || city.includes('GYEONGGI')) {
    if (/^(1|3|5|7|8|9)\d{3}$/.test(no)) {
      return style('#E34D4D', '#FFFFFF', '경기 광역/직행버스', 'express-bus');
    }

    if (/^\d{1,3}$/.test(no)) {
      return style('#2FA84F', '#FFFFFF', '경기 일반버스', 'gyeonggi-bus');
    }

    if (/^\d{4}$/.test(no)) {
      return style('#2FA84F', '#FFFFFF', '경기 일반버스', 'gyeonggi-bus');
    }

    return style('#2FA84F', '#FFFFFF', '경기 버스', 'gyeonggi-bus');
  }

  if (city.includes('서울') || city.includes('SEOUL')) {
    if (/^0\d/.test(no)) {
      return style('#F2B632', '#1F2937', '순환버스', 'circle-bus');
    }

    if (/^9\d{3}$/.test(no)) {
      return style('#E34D4D', '#FFFFFF', '광역버스', 'express-bus');
    }

    if (/^\d{4}$/.test(no)) {
      return style('#2FA84F', '#FFFFFF', '지선버스', 'branch-bus');
    }

    if (/^\d{3}$/.test(no)) {
      return style('#2D7FF9', '#FFFFFF', '간선버스', 'trunk-bus');
    }
  }

  if (type.includes('지선')) {
    return style('#2FA84F', '#FFFFFF', '지선버스', 'branch-bus');
  }

  if (type.includes('간선')) {
    return style('#2D7FF9', '#FFFFFF', '간선버스', 'trunk-bus');
  }

  if (type.includes('일반')) {
    return style('#2FA84F', '#FFFFFF', '일반버스', 'local-bus');
  }

  if (/^\d+-\d+$/.test(no)) {
    return style('#8CD654', '#103000', '마을버스', 'village-bus');
  }

  if (/^(7|8|9)\d{3}$/.test(no)) {
    return style('#E34D4D', '#FFFFFF', '광역버스', 'express-bus');
  }

  if (/^\d{1,3}$/.test(no)) {
    return style('#2FA84F', '#FFFFFF', '일반버스', 'local-bus');
  }

  if (/^\d{4}$/.test(no)) {
    return style('#2FA84F', '#FFFFFF', '지선/일반버스', 'branch-bus');
  }

  return style('#64748B', '#FFFFFF', '버스', 'unknown-bus');
}

function getSubwayStyle(input: TransitLineInput): TransitLineStyle {
  const raw = (input.lineName || '').replace(/\s/g, '');

  const subwayMap: Record<string, string> = {
    '1호선': '#0052A4',
    '2호선': '#00A84D',
    '3호선': '#EF7C1C',
    '4호선': '#00A5DE',
    '5호선': '#996CAC',
    '6호선': '#CD7C2F',
    '7호선': '#747F00',
    '8호선': '#E6186C',
    '9호선': '#BDB092',
    '수인분당선': '#FABE00',
    '분당선': '#FABE00',
    '신분당선': '#D4003B',
    '경의중앙선': '#77C4A3',
    '경춘선': '#0C8E72',
    '경강선': '#003DA5',
    '서해선': '#81A914',
    '공항철도': '#0090D2',
    '인천1호선': '#7CA8D5',
    '인천2호선': '#ED8B00',
    '우이신설선': '#B7C452',
    '신림선': '#6789CA',
    '의정부경전철': '#FDA600',
    '에버라인': '#6FB245',
    '김포골드라인': '#A17800',
    '부산1호선': '#F58220',
    '부산2호선': '#81BF48',
    '부산3호선': '#BB8C00',
    '부산4호선': '#2E8B57',
    '대구1호선': '#D93F5C',
    '대구2호선': '#00AA80',
    '대구3호선': '#F2B600',
    '광주1호선': '#009944',
    '대전1호선': '#0078C2',
  };

  if (subwayMap[raw]) {
    return style(subwayMap[raw], '#FFFFFF', raw, 'subway');
  }

  for (const key of Object.keys(subwayMap)) {
    if (raw.includes(key)) {
      return style(subwayMap[key], '#FFFFFF', key, 'subway');
    }
  }

  if (raw.includes('2호선')) {
    return style('#00A84D', '#FFFFFF', '2호선', 'subway');
  }
  if (raw.includes('신분당')) {
    return style('#D4003B', '#FFFFFF', '신분당선', 'subway');
  }
  if (raw.includes('공항')) {
    return style('#0090D2', '#FFFFFF', '공항철도', 'subway');
  }

  return style('#64748B', '#FFFFFF', '지하철', 'subway');
}

function style(color: string, textColor: string, label: string, type: string): TransitLineStyle {
  return { color, textColor, label, type };
}

function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '').replace(/번/g, '');
}

function normalizeBusNo(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '').replace(/번/g, '').replace(/BUS/g, '');

  const districtVillageMatch = normalized.match(
    /(강남|강동|강북|강서|관악|광진|구로|금천|노원|도봉|동대문|동작|마포|서대문|서초|성동|성북|송파|양천|영등포|용산|은평|종로|중|중랑|수원|성남|고양|용인|부천|안산|안양|남양주|화성|평택|의정부|시흥|파주|김포|광명|군포|오산|이천|구리|하남|의왕|양주|동두천|과천|여주|포천|광주)\d{1,2}(?:-\d{1,2})?/,
  );
  if (districtVillageMatch) {
    return districtVillageMatch[0];
  }

  const routeNoMatch = normalized.match(/(?:^|[^0-9A-Z])([A-Z]?\d{1,4}(?:-\d{1,2})?)/);
  if (routeNoMatch?.[1]) {
    return routeNoMatch[1];
  }

  return normalized;
}
