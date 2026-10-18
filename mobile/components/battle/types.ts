import type {
  BattleAnswerResult,
  BattleFinish,
  BattleQuestion,
  BattleScore,
  BattleStart,
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
  game: BattleStart;
  question: BattleQuestion | null;
  answerResult: BattleAnswerResult | null;
  scores: BattleScore[];
  submitted: boolean;
  onSubmit: (answer: string) => void;
}

export interface BattleResultScreenProps extends BattleScreenProps {
  currentUserId: number;
  result: BattleFinish;
}
