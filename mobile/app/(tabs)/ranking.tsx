import TabDestination from '@/components/TabDestination';

export default function RankingScreen() {
  return (
    <TabDestination
      title="Ranking"
      message="Chưa có dữ liệu xếp hạng."
      symbol={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
    />
  );
}