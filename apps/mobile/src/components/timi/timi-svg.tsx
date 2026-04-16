import type { SvgProps } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

export type TimiVariant = 'mint' | 'orange' | 'red';

const mintXml = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="97" rx="22" ry="5" fill="#1F2A44" fill-opacity="0.08"/><ellipse cx="46" cy="90" rx="5" ry="6" transform="rotate(10 46 90)" fill="#5EC7BE"/><ellipse cx="74" cy="90" rx="5" ry="6" transform="rotate(-10 74 90)" fill="#5EC7BE"/><rect x="96.4641" y="49.8039" width="15" height="9" rx="4.5" transform="rotate(60 96.4641 49.8039)" fill="#5EC7BE"/><rect x="16.0981" y="63.0263" width="15" height="9" rx="4.5" transform="rotate(-60 16.0981 63.0263)" fill="#5EC7BE"/><circle cx="60" cy="54" r="36" fill="#6ED6CD"/><circle cx="60" cy="54" r="33" fill="#E4FFFD"/><rect x="58.9394" y="19" width="2.12121" height="9.40298" rx="1.06061" fill="#6ED6CD"/><rect x="58.9394" y="79.597" width="2.12121" height="9.40298" rx="1.06061" fill="#6ED6CD"/><rect x="95" y="53.4776" width="2.08955" height="9.54545" rx="1.04478" transform="rotate(90 95 53.4776)" fill="#6ED6CD"/><rect x="34.5455" y="53.4776" width="2.08955" height="9.54545" rx="1.04478" transform="rotate(90 34.5455 53.4776)" fill="#6ED6CD"/><ellipse cx="48" cy="46" rx="3" ry="4" fill="#1F2A44"/><ellipse cx="72" cy="46" rx="3" ry="4" fill="#1F2A44"/><rect x="50" y="53" width="20" height="4" rx="2" fill="#1F2A44"/></svg>`;

const orangeXml = mintXml.replaceAll('#5EC7BE', '#F4A357').replaceAll('#6ED6CD', '#FFC27A');
const redXml = mintXml.replaceAll('#5EC7BE', '#F07A8A').replaceAll('#6ED6CD', '#FF9EAD');

const timiXmlMap: Record<TimiVariant, string> = {
  mint: mintXml,
  orange: orangeXml,
  red: redXml,
};

export function TimiSvg({ variant, ...props }: SvgProps & { variant: TimiVariant }) {
  return <SvgXml xml={timiXmlMap[variant]} {...props} />;
}

