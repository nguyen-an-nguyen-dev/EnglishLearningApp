import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/contexts/theme-context';
import {
  AI_TOPICS,
  createAiChat,
  getAiChat,
  getAiFeedback,
  listAiChats,
  sendAiMessage,
  type AiChat,
  type AiFeedback,
  type AiMessage,
  type AiTopic,
} from '@/services/ai';

function topicLabel(topic: AiTopic): string {
  return AI_TOPICS.find((item) => item.id === topic)?.label ?? topic;
}

function feedbackLabel(type: AiFeedback['type']): string {
  return {
    GRAMMAR: 'Ngữ pháp',
    VOCABULARY: 'Từ vựng',
    TENSE: 'Thì',
    WORD_ORDER: 'Trật tự từ',
    OTHER: 'Gợi ý',
  }[type];
}

export default function TalkScreen() {
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const dark = theme === 'dark';
  const scrollRef = useRef<ScrollView>(null);
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeChat, setActiveChat] = useState<AiChat | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [feedback, setFeedback] = useState<AiFeedback[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    try {
      setError(null);
      setChats(await listAiChats());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử hội thoại.');
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadChats();
  }, [loadChats]));

  async function beginChat(topic: AiTopic) {
    try {
      setError(null);
      setOpeningChat(true);
      const chat = await createAiChat(topic);
      setActiveChat(chat);
      setMessages([]);
      setFeedback([]);
      setHistoryOpen(false);
      setDraft('');
      await loadChats();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể bắt đầu hội thoại.');
    } finally {
      setOpeningChat(false);
    }
  }

  async function openChat(chat: AiChat) {
    try {
      setError(null);
      setOpeningChat(true);
      const [details, storedFeedback] = await Promise.all([
        getAiChat(chat.id),
        getAiFeedback(chat.id),
      ]);
      setActiveChat(details.chat);
      setMessages(details.messages);
      setFeedback(storedFeedback);
      setHistoryOpen(false);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Không thể mở hội thoại này.');
    } finally {
      setOpeningChat(false);
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!activeChat || !content || sending) return;
    try {
      setError(null);
      setSending(true);
      const result = await sendAiMessage(activeChat.id, content);
      setMessages((current) => [...current, result.userMessage, result.aiMessage]);
      setFeedback((current) => [...current, ...result.feedback]);
      setDraft('');
      await loadChats();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  const pageBackground = { backgroundColor: colors.background };
  const cardBackground = { backgroundColor: colors.cardBackground, borderColor: colors.border };

  return (
    <SafeAreaView style={[styles.safeArea, pageBackground]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous conversations"
            onPress={() => setHistoryOpen(true)}
            style={styles.headerButton}
          >
            <Text style={[styles.headerIcon, { color: colors.text }]}>☰</Text>
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Talk with AI</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {activeChat ? topicLabel(activeChat.topic) : 'Luyện nói tiếng Anh'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new conversation"
            onPress={() => {
              setActiveChat(null);
              setMessages([]);
              setFeedback([]);
              setError(null);
            }}
            style={styles.headerButton}
          >
            <Text style={[styles.newChatIcon, { color: colors.tint }]}>＋</Text>
          </Pressable>
        </View>

        {activeChat ? (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={[styles.welcomeCard, cardBackground]}>
                <Text style={styles.welcomeEmoji}>👋</Text>
                <Text style={[styles.welcomeTitle, { color: colors.text }]}>Let’s practice English!</Text>
                <Text style={[styles.welcomeCopy, { color: colors.textMuted }]}>
                  Bắt đầu trò chuyện về {topicLabel(activeChat.topic)}. Mình sẽ giúp bạn luyện tập và giải thích lỗi bằng tiếng Việt.
                </Text>
              </View>
            ) : null}
            {messages.map((message) => {
              const userMessage = message.role === 'USER';
              const messageFeedback = userMessage
                ? feedback.filter((item) => item.message_id === message.id)
                : [];
              return (
                <View key={message.id} style={[styles.messageGroup, userMessage && styles.userMessageGroup]}>
                  <View
                    style={[
                      styles.messageBubble,
                      userMessage
                        ? styles.userBubble
                        : [styles.aiBubble, cardBackground],
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      { color: userMessage ? '#FFFFFF' : colors.text },
                    ]}>
                      {message.content}
                    </Text>
                  </View>
                  {messageFeedback.map((item, index) => (
                    <View
                      key={`${message.id}-${item.type}-${index}`}
                      style={[styles.feedbackCard, cardBackground]}
                    >
                      <Text style={[styles.feedbackType, { color: colors.tint }]}>{feedbackLabel(item.type)}</Text>
                      <Text style={[styles.feedbackLine, { color: colors.textMuted }]}>
                        Bạn viết: <Text style={[styles.feedbackEmphasis, { color: colors.text }]}>{item.original_text}</Text>
                      </Text>
                      <Text style={[styles.feedbackLine, { color: colors.textMuted }]}>
                        Gợi ý: <Text style={[styles.feedbackEmphasis, { color: colors.text }]}>{item.corrected_text}</Text>
                      </Text>
                      <Text style={[styles.feedbackExplanation, { color: colors.textMuted }]}>{item.explanation}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
            {sending ? (
              <View style={[styles.thinking, cardBackground]}>
                <ActivityIndicator size="small" color={colors.tint} />
                <Text style={[styles.thinkingText, { color: colors.textMuted }]}>Đang soạn câu trả lời...</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
            <View style={styles.homeIntro}>
       
              <Text style={[styles.homeTitle, { color: colors.text }]}>What would you like to talk about?</Text>
              <Text style={[styles.homeDescription, { color: colors.textMuted }]}>
                Chọn một chủ đề để bắt đầu cuộc trò chuyện. AI sẽ điều chỉnh tiếng Anh theo trình độ và bài học của bạn.
              </Text>
            </View>
            <View style={styles.topicGrid}>
              {AI_TOPICS.map((topic) => (
                <Pressable
                  key={topic.id}
                  accessibilityRole="button"
                  disabled={openingChat}
                  onPress={() => void beginChat(topic.id)}
                  style={[styles.topicCard, cardBackground]}
                >
                  <Text style={styles.topicIcon}>{topic.icon}</Text>
                  <Text style={[styles.topicLabel, { color: colors.text }]}>{topic.label}</Text>
                </Pressable>
              ))}
            </View>
            {openingChat ? <ActivityIndicator color={colors.tint} style={styles.centerLoader} /> : null}
          </ScrollView>
        )}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: dark ? '#351C1C' : '#FFF1F0' }]}>
            <Text accessibilityRole="alert" style={[styles.errorText, { color: dark ? '#FF9A93' : '#A52E3C' }]}>{error}</Text>
            <Pressable onPress={() => setError(null)} accessibilityLabel="Dismiss error">
              <Text style={[styles.dismissError, { color: colors.textMuted }]}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {activeChat ? (
          <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TextInput
              accessibilityLabel="Message in English"
              editable={!sending}
              multiline
              onChangeText={setDraft}
              onSubmitEditing={() => void sendMessage()}
              placeholder="Type a message in English..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              style={[styles.input, cardBackground, { color: colors.text }]}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || sending}
              onPress={() => void sendMessage()}
              style={[styles.sendButton, { backgroundColor: colors.tint, opacity: !draft.trim() || sending ? 0.5 : 1 }]}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
        transparent
        visible={historyOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setHistoryOpen(false)} />
          <View style={[styles.historyPanel, { backgroundColor: colors.background }]}>
            <View style={[styles.historyHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>Previous conversations</Text>
              <Pressable accessibilityLabel="Close history" onPress={() => setHistoryOpen(false)}>
                <Text style={[styles.closeButton, { color: colors.textMuted }]}>×</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActiveChat(null);
                setMessages([]);
                setFeedback([]);
                setHistoryOpen(false);
              }}
              style={[styles.newConversationRow, { borderColor: colors.border }]}
            >
              <Text style={[styles.newConversationText, { color: colors.tint }]}>＋  New conversation</Text>
            </Pressable>
            {loadingChats ? <ActivityIndicator color={colors.tint} style={styles.centerLoader} /> : null}
            <ScrollView contentContainerStyle={styles.historyList}>
              {chats.map((chat) => (
                <Pressable
                  key={chat.id}
                  accessibilityRole="button"
                  onPress={() => void openChat(chat)}
                  style={[styles.historyItem, cardBackground, activeChat?.id === chat.id && { borderColor: colors.tint }]}
                >
                  <Text style={styles.historyEmoji}>{AI_TOPICS.find((item) => item.id === chat.topic)?.icon ?? '💬'}</Text>
                  <View style={styles.historyCopy}>
                    <Text numberOfLines={1} style={[styles.historyItemTitle, { color: colors.text }]}>
                      {chat.title || topicLabel(chat.topic)}
                    </Text>
                    <Text numberOfLines={1} style={[styles.historyPreview, { color: colors.textMuted }]}>
                      {chat.last_message || topicLabel(chat.topic)}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {!loadingChats && chats.length === 0 ? (
                <Text style={[styles.noHistory, { color: colors.textMuted }]}>Chưa có cuộc trò chuyện nào.</Text>
              ) : null}
            </ScrollView>
            {openingChat ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator color={colors.tint} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 23 },
  newChatIcon: { fontSize: 30, lineHeight: 34, fontWeight: '500' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  homeContent: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 28 },
  homeIntro: { alignItems: 'center', paddingHorizontal: 10, marginBottom: 24 },
  homeEmoji: { fontSize: 42, marginBottom: 10 },
  homeTitle: { fontSize: 21, lineHeight: 28, textAlign: 'center', fontWeight: '800' },
  homeDescription: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  topicCard: {
    width: '48%',
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    gap: 9,
  },
  topicIcon: { fontSize: 23 },
  topicLabel: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  centerLoader: { marginVertical: 20 },
  messageList: { flexGrow: 1, padding: 16, paddingBottom: 22, gap: 12 },
  welcomeCard: { alignItems: 'center', padding: 20, marginTop: 16, borderWidth: 1, borderRadius: 16 },
  welcomeEmoji: { fontSize: 30 },
  welcomeTitle: { fontSize: 17, fontWeight: '800', marginTop: 9 },
  welcomeCopy: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  messageGroup: { maxWidth: '88%', alignSelf: 'flex-start', gap: 7 },
  userMessageGroup: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17 },
  userBubble: { backgroundColor: Colors.primaryDark, borderBottomRightRadius: 5 },
  aiBubble: { borderWidth: 1, borderBottomLeftRadius: 5 },
  messageText: { fontSize: 14, lineHeight: 21 },
  feedbackCard: { width: '100%', padding: 11, borderWidth: 1, borderRadius: 12, gap: 5 },
  feedbackType: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  feedbackLine: { fontSize: 12, lineHeight: 18 },
  feedbackEmphasis: { fontWeight: '700' },
  feedbackExplanation: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  thinking: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderWidth: 1, borderRadius: 14 },
  thinkingText: { fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 112, minHeight: 44, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 9, fontSize: 14 },
  sendButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  sendButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  dismissError: { fontSize: 20, paddingHorizontal: 4 },
  modalRoot: { flex: 1 },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)' },
  historyPanel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '86%', maxWidth: 380, paddingTop: Platform.OS === 'ios' ? 48 : 20, zIndex: 1 },
  historyHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  historyTitle: { fontSize: 16, fontWeight: '800' },
  closeButton: { fontSize: 28, lineHeight: 30, paddingHorizontal: 7 },
  newConversationRow: { marginHorizontal: 12, marginTop: 13, marginBottom: 8, padding: 13, borderWidth: 1, borderRadius: 12 },
  newConversationText: { fontSize: 14, fontWeight: '800' },
  historyList: { padding: 12, gap: 9 },
  historyItem: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderRadius: 12 },
  historyEmoji: { fontSize: 22 },
  historyCopy: { flex: 1, gap: 4 },
  historyItemTitle: { fontSize: 13, fontWeight: '800' },
  historyPreview: { fontSize: 11 },
  noHistory: { fontSize: 13, textAlign: 'center', marginTop: 20 },
  historyLoading: { position: 'absolute', top: '48%', alignSelf: 'center' },
});
