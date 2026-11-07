import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Speech from 'expo-speech';
import YoutubeWebView from './YoutubeWebView';
import type { YoutubeWebViewHandle } from './YoutubeWebView.types';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import { translateText } from '@/services/translations';
import {
  deleteSavedWord,
  deleteVideo,
  getSavedWords,
  getVideo,
  getVideos,
  importVideo,
  saveVideoProgress,
  saveWord,
  type SavedWord,
  type VideoAnalysisModel,
  type VideoLessonDetail,
  type VideoLessonSummary,
  type VideoSegment,
} from '@/services/video';
import { API_BASE_URL } from '@/services/api';

type Screen = 'library' | 'detail' | 'notebook' | 'review';
type PlayerTime = { seconds: number; playing: boolean; seeked?: boolean };

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '');
}

function tokenize(text: string): Array<{ raw: string; clean: string }> {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [])
    .map((raw) => ({ raw, clean: normalizeWord(raw) }))
    .filter((token) => token.clean.length > 0);
}

function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube-nocookie\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function absoluteVideoUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}/${url.replace(/^\/+/, '')}`;
}

const YOUTUBE_PLAYER_HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{box-sizing:border-box}html,body,#player{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0}</style></head>
<body><div id="player"></div><script>
var player=null, rangeStart=0, rangeEnd=0, isPlaying=false, ready=false;
function send(value){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));}
function onYouTubeIframeAPIReady(){player=new YT.Player('player',{videoId:'__VIDEO_ID__',playerVars:{autoplay:0,controls:0,disablekb:1,fs:0,cc_load_policy:0,iv_load_policy:3,rel:0,modestbranding:1,playsinline:1,enablejsapi:1},events:{onReady:function(){ready=true;send({type:'ready'});},onStateChange:function(e){isPlaying=e.data===1;send({type:'state',playing:isPlaying});},onError:function(){send({type:'error'});}}});}
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
window.__playSegment=function(start,end){rangeStart=start;rangeEnd=end;if(!ready||!player)return;player.seekTo(start,true);send({type:'time',seconds:start,playing:false,seeked:true});player.playVideo();};
window.__pauseSegment=function(){if(player&&ready)player.pauseVideo();};
setInterval(function(){if(!player||!ready||!isPlaying)return;var seconds=player.getCurrentTime();if(seconds>=rangeEnd-0.12){player.pauseVideo();return;}if(seconds<rangeStart-0.5){player.seekTo(rangeStart,true);send({type:'time',seconds:rangeStart,playing:false,seeked:true});return;}send({type:'time',seconds:seconds,playing:true});},350);
</script></body></html>`;

interface PlayerProps {
  video: VideoLessonDetail;
  segment: VideoSegment;
  playToken: number;
  onTime: (time: PlayerTime) => void;
  onPlaying: (playing: boolean) => void;
  onPlayerError: (message: string) => void;
}

function YouTubePlayer({ video, segment, playToken, onTime, onPlaying, onPlayerError }: PlayerProps) {
  const webRef = useRef<YoutubeWebViewHandle | null>(null);
  const readyRef = useRef(false);
  const videoId = youtubeId(video.video_url);
  const html = useMemo(
    () => YOUTUBE_PLAYER_HTML.replace('__VIDEO_ID__', videoId ?? ''),
    [videoId],
  );
  const poster = video.thumbnail_url ?? (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);

  useEffect(() => {
    if (!readyRef.current || playToken === 0) return;
    const start = segment.start_ms / 1000;
    const end = segment.end_ms / 1000;
    webRef.current?.injectJavaScript(`window.__playSegment(${start},${end});true;`);
  }, [playToken, segment.end_ms, segment.start_ms]);

  function handleMessage(event: WebViewMessageEvent) {
    let message: { type?: string; seconds?: number; playing?: boolean; seeked?: boolean };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      onPlayerError('Không đọc được phản hồi từ trình phát YouTube.');
      return;
    }
    if (message.type === 'ready') {
      readyRef.current = true;
      if (playToken > 0) {
        const start = segment.start_ms / 1000;
        const end = segment.end_ms / 1000;
        webRef.current?.injectJavaScript(`window.__playSegment(${start},${end});true;`);
      }
    } else if (message.type === 'error') {
      onPlayerError('YouTube không thể phát video này. Hãy kiểm tra quyền phát hoặc thử lại sau.');
    } else if (message.type === 'state') {
      onPlaying(Boolean(message.playing));
    } else if (message.type === 'time' && typeof message.seconds === 'number') {
      onTime({
        seconds: message.seconds,
        playing: Boolean(message.playing),
        seeked: message.seeked,
      });
    }
  }

  if (!videoId) {
    return <Text style={styles.playerError}>Liên kết YouTube của video không hợp lệ.</Text>;
  }

  return (
    <View style={styles.playerFrame}>
      {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <YoutubeWebView
        ref={webRef}
        source={{ html, baseUrl: 'https://www.youtube-nocookie.com' }}
        originWhitelist={['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://s.ytimg.com', 'about:blank']}
        onMessage={handleMessage}
        onError={() => onPlayerError('Không tải được trình phát YouTube. Kiểm tra kết nối mạng rồi thử lại.')}
      />
    </View>
  );
}

function FilePlayer({ video, segment, playToken, onTime, onPlaying, onPlayerError }: PlayerProps) {
  const player = useVideoPlayer(absoluteVideoUrl(video.video_url), (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    instance.loop = false;
    instance.audioMixingMode = 'doNotMix';
  });
  const segmentRef = useRef(segment);
  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const current = segmentRef.current;
    if (currentTime >= current.end_ms / 1000 - 0.12) {
      player.pause();
      onPlaying(false);
      return;
    }
    if (currentTime < current.start_ms / 1000 - 0.5) {
      player.currentTime = current.start_ms / 1000;
      onTime({ seconds: current.start_ms / 1000, playing: false, seeked: true });
      return;
    }
    onTime({ seconds: currentTime, playing: player.playing });
  });
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      onPlayerError(error?.message ?? 'Không thể phát tệp video này.');
    }
  });
  useEffect(() => {
    if (playToken === 0) return;
    player.currentTime = segment.start_ms / 1000;
    onTime({ seconds: segment.start_ms / 1000, playing: false, seeked: true });
    try {
      player.play();
      onPlaying(true);
    } catch (error) {
      onPlayerError(error instanceof Error ? error.message : 'Không thể bắt đầu phát video.');
    }
  }, [playToken, segment.end_ms, segment.start_ms, player, onPlayerError, onPlaying, onTime]);
  return (
    <View style={styles.playerFrame}>
      <VideoView
        player={player}
        style={styles.webView}
        nativeControls={false}
        contentFit="contain"
        allowsPictureInPicture={false}
        allowsVideoFrameAnalysis={false}
      />
    </View>
  );
}

function PracticePlayer(props: PlayerProps) {
  return props.video.provider === 'youtube'
    ? <YouTubePlayer {...props} />
    : <FilePlayer {...props} />;
}

export default function VideoLearningScreen() {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const dark = theme === 'dark';
  const [screen, setScreen] = useState<Screen>('library');
  const [videos, setVideos] = useState<VideoLessonSummary[]>([]);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [video, setVideo] = useState<VideoLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importModel, setImportModel] = useState<VideoAnalysisModel>('bolt');
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [practiceFinished, setPracticeFinished] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [reviewDeck, setReviewDeck] = useState<SavedWord[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewResults, setReviewResults] = useState<boolean[]>([]);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const savedWordsRef = useRef(words);
  const watchRef = useRef(0);
  const savedWatchRef = useRef(0);
  const previousTimeRef = useRef<number | null>(null);
  const videoIdRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const savingProgressRef = useRef(false);

  const palette = useMemo(() => ({
    background: colors.background,
    card: colors.cardBackground,
    border: colors.border,
    text: colors.text,
    muted: colors.textMuted,
    tint: colors.tint,
  }), [colors]);

  const loadLibrary = useCallback(async () => {
    try {
      setError(null);
      const [loadedVideos, loadedWords] = await Promise.all([getVideos(), getSavedWords()]);
      setVideos(loadedVideos);
      setWords(loadedWords);
      savedWordsRef.current = loadedWords;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải thư viện video.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    savedWordsRef.current = words;
  }, [words]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const persistProgress = useCallback(async () => {
    const currentVideoId = videoIdRef.current;
    const seconds = Math.min(durationRef.current, Math.floor(watchRef.current));
    if (!currentVideoId || seconds <= savedWatchRef.current || savingProgressRef.current) return;
    savingProgressRef.current = true;
    try {
      const result = await saveVideoProgress(currentVideoId, seconds);
      if (videoIdRef.current === currentVideoId) {
        savedWatchRef.current = result.progress.watched_seconds;
      }
      setProgressError(null);
      if (videoIdRef.current === currentVideoId) {
        setWatchedSeconds(result.progress.watched_seconds);
      }
      setVideos((current) => current.map((item) => item.id === currentVideoId
        ? { ...item, progress: result.progress }
        : item));
      if (result.progress.completed) {
        setVideo((current) => current && current.id === currentVideoId
          ? { ...current, progress: result.progress }
          : current);
      }
      if (result.xp_earned > 0) {
        setNotice(`Hoàn thành video! Bạn nhận được +${result.xp_earned} XP.`);
      }
    } catch (saveError) {
      setProgressError(saveError instanceof Error ? saveError.message : 'Chưa lưu được tiến độ. Hãy thử lại.');
    } finally {
      savingProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (screen !== 'detail' || !video) return;
    const timer = setInterval(() => { void persistProgress(); }, 6000);
    return () => {
      clearInterval(timer);
      void persistProgress();
    };
  }, [screen, video?.id, persistProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setAppActive(false);
        setPlaying(false);
        setPlayToken(0);
        void persistProgress();
      } else {
        setAppActive(true);
      }
    });
    return () => subscription.remove();
  }, [persistProgress]);

  const openVideo = useCallback(async (videoId: number) => {
    setScreen('detail');
    setDetailLoading(true);
    setError(null);
    setVideo(null);
    setAnswer('');
    setSegmentIndex(0);
    setPracticeFinished(false);
    setPlayToken(0);
    setPlaying(false);
    setPlayerError(null);
    previousTimeRef.current = null;
    videoIdRef.current = videoId;
    try {
      const detail = await getVideo(videoId);
      setVideo(detail);
      watchRef.current = detail.progress?.watched_seconds ?? 0;
      savedWatchRef.current = watchRef.current;
      setWatchedSeconds(watchRef.current);
      durationRef.current = detail.duration_seconds;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải bài học video.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handlePlayerTime = useCallback((time: PlayerTime) => {
    if (time.seeked || previousTimeRef.current === null) {
      previousTimeRef.current = time.seconds;
      return;
    }
    const previous = previousTimeRef.current;
    previousTimeRef.current = time.seconds;
    if (!time.playing) return;
    const delta = time.seconds - previous;
    if (delta <= 0 || delta > 2) return;
    watchRef.current = Math.min(durationRef.current, watchRef.current + delta);
    setWatchedSeconds(Math.floor(watchRef.current));
  }, []);

  const currentSegment = video?.segments[segmentIndex];
  const scriptTokens = useMemo(() => tokenize(currentSegment?.text_en ?? ''), [currentSegment?.text_en]);
  const typedTokens = useMemo(() => tokenize(answer), [answer]);
  const matchedCount = useMemo(() => {
    let count = 0;
    while (count < scriptTokens.length && typedTokens[count]?.clean === scriptTokens[count].clean) count += 1;
    return count;
  }, [scriptTokens, typedTokens]);
  const isComplete = scriptTokens.length > 0 && matchedCount === scriptTokens.length;
  const savedWordKeys = useMemo(
    () => new Set(words.map((word) => normalizeWord(word.word))),
    [words],
  );
  const filteredVideos = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return videos;
    return videos.filter((item) =>
      `${item.title} ${item.description ?? ''} ${item.topic} ${item.cefr_level}`.toLocaleLowerCase().includes(value),
    );
  }, [videos, query]);

  const handlePlayerError = useCallback((message: string) => {
    setPlayerError(message);
    setPlaying(false);
  }, []);

  async function handleImport() {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    setError(null);
    try {
      const imported = await importVideo(url, importModel);
      setVideos((current) => [imported, ...current.filter((item) => item.id !== imported.id)]);
      setImportUrl('');
      setImportOpen(false);
      setNotice('Đã thêm video. Bắt đầu luyện nghe nhé!');
      await openVideo(imported.id);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Không thể phân tích video. Hãy thử lại.');
    } finally {
      setImporting(false);
    }
  }

  function handleDelete(item: VideoLessonSummary) {
    Alert.alert('Xóa video đã nhập?', `Bạn có chắc muốn xóa “${item.title}” khỏi thư viện?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => { void (async () => {
          setDeletingId(item.id);
          try {
            await deleteVideo(item.id);
            setVideos((current) => current.filter((entry) => entry.id !== item.id));
            setNotice('Đã xóa video khỏi thư viện.');
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được video.');
          } finally {
            setDeletingId(null);
          }
        })(); },
      },
    ]);
  }

  async function saveScriptWord(token: { raw: string; clean: string }) {
    if (token.clean.length < 3 || savedWordKeys.has(token.clean) || savingWord || !video) return;
    setSavingWord(token.clean);
    try {
      const known = video.vocabulary.find((entry) => normalizeWord(entry.word) === token.clean);
      let payload = {
        word: token.raw,
        ipa: known?.ipa || undefined,
        meaningVi: known?.meaning_vi || undefined,
        detailVi: known?.detail_vi || undefined,
        videoId: video.id,
      };
      if (!known) {
        const translation = await translateText(token.raw, 'en', 'vi');
        const detail = translation.wordDetails;
        payload = {
          ...payload,
          ipa: detail?.phonetic || undefined,
          meaningVi: detail?.meaning || translation.translatedText || undefined,
          detailVi: [detail?.partOfSpeech, detail?.example].filter(Boolean).join(' · ') || undefined,
        };
      }
      const saved = await saveWord(payload);
      setWords((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setNotice(`Đã lưu từ “${saved.word}” vào sổ từ.`);
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'Không lưu được từ này. Hãy thử lại.');
    } finally {
      setSavingWord(null);
    }
  }

  function nextSegment() {
    if (!isComplete || !video) return;
    if (segmentIndex + 1 >= video.segments.length) {
      setPlaying(false);
      setPracticeFinished(true);
      void persistProgress();
      return;
    }
    setSegmentIndex((index) => index + 1);
    setAnswer('');
    setPlayerError(null);
    previousTimeRef.current = null;
    setPlaying(false);
    setPlayToken((token) => token + 1);
  }

  function startReview(selection: SavedWord[] = words) {
    if (selection.length === 0) return;
    const shuffled = [...selection];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    setReviewDeck(shuffled);
    setReviewIndex(0);
    setReviewRevealed(false);
    setReviewResults([]);
    setScreen('review');
  }

  function rateReview(remembered: boolean) {
    setReviewResults((current) => [...current, remembered]);
    setReviewIndex((index) => index + 1);
    setReviewRevealed(false);
  }

  const headerStyle = { backgroundColor: palette.background, borderBottomColor: palette.border };
  const cardStyle = { backgroundColor: palette.card, borderColor: palette.border };
  const completedCount = videos.filter((item) => item.progress?.completed).length;
  const earnedXp = videos.filter((item) => item.progress?.completed).reduce((sum, item) => sum + item.xp_reward, 0);

  if (screen === 'detail') {
    if (detailLoading) {
      return (
        <View style={[styles.screen, { backgroundColor: palette.background }]}>
          <View style={styles.centerState}><ActivityIndicator color={palette.tint} /><Text style={[styles.stateText, { color: palette.muted }]}>Đang tải bài học…</Text></View>
        </View>
      );
    }
    if (error || !video) {
      return (
        <View style={[styles.screen, { backgroundColor: palette.background }]}>
          <View style={styles.header}>
            <Pressable onPress={() => setScreen('library')}><Text style={[styles.backText, { color: palette.tint }]}>‹  Thư viện video</Text></Pressable>
          </View>
          <View style={styles.centerState}>
            <Text style={[styles.stateText, { color: palette.text }]}>{error ?? 'Không tìm thấy video.'}</Text>
            <Pressable style={[styles.button, { backgroundColor: palette.tint }]} onPress={() => videoIdRef.current && void openVideo(videoIdRef.current)}><Text style={styles.buttonText}>Thử lại</Text></Pressable>
          </View>
        </View>
      );
    }
    const ratio = video.duration_seconds > 0 ? Math.min(100, Math.round((watchedSeconds / video.duration_seconds) * 100)) : 0;
    return (
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: palette.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, headerStyle]}>
          <Pressable onPress={() => { setPlaying(false); setScreen('library'); void loadLibrary(); void persistProgress(); }}>
            <Text style={[styles.backText, { color: palette.tint }]}>‹  Thư viện video</Text>
          </Pressable>
          <Pressable onPress={() => setScreen('notebook')} style={styles.headerAction}>
            <Text style={[styles.headerActionText, { color: palette.tint }]}>📖 Sổ từ</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.eyebrow, { color: palette.tint }]}>LUYỆN NGHE QUA VIDEO · {video.cefr_level}</Text>
          <Text style={[styles.pageTitle, { color: palette.text }]}>{video.title}</Text>
          {video.description ? <Text style={[styles.description, { color: palette.muted }]}>{video.description}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={[styles.pill, { color: palette.tint, backgroundColor: palette.card, borderColor: palette.border }]}>{video.topic}</Text>
            <Text style={[styles.pill, { color: palette.muted, backgroundColor: palette.card, borderColor: palette.border }]}>{video.segments.length} câu</Text>
            {video.progress?.completed ? <Text style={[styles.pill, { color: '#16A34A', backgroundColor: palette.card, borderColor: palette.border }]}>✓ Đã hoàn thành</Text> : null}
          </View>

          {video.segments.length === 0 ? (
            <View style={[styles.card, cardStyle]}><Text style={[styles.bodyText, { color: palette.muted }]}>Video này chưa có phụ đề để luyện nghe.</Text></View>
          ) : practiceFinished ? (
            <View style={[styles.reviewCard, cardStyle]}>
              <Text style={{ fontSize: 44, textAlign: 'center' }}>🏆</Text>
              <Text style={[styles.eyebrow, { color: palette.tint, textAlign: 'center' }]}>BÀI LUYỆN HOÀN TẤT</Text>
              <Text style={[styles.pageTitle, { color: palette.text, textAlign: 'center' }]}>Bạn đã hoàn thành {video.segments.length} câu!</Text>
              <Text style={[styles.description, { color: palette.muted, textAlign: 'center' }]}>Tiếp tục nghe và luyện lại để ghi nhớ tốt hơn.</Text>
              <View style={styles.reviewActions}>
                <Pressable style={[styles.button, { backgroundColor: palette.tint }]} onPress={() => {
                  setSegmentIndex(0);
                  setAnswer('');
                  setPracticeFinished(false);
                  setPlayToken(0);
                  previousTimeRef.current = null;
                }}><Text style={styles.buttonText}>Luyện lại từ đầu</Text></Pressable>
                <Pressable style={[styles.secondaryButton, { borderColor: palette.border }]} onPress={() => { setScreen('library'); void loadLibrary(); }}><Text style={{ color: palette.text, fontWeight: '700' }}>Về thư viện video</Text></Pressable>
              </View>
            </View>
          ) : currentSegment ? (
            <>
              <View style={[styles.playerCard, cardStyle]}>
                <View style={styles.playerHeading}>
                  <Text style={[styles.playerIndex, { color: palette.text }]}>{String(segmentIndex + 1).padStart(2, '0')} / {String(video.segments.length).padStart(2, '0')}</Text>
                  <Text style={[styles.playerTime, { color: palette.muted }]}>{formatClock(currentSegment.start_ms / 1000)} – {formatClock(currentSegment.end_ms / 1000)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Phát lại câu" onPress={() => { setPlayerError(null); setPlayToken((token) => token + 1); }} style={styles.replayButton}><Text style={{ color: palette.tint, fontSize: 20 }}>↻</Text></Pressable>
                </View>
                {appActive ? (
                  <PracticePlayer
                    key={`${video.id}-${currentSegment.id}`}
                    video={video}
                    segment={currentSegment}
                    playToken={playToken}
                    onTime={handlePlayerTime}
                    onPlaying={setPlaying}
                    onPlayerError={handlePlayerError}
                  />
                ) : (
                  <View style={[styles.playerFrame, styles.playerPaused]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Video đã tạm dừng khi rời ứng dụng.</Text>
                  </View>
                )}
                {!playing && appActive ? (
                  <Pressable
                    style={styles.playOverlay}
                    onPress={() => { setPlayerError(null); setPlayToken((token) => token + 1); }}
                    accessibilityRole="button"
                    accessibilityLabel={playToken === 0 ? 'Bắt đầu nghe' : 'Nghe lại câu'}
                  >
                    {video.thumbnail_url ? <Image source={{ uri: video.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                    <View style={styles.playIcon}><Text style={styles.playIconText}>▶</Text></View>
                    <Text style={styles.playLabel}>{playToken === 0 ? 'Bắt đầu nghe' : 'Nghe lại câu'}</Text>
                  </Pressable>
                ) : null}
                {playerError ? <Text style={styles.errorText}>{playerError}</Text> : null}
                <Text style={[styles.helperText, { color: palette.muted }]}>Nghe câu, rồi gõ lại. Video tự dừng ở cuối câu.</Text>
              </View>

              <View style={[styles.card, cardStyle]}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Nghe & gõ lại</Text>
                <View style={styles.scriptWrap}>
                  {scriptTokens.map((token, index) => {
                    const revealed = index < matchedCount;
                    const saved = savedWordKeys.has(token.clean);
                    return (
                      <Pressable
                        key={`${token.clean}-${index}`}
                        disabled={!revealed || token.clean.length < 3 || saved || Boolean(savingWord)}
                        onPress={() => void saveScriptWord(token)}
                        style={[styles.wordChip, revealed ? styles.wordRevealed : styles.wordHidden]}
                      >
                        <Text style={[styles.wordText, { color: revealed ? palette.text : palette.muted }]}>
                          {revealed ? token.raw : '•'.repeat(Math.min(8, token.raw.length))}
                        </Text>
                        {revealed && saved ? <Text style={styles.savedMark}>✓</Text> : null}
                        {savingWord === token.clean ? <ActivityIndicator size="small" color={palette.tint} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.helperText, { color: palette.muted }]}>Chạm vào từ đã mở để lưu vào sổ từ.</Text>
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Nhập câu bạn nghe được…"
                  placeholderTextColor={palette.muted}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  style={[styles.answerInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
                />
                <View style={styles.progressRow}>
                  <Text style={[styles.helperText, { color: palette.muted }]}>{matchedCount}/{scriptTokens.length} từ khớp</Text>
                  <Text style={[styles.progressPercent, { color: palette.tint }]}>{scriptTokens.length ? Math.round((matchedCount / scriptTokens.length) * 100) : 0}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: palette.border }]}><View style={[styles.progressFill, { width: `${scriptTokens.length ? (matchedCount / scriptTokens.length) * 100 : 0}%`, backgroundColor: palette.tint }]} /></View>
                <Pressable
                  disabled={!isComplete}
                  onPress={nextSegment}
                  style={[styles.button, { backgroundColor: isComplete ? palette.tint : palette.border }]}
                >
                  <Text style={[styles.buttonText, !isComplete && { color: palette.muted }]}>{segmentIndex + 1 === video.segments.length ? 'Hoàn thành bài luyện' : 'Câu tiếp theo  →'}</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={[styles.card, cardStyle]}>
            <View style={styles.progressRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Tiến độ video</Text>
              <Text style={[styles.progressPercent, { color: palette.tint }]}>{ratio}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}><View style={[styles.progressFill, { width: `${ratio}%`, backgroundColor: palette.tint }]} /></View>
            <Text style={[styles.helperText, { color: palette.muted }]}>{formatClock(watchedSeconds)} / {formatClock(video.duration_seconds)} đã xem{video.xp_reward > 0 ? ` · +${video.xp_reward} XP khi hoàn thành` : ''}</Text>
            {progressError ? <Text style={styles.errorText}>{progressError}</Text> : null}
            <Pressable onPress={() => void persistProgress()}><Text style={[styles.helperText, { color: palette.tint, marginTop: 10 }]}>Lưu tiến độ ngay</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (screen === 'notebook' || screen === 'review') {
    const reviewDone = reviewIndex >= reviewDeck.length;
    const currentWord = reviewDeck[reviewIndex];
    const missedWords = reviewDeck.filter((_, index) => reviewResults[index] === false);
    const remembered = reviewResults.filter(Boolean).length;
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={[styles.header, headerStyle]}>
          <Pressable onPress={() => setScreen('library')}><Text style={[styles.backText, { color: palette.tint }]}>‹  Thư viện video</Text></Pressable>
          {screen === 'review' ? (
            <Pressable onPress={() => setScreen('notebook')}><Text style={[styles.headerActionText, { color: palette.tint }]}>Sổ từ</Text></Pressable>
          ) : (
            <Pressable onPress={() => startReview()} disabled={!words.length}><Text style={[styles.headerActionText, { color: words.length ? palette.tint : palette.muted }]}>Ôn tập</Text></Pressable>
          )}
        </View>
        {screen === 'notebook' ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.eyebrow, { color: palette.tint }]}>SỔ TỪ CỦA BẠN</Text>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Ôn lại những từ bạn đã lưu.</Text>
            <Text style={[styles.description, { color: palette.muted }]}>{words.length} từ · {words.filter((word) => word.meaning_vi).length} từ có nghĩa</Text>
            {notebookError ? <Text style={styles.errorText}>{notebookError}</Text> : null}
            {words.length === 0 ? (
              <View style={[styles.emptyCard, cardStyle]}><Text style={{ fontSize: 34 }}>📖</Text><Text style={[styles.bodyText, { color: palette.text }]}>Chưa có từ nào được lưu.</Text><Text style={[styles.helperText, { color: palette.muted }]}>Trong bài video, chạm vào từ đã mở sau khi gõ đúng để lưu.</Text></View>
            ) : words.map((word) => (
              <View key={word.id} style={[styles.wordCard, cardStyle]}>
                <View style={styles.wordCardMain}>
                  <Text style={[styles.notebookWord, { color: palette.text }]}>{word.word}</Text>
                  {word.ipa ? <Text style={[styles.helperText, { color: palette.muted }]}>{word.ipa}</Text> : null}
                  <Text style={[styles.bodyText, { color: palette.text }]}>{word.meaning_vi || 'Chưa có nghĩa cho từ này.'}</Text>
                  {word.detail_vi ? <Text style={[styles.helperText, { color: palette.muted }]}>{word.detail_vi}</Text> : null}
                </View>
                <View style={styles.wordActions}>
                  <Pressable onPress={() => Speech.speak(word.word, { language: 'en-US', rate: 0.92 })} style={styles.iconButton}><Text style={{ fontSize: 18 }}>🔊</Text></Pressable>
                  <Pressable onPress={() => Alert.alert('Xóa từ?', `Xóa “${word.word}” khỏi sổ từ?`, [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Xóa', style: 'destructive', onPress: () => { void (async () => {
                      try {
                        await deleteSavedWord(word.word);
                        setWords((current) => current.filter((entry) => entry.id !== word.id));
                      } catch (removeError) {
                        setNotebookError(removeError instanceof Error ? removeError.message : 'Không xóa được từ. Hãy thử lại.');
                      }
                    })(); } },
                  ])} style={styles.iconButton}><Text style={{ fontSize: 18 }}>⌫</Text></Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : reviewDone ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.reviewCard, cardStyle]}>
              <Text style={{ fontSize: 44, textAlign: 'center' }}>🏆</Text>
              <Text style={[styles.eyebrow, { color: palette.tint, textAlign: 'center' }]}>ÔN TẬP SỔ TỪ</Text>
              <Text style={[styles.pageTitle, { color: palette.text, textAlign: 'center' }]}>Xong một lượt ôn!</Text>
              <Text style={[styles.description, { color: palette.muted, textAlign: 'center' }]}>Bạn đã nhớ {remembered}/{reviewDeck.length} từ trong lượt này.</Text>
              <View style={styles.reviewActions}>
                {missedWords.length > 0 ? <Pressable style={[styles.button, { backgroundColor: palette.tint }]} onPress={() => startReview(missedWords)}><Text style={styles.buttonText}>Ôn lại {missedWords.length} từ chưa nhớ</Text></Pressable> : null}
                <Pressable style={[styles.secondaryButton, { borderColor: palette.border }]} onPress={() => startReview()}><Text style={{ color: palette.text, fontWeight: '700' }}>Ôn lại tất cả</Text></Pressable>
                <Pressable onPress={() => setScreen('notebook')}><Text style={[styles.backText, { color: palette.tint }]}>Về sổ từ</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        ) : currentWord ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.reviewCard, cardStyle]}>
              <Text style={[styles.eyebrow, { color: palette.tint }]}>ÔN TẬP · {reviewIndex + 1}/{reviewDeck.length}</Text>
              <View style={[styles.progressTrack, { backgroundColor: palette.border }]}><View style={[styles.progressFill, { width: `${(reviewIndex / reviewDeck.length) * 100}%`, backgroundColor: palette.tint }]} /></View>
              <View style={styles.reviewWordRow}>
                <Text style={[styles.pageTitle, { color: palette.text }]}>{currentWord.word}</Text>
                <Pressable onPress={() => Speech.speak(currentWord.word, { language: 'en-US', rate: 0.92 })}><Text style={{ fontSize: 22 }}>🔊</Text></Pressable>
              </View>
              {currentWord.ipa ? <Text style={[styles.description, { color: palette.muted }]}>{currentWord.ipa}</Text> : null}
              {reviewRevealed ? (
                <View style={[styles.answerCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Text style={[styles.helperText, { color: palette.muted }]}>Nghĩa tiếng Việt</Text>
                  <Text style={[styles.bodyText, { color: palette.text }]}>{currentWord.meaning_vi || 'Chưa có nghĩa cho từ này.'}</Text>
                  {currentWord.detail_vi ? <Text style={[styles.helperText, { color: palette.muted }]}>{currentWord.detail_vi}</Text> : null}
                </View>
              ) : (
                <View style={styles.revealArea}>
                  <Text style={[styles.description, { color: palette.muted, textAlign: 'center' }]}>Hãy tự nhớ nghĩa trước, rồi mở đáp án.</Text>
                  <Pressable style={[styles.button, { backgroundColor: palette.tint }]} onPress={() => setReviewRevealed(true)}><Text style={styles.buttonText}>Hiện nghĩa</Text></Pressable>
                  <Pressable onPress={() => rateReview(false)}><Text style={[styles.backText, { color: palette.muted }]}>Bỏ qua từ này</Text></Pressable>
                </View>
              )}
              {reviewRevealed ? (
                <View style={styles.reviewActions}>
                  <Pressable style={[styles.secondaryButton, { borderColor: '#F59E0B' }]} onPress={() => rateReview(false)}><Text style={{ color: '#D97706', fontWeight: '700' }}>Chưa nhớ</Text></Pressable>
                  <Pressable style={[styles.button, { backgroundColor: '#16A34A' }]} onPress={() => rateReview(true)}><Text style={styles.buttonText}>Đã nhớ</Text></Pressable>
                </View>
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.header, headerStyle]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: palette.tint }]}>HỌC TIẾNG ANH QUA VIDEO</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Nghe thật kỹ. Gõ thật đúng.</Text>
        </View>
        <Pressable onPress={() => { setError(null); setImportOpen((open) => !open); }} style={[styles.headerButton, { backgroundColor: palette.tint }]}>
          <Text style={styles.headerButtonText}>＋ Thêm</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {notice ? <Pressable onPress={() => setNotice(null)} style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></Pressable> : null}
        {importOpen ? (
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Tạo bài luyện từ YouTube</Text>
            <Text style={[styles.helperText, { color: palette.muted }]}>Dán video dưới 5 phút có phụ đề tiếng Anh. Tối đa 20 video đã nhập.</Text>
            <TextInput
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.answerInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
            />
            <View style={styles.metaRow}>
              {(['bolt', 'gemini'] as const).map((model) => (
                <Pressable key={model} onPress={() => setImportModel(model)} style={[styles.modelButton, { borderColor: importModel === model ? palette.tint : palette.border, backgroundColor: palette.card }]}>
                  <Text style={{ color: importModel === model ? palette.tint : palette.text, fontWeight: '700' }}>{importModel === model ? '● ' : '○ '}{model === 'bolt' ? 'Bolt' : 'Gemini'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.reviewActions}>
              <Pressable style={[styles.button, { backgroundColor: palette.tint, opacity: importing || !importUrl.trim() ? 0.55 : 1 }]} onPress={() => void handleImport()} disabled={importing || !importUrl.trim()}>
                {importing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Phân tích video</Text>}
              </Pressable>
              <Pressable style={[styles.secondaryButton, { borderColor: palette.border }]} disabled={importing} onPress={() => setImportOpen(false)}><Text style={{ color: palette.text, fontWeight: '700' }}>Đóng</Text></Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.heroCard, { backgroundColor: dark ? '#123047' : '#E6F9FF', borderColor: palette.border }]}>
          <Text style={[styles.heroTitle, { color: palette.text }]}>Thư viện luyện nghe</Text>
          <Text style={[styles.description, { color: palette.muted }]}>Nghe từng câu, chép lại, mở từ mới và tích lũy tiến độ học.</Text>
          <View style={styles.heroStats}>
            <Text style={[styles.statText, { color: palette.tint }]}>▶ {videos.length} video</Text>
            <Text style={[styles.statText, { color: palette.tint }]}>✓ {completedCount} hoàn thành</Text>
            <Text style={[styles.statText, { color: palette.tint }]}>✦ +{earnedXp} XP</Text>
          </View>
        </View>
        <View style={styles.libraryActions}>
          <Pressable onPress={() => setScreen('notebook')} style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>📖 Sổ từ ({words.length})</Text>
          </Pressable>
          <Pressable onPress={() => { setLoading(true); void loadLibrary(); }} style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.card }]}>
            <Text style={{ color: palette.tint, fontWeight: '700' }}>↻ Làm mới</Text>
          </Pressable>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm video, chủ đề hoặc trình độ…"
          placeholderTextColor={palette.muted}
          style={[styles.searchInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
        />
        {error ? <View style={[styles.card, cardStyle]}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { setLoading(true); void loadLibrary(); }}><Text style={[styles.backText, { color: palette.tint, marginTop: 10 }]}>Thử lại</Text></Pressable></View> : null}
        {loading ? <View style={styles.centerState}><ActivityIndicator color={palette.tint} /><Text style={[styles.stateText, { color: palette.muted }]}>Đang tải thư viện video…</Text></View> : null}
        {!loading && !error && filteredVideos.length === 0 ? (
          <View style={[styles.emptyCard, cardStyle]}><Text style={{ fontSize: 34 }}>🎬</Text><Text style={[styles.bodyText, { color: palette.text }]}>{videos.length ? 'Không tìm thấy video phù hợp.' : 'Thư viện video đang trống.'}</Text><Text style={[styles.helperText, { color: palette.muted }]}>Thêm một video YouTube ngắn có phụ đề tiếng Anh để bắt đầu.</Text></View>
        ) : null}
        {filteredVideos.map((item) => {
          const progress = item.progress?.watched_seconds ?? 0;
          const percent = item.duration_seconds ? Math.min(100, Math.round(progress / item.duration_seconds * 100)) : 0;
          const thumbnail = item.thumbnail_url ?? (youtubeId(item.video_url) ? `https://img.youtube.com/vi/${youtubeId(item.video_url)}/hqdefault.jpg` : null);
          return (
            <View key={item.id} style={[styles.videoCard, cardStyle]}>
              <Pressable onPress={() => void openVideo(item.id)} style={styles.thumbnail}>
                {thumbnail ? <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={styles.thumbnailFallback}><Text style={{ fontSize: 30 }}>🎬</Text></View>}
                <View style={styles.thumbnailPlay}><Text style={styles.playIconText}>▶</Text></View>
                <Text style={styles.durationLabel}>{formatClock(item.duration_seconds)}</Text>
              </Pressable>
              <View style={styles.videoBody}>
                <View style={styles.metaRow}>
                  <Text style={[styles.pill, { color: palette.tint, backgroundColor: palette.background, borderColor: palette.border }]}>{item.cefr_level}</Text>
                  <Text style={[styles.pill, { color: palette.muted, backgroundColor: palette.background, borderColor: palette.border }]} numberOfLines={1}>{item.topic}</Text>
                  {item.is_owned ? <Text style={[styles.pill, { color: '#B45309', backgroundColor: palette.background, borderColor: palette.border }]}>Của bạn</Text> : null}
                </View>
                <Text style={[styles.videoTitle, { color: palette.text }]}>{item.title}</Text>
                {item.description ? <Text style={[styles.videoDescription, { color: palette.muted }]} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.progressRow}><Text style={[styles.helperText, { color: palette.muted }]}>{item.progress?.completed ? 'Đã hoàn thành' : `${percent}% đã xem`}</Text><Text style={[styles.helperText, { color: palette.tint }]}>{item.xp_reward > 0 ? `+${item.xp_reward} XP` : 'Luyện tập'}</Text></View>
                <View style={[styles.progressTrack, { backgroundColor: palette.border }]}><View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: palette.tint }]} /></View>
                <View style={styles.videoActions}>
                  <Pressable onPress={() => void openVideo(item.id)} style={[styles.button, styles.videoOpenButton, { backgroundColor: palette.tint }]}><Text style={styles.buttonText}>{item.progress?.completed ? 'Ôn lại' : 'Bắt đầu luyện'}</Text></Pressable>
                  {item.is_owned ? <Pressable disabled={deletingId === item.id} onPress={() => handleDelete(item)} style={styles.deleteButton}><Text style={{ color: '#DC2626', fontWeight: '700' }}>{deletingId === item.id ? '…' : 'Xóa'}</Text></Pressable> : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerAction: { padding: 8 },
  headerActionText: { fontSize: 14, fontWeight: '800' },
  headerButton: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  headerButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  pageTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 20 },
  bodyText: { fontSize: 15, lineHeight: 21 },
  helperText: { fontSize: 12, lineHeight: 17 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12 },
  heroCard: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 8 },
  heroTitle: { fontSize: 19, fontWeight: '800' },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, marginTop: 3 },
  statText: { fontSize: 12, fontWeight: '800' },
  libraryActions: { flexDirection: 'row', gap: 9 },
  secondaryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  searchInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  videoCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 18 },
  thumbnail: { height: 190, backgroundColor: '#101820', justifyContent: 'center', alignItems: 'center' },
  thumbnailFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17344A' },
  thumbnailPlay: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center' },
  playIconText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginLeft: 3 },
  durationLabel: { position: 'absolute', right: 10, bottom: 10, color: '#FFFFFF', fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  videoBody: { padding: 14, gap: 9 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  pill: { overflow: 'hidden', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
  videoTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
  videoDescription: { fontSize: 13, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 6 },
  progressFill: { height: '100%', borderRadius: 6 },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  videoOpenButton: { flex: 1 },
  deleteButton: { paddingHorizontal: 12, paddingVertical: 10 },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: 'center', gap: 9 },
  centerState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  stateText: { fontSize: 14, textAlign: 'center' },
  backText: { fontSize: 14, fontWeight: '800' },
  playerCard: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 10 },
  playerHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  playerIndex: { fontSize: 13, fontWeight: '800' },
  playerTime: { flex: 1, fontSize: 12, textAlign: 'right' },
  replayButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  playerFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000', overflow: 'hidden', borderRadius: 12 },
  playerPaused: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  webView: { flex: 1, backgroundColor: '#000000' },
  playOverlay: { position: 'absolute', left: 12, right: 12, top: 56, aspectRatio: 16 / 9, backgroundColor: '#000000', borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  playIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  playLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  playerError: { padding: 12, color: '#DC2626', fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13, lineHeight: 19 },
  scriptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wordChip: { minHeight: 34, paddingHorizontal: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  wordHidden: { backgroundColor: 'rgba(148,163,184,0.12)' },
  wordRevealed: { backgroundColor: 'rgba(0,199,255,0.12)' },
  wordText: { fontSize: 14, fontWeight: '700' },
  savedMark: { color: '#16A34A', fontSize: 12, fontWeight: '800' },
  answerInput: { minHeight: 100, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 15, lineHeight: 21 },
  progressPercent: { fontSize: 13, fontWeight: '800' },
  notice: { borderRadius: 12, backgroundColor: '#DCFCE7', padding: 12 },
  noticeText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  modelButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  wordCard: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  wordCardMain: { flex: 1, gap: 5 },
  notebookWord: { fontSize: 19, fontWeight: '800' },
  wordActions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 7 },
  reviewCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 15 },
  reviewWordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  answerCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 7 },
  revealArea: { alignItems: 'center', gap: 14, paddingVertical: 12 },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, alignItems: 'center' },
});
