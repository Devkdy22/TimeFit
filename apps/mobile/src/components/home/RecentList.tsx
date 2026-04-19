import { View } from 'react-native';
import { RecentItem } from './RecentItem';
import type { RecentDestination } from './types';

interface RecentListProps {
  items: RecentDestination[];
}

export function RecentList({ items }: RecentListProps) {
  return (
    <View>
      {items.map((item, index) => (
        <RecentItem key={`${item.id}-${index}`} item={item} />
      ))}
    </View>
  );
}
