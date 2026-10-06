import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

const tabSymbols = {
  learning: { ios: 'map.fill', android: 'map', web: 'map' },
  ranking: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  translate: { ios: 'character.bubble.fill', android: 'translate', web: 'translate' },
  talk: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00C7FF',
        tabBarInactiveTintColor: '#74838d',
        tabBarStyle: {
          height: 68,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: '#ffffff',
          borderTopColor: '#dce8ed',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lộ trình',
          tabBarIcon: ({ color }) => (
            <SymbolView name={tabSymbols.learning} tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color }) => (
            <SymbolView name={tabSymbols.ranking} tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="translate"
        options={{
          title: 'Dịch',
          tabBarIcon: ({ color }) => (
            <SymbolView name={tabSymbols.translate} tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="talk"
        options={{
          title: 'Talk AI',
          tabBarIcon: ({ color }) => (
            <SymbolView name={tabSymbols.talk} tintColor={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color }) => (
            <SymbolView name={tabSymbols.settings} tintColor={color} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}
