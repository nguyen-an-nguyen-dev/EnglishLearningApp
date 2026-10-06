import TabDestination from '@/components/TabDestination';

export default function TranslateScreen() {
  return (
    <TabDestination
      title="Dịch"
      message="Công cụ dịch"
      symbol={{ ios: 'character.bubble.fill', android: 'translate', web: 'translate' }}
    />
  );
}