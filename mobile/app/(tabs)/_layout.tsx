import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';

const tabSymbols = {
  learning: { ios: 'map.fill', android: 'map', web: 'map' },
  ranking: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  translate: { ios: 'character.bubble.fill', android: 'translate', web: 'translate' },
  talk: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
} as const;

export default function TabLayout() {
  const { theme } = useAppTheme();
  const colors = Colors[theme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          height: 68,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
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
          title: 'Chat AI',
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
