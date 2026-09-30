import { SymbolView } from 'expo-symbols';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface TabDestinationProps {
  title: string;
  message: string;
  symbol: { ios: string; android: string; web: string };
}

export default function TabDestination({ title, message, symbol }: TabDestinationProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <SymbolView name={symbol} tintColor="#00A9D8" size={38} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F8FA',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  iconWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#DFF7FD',
    marginBottom: 18,
  },
  title: {
    color: '#14313D',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: '#71818A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});