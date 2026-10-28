import type {
  BattleAnswerResult,
  BattleFinish,
  BattleQuestion,
  BattleRoundEnd,
  BattleScore,
} from '@/services/battle';

export interface BattleScreenProps {
  error: string | null;
  onBack: () => void;
}

export interface WaitingScreenProps extends BattleScreenProps {
  opponentName?: string;
  onCancel: () => void;
}

export interface WordBattleScreenProps extends BattleScreenProps {
  currentUserId: number;
  question: BattleQuestion | null;
  roundEnd: BattleRoundEnd | null;
  wrongAnswer: BattleAnswerResult | null;
  scores: BattleScore[];
  onSubmit: (answer: string) => void;
}

export interface BattleResultScreenProps extends BattleScreenProps {
  currentUserId: number;
  result: BattleFinish;
}
