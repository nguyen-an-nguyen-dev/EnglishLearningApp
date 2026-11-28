export type SpeechHost = 'assemblyai';

export type SpeechLanguage = 'vi' | 'en';

export interface SpeechModelInfo {
  id: string;
  label: string;
  provider: string;
  host: SpeechHost;
  transport?: 'http' | 'websocket';
  /** Languages the model can transcribe; omitted when the model is not limited to one. */
  languages?: SpeechLanguage[];
}

export const SPEECH_MODELS: readonly SpeechModelInfo[] = [
  { id: 'assemblyai-stt-3-7', label: 'AssemblyAI-STT-3.7', provider: 'AssemblyAI', host: 'assemblyai' },
  { id: 'universal-3-5-pro', label: 'Universal-3.5 Pro', provider: 'AssemblyAI', host: 'assemblyai' },
  {
    id: 'assemblyai-stt-3-7-realtime',
    label: 'AssemblyAI-STT-3.7-Realtime',
    provider: 'AssemblyAI',
    host: 'assemblyai',
    transport: 'websocket',
  },
];

export function findSpeechModel(id: string): SpeechModelInfo | undefined {
  return SPEECH_MODELS.find((model) => model.id === id);
}

export function speechModelSupports(id: string, language: SpeechLanguage | null): boolean {
  if (!language) return true;
  const languages = findSpeechModel(id)?.languages;
  return !languages || languages.includes(language);
}