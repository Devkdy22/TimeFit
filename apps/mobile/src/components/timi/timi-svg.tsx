import type { SvgProps } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

export type TimiVariant = 'mint' | 'orange' | 'red';
type TimiPose = 'default' | 'badge-grab' | 'badge-grab-hand-left' | 'badge-grab-hand-right';

const mintXml = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="97" rx="22" ry="5" fill="#1F2A44" fill-opacity="0.08"/><ellipse cx="46" cy="90" rx="5" ry="6" transform="rotate(10 46 90)" fill="#5EC7BE"/><ellipse cx="74" cy="90" rx="5" ry="6" transform="rotate(-10 74 90)" fill="#5EC7BE"/><rect x="96.4641" y="49.8039" width="15" height="9" rx="4.5" transform="rotate(60 96.4641 49.8039)" fill="#5EC7BE"/><rect x="16.0981" y="63.0263" width="15" height="9" rx="4.5" transform="rotate(-60 16.0981 63.0263)" fill="#5EC7BE"/><circle cx="60" cy="54" r="36" fill="#6ED6CD"/><circle cx="60" cy="54" r="33" fill="#E4FFFD"/><rect x="58.9394" y="19" width="2.12121" height="9.40298" rx="1.06061" fill="#6ED6CD"/><rect x="58.9394" y="79.597" width="2.12121" height="9.40298" rx="1.06061" fill="#6ED6CD"/><rect x="95" y="53.4776" width="2.08955" height="9.54545" rx="1.04478" transform="rotate(90 95 53.4776)" fill="#6ED6CD"/><rect x="34.5455" y="53.4776" width="2.08955" height="9.54545" rx="1.04478" transform="rotate(90 34.5455 53.4776)" fill="#6ED6CD"/><ellipse cx="48" cy="46" rx="3" ry="4" fill="#1F2A44"/><ellipse cx="72" cy="46" rx="3" ry="4" fill="#1F2A44"/><rect x="50" y="53" width="20" height="4" rx="2" fill="#1F2A44"/></svg>`;
const mintBadgeGrabXml = mintXml
  .replace(
    '<rect x="96.4641" y="49.8039" width="15" height="9" rx="4.5" transform="rotate(60 96.4641 49.8039)" fill="#5EC7BE"/>',
    '<rect x="97.8" y="49.8" width="18" height="10" rx="5" transform="rotate(-44 97.8 49.8)" fill="#5EC7BE"/>',
  )
  .replace(
    '<rect x="16.0981" y="63.0263" width="15" height="9" rx="4.5" transform="rotate(-60 16.0981 63.0263)" fill="#5EC7BE"/>',
    '<rect x="3.2" y="53.2" width="18" height="10" rx="5" transform="rotate(44 3.2 53.2)" fill="#5EC7BE"/>',
  );
const mintBadgeGrabHeadXml = mintBadgeGrabXml
  .replace(
    '<rect x="97.8" y="49.8" width="18" height="10" rx="5" transform="rotate(-44 97.8 49.8)" fill="#5EC7BE"/>',
    '',
  )
  .replace(
    '<rect x="3.2" y="53.2" width="18" height="10" rx="5" transform="rotate(44 3.2 53.2)" fill="#5EC7BE"/>',
    '',
  );
const mintBadgeGrabHandLeftXml =
  '<svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12.5" y="15.2" width="15" height="9" rx="4.5" transform="rotate(-55 12.5 15.2)" fill="#5EC7BE"/></svg>';
const mintBadgeGrabHandRightXml =
  '<svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9.2" y="2.6" width="15" height="9" rx="4.5" transform="rotate(55 9.2 2.6)" fill="#5EC7BE"/></svg>';

const orangeXml = mintXml.replaceAll('#5EC7BE', '#F4A357').replaceAll('#6ED6CD', '#FFC27A');
const redXml = mintXml.replaceAll('#5EC7BE', '#F07A8A').replaceAll('#6ED6CD', '#FF9EAD');
const armColorMap: Record<TimiVariant, string> = {
  mint: '#5EC7BE',
  orange: '#F4A357',
  red: '#F07A8A',
};

function buildHandXml({
  x,
  y,
  angleDeg,
  color,
}: {
  x: number;
  y: number;
  angleDeg: number;
  color: string;
}) {
  return `<svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="15" height="9" rx="4.5" transform="rotate(${angleDeg} ${x} ${y})" fill="${color}"/></svg>`;
}

const timiXmlMap: Record<TimiVariant, Record<TimiPose, string>> = {
  mint: {
    default: mintXml,
    'badge-grab': mintBadgeGrabHeadXml,
    'badge-grab-hand-left': mintBadgeGrabHandLeftXml,
    'badge-grab-hand-right': mintBadgeGrabHandRightXml,
  },
  orange: {
    default: orangeXml,
    'badge-grab': mintBadgeGrabHeadXml
      .replaceAll('#5EC7BE', '#F4A357')
      .replaceAll('#6ED6CD', '#FFC27A'),
    'badge-grab-hand-left': mintBadgeGrabHandLeftXml.replaceAll('#5EC7BE', '#F4A357'),
    'badge-grab-hand-right': mintBadgeGrabHandRightXml.replaceAll('#5EC7BE', '#F4A357'),
  },
  red: {
    default: redXml,
    'badge-grab': mintBadgeGrabHeadXml
      .replaceAll('#5EC7BE', '#F07A8A')
      .replaceAll('#6ED6CD', '#FF9EAD'),
    'badge-grab-hand-left': mintBadgeGrabHandLeftXml.replaceAll('#5EC7BE', '#F07A8A'),
    'badge-grab-hand-right': mintBadgeGrabHandRightXml.replaceAll('#5EC7BE', '#F07A8A'),
  },
};

type TimiSvgProps = SvgProps & {
  variant: TimiVariant;
  pose?: TimiPose;
  handAngleDeg?: number;
};

export function TimiSvg({ variant, pose = 'default', handAngleDeg, ...props }: TimiSvgProps) {
  let xml = timiXmlMap[variant][pose];

  if (pose === 'badge-grab-hand-left' && typeof handAngleDeg === 'number') {
    xml = buildHandXml({
      x: 12.5,
      y: 15.2,
      angleDeg: handAngleDeg,
      color: armColorMap[variant],
    });
  }

  if (pose === 'badge-grab-hand-right' && typeof handAngleDeg === 'number') {
    xml = buildHandXml({
      x: 9.2,
      y: 2.6,
      angleDeg: handAngleDeg,
      color: armColorMap[variant],
    });
  }

  return <SvgXml xml={xml} {...props} />;
}
