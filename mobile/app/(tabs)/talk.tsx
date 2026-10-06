import TabDestination from '@/components/TabDestination';

export default function TalkScreen() {
  return (
    <TabDestination
      title="Talk with AI"
      message="Trò chuyện tiếng Anh"
      symbol={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
    />
  );
}