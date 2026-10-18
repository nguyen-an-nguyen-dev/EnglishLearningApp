import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import type { BattleResultScreenProps } from './types';

export function BattleResultScreen({ currentUserId, error, onBack, result }: BattleResultScreenProps) {
  const currentPlayer = result.scores.find((player) => player.userId === currentUserId);
  const opponent = result.scores.find((player) => player.userId !== currentUserId);
  const title = result.status === 'cancelled'
    ? result.reason === 'left'
      ? 'Bạn đã rời trận đấu'
      : result.reason === 'server_error' ? 'Trận đấu không thể tiếp tục' : 'Đối thủ đã ngắt kết nối'
    : result.winnerUserId === null ? 'Trận đấu hòa!' : result.winnerUserId === currentUserId ? 'Bạn đã chiến thắng!' : 'Đối thủ chiến thắng';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.iconCircle}><Text style={styles.icon}>{result.status === 'completed' && result.winnerUserId === currentUserId ? '🏆' : '⚔️'}</Text></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {result.status === 'completed' ? `Kết quả sau ${result.totalRounds} từ vựng` : 'Trận đấu đã kết thúc.'}
        </Text>
        <View style={styles.scoreRow}>
          {[currentPlayer, opponent].filter((player) => player !== undefined).map((player) => (
            <View key={player.userId} style={styles.scoreCard}>
              <Text style={styles.playerName}>{player.userId === currentUserId ? 'Bạn' : player.name}</Text>
              <Text style={styles.score}>{player.score}</Text>
              <Text style={styles.points}>điểm</Text>
            </View>
          ))}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  iconCircle: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 39, backgroundColor: Colors.primaryLight },
  icon: { fontSize: 34 },
  title: { color: '#203447', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 18 },
  subtitle: { color: '#71818d', fontSize: 14, marginTop: 7 },
  scoreRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 },
  scoreCard: { flex: 1, alignItems: 'center', paddingVertical: 17, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.light.border },
  playerName: { color: '#71818d', fontSize: 13, fontWeight: '700' },
  score: { color: '#203447', fontSize: 30, fontWeight: '900', marginTop: 5 },
  points: { color: '#71818d', fontSize: 11 },
  error: { color: '#b42318', fontSize: 13, textAlign: 'center', marginTop: 16 },
  primaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 24, borderRadius: 9, backgroundColor: Colors.primaryDark },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
