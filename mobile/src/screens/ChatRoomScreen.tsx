import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { MessageBubble } from '../components/MessageBubble';
import { COLORS } from '../config/constants';
import { Message } from '../types';
import { socketService } from '../services/socket';
import { MediaService } from '../services/media';
import { GroupInfoScreen } from './GroupInfoScreen';
import { MediaGalleryScreen } from './MediaGalleryScreen';

const DISAPPEARING_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '24 Hours', seconds: 86400 },
  { label: '7 Days', seconds: 604800 },
  { label: '90 Days', seconds: 7776000 },
];

export const ChatRoomScreen: React.FC = () => {
  const {
    activeConversation,
    setActiveConversation,
    messages,
    sendMessage,
    sendVoiceNote,
    sendImageMessage,
    sendDocumentMessage,
    sendLocationMessage,
    addReaction,
    toggleStarMessage,
    deleteMessage,
    setDisappearingDuration,
    clearChatHistory,
    currentUser,
    startCall,
    fetchMessages,
    typingUsers,
    recordingUsers,
    isDarkMode,
  } = useStore();

  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const convId = activeConversation?.id || '';
  const currentMessages = messages[convId] || [];

  const targetParticipant =
    activeConversation?.participants.find((p) => p.id !== currentUser?.id) ||
    activeConversation?.participants[0] || {
      id: 'target',
      name: activeConversation?.name || 'Contact',
      phone: '',
    };

  useEffect(() => {
    if (convId) {
      fetchMessages(convId);
    }
  }, [convId]);

  // Handle typing broadcast
  const handleTextChange = (text: string) => {
    setInputText(text);

    socketService.sendTyping(convId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTyping(convId, false);
    }, 2000);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    socketService.sendTyping(convId, false);
    sendMessage(
      convId,
      inputText.trim(),
      'text',
      replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : undefined
    );

    setInputText('');
    setReplyingTo(null);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Real voice recording with MediaService
  const startRecording = async () => {
    const started = await MediaService.startVoiceRecording();
    if (!started) {
      Alert.alert('Permission needed', 'Audio recording permission is required to send voice notes.');
      return;
    }
    setIsRecordingVoice(true);
    setRecordSeconds(0);
    socketService.sendRecording(convId, true);

    recordingTimerRef.current = setInterval(() => {
      setRecordSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    socketService.sendRecording(convId, false);
    setIsRecordingVoice(false);

    const recordingResult = await MediaService.stopVoiceRecording();
    if (recordingResult && recordingResult.durationSec >= 1) {
      await sendVoiceNote(convId, recordingResult);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const cancelRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    socketService.sendRecording(convId, false);
    setIsRecordingVoice(false);
    setRecordSeconds(0);
    await MediaService.stopVoiceRecording();
  };

  const handleSendAttachment = async (type: string) => {
    setShowAttachments(false);
    if (type === 'camera') {
      const photo = await MediaService.takePhoto();
      if (photo) {
        await sendImageMessage(convId, photo);
      }
    } else if (type === 'image') {
      const image = await MediaService.pickImage();
      if (image) {
        await sendImageMessage(convId, image);
      }
    } else if (type === 'document') {
      const doc = await MediaService.pickDocument();
      if (doc) {
        await sendDocumentMessage(convId, doc);
      }
    } else if (type === 'location') {
      const loc = await MediaService.getCurrentLocation();
      if (loc) {
        await sendLocationMessage(convId, loc);
      } else {
        Alert.alert('Location unavailable', 'Please enable location permissions.');
      }
    }
  };

  const activeTyping = typingUsers[convId];
  const activeRecording = recordingUsers[convId];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat Room Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setActiveConversation(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => {
              if (activeConversation?.isGroup) {
                setShowGroupInfo(true);
              } else {
                setShowMediaGallery(true);
              }
            }}
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {targetParticipant.name[0] || 'U'}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeConversation?.name}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {activeRecording
                  ? `${activeRecording} is recording audio... 🎤`
                  : activeTyping
                  ? `${activeTyping} is typing...`
                  : activeConversation?.isGroup
                  ? `${activeConversation.participants.length} members`
                  : targetParticipant.isOnline
                  ? 'Online'
                  : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => startCall(targetParticipant, 'video', convId)}
            >
              <Ionicons name="videocam" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => startCall(targetParticipant, 'voice', convId)}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Disappearing Messages Notice Banner */}
        {activeConversation?.disappearingDuration ? (
          <View style={styles.disappearingBanner}>
            <Ionicons name="timer-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.disappearingBannerText}>
              Disappearing messages are ON (
              {activeConversation.disappearingDuration === 86400
                ? '24 hours'
                : activeConversation.disappearingDuration === 604800
                ? '7 days'
                : '90 days'}
              )
            </Text>
          </View>
        ) : null}

        {/* Messages Body */}
        <View style={[styles.chatBackground, isDarkMode && styles.chatBackgroundDark]}>
          <FlatList
            ref={flatListRef}
            data={currentMessages}
            keyExtractor={(item, index) => `${item.id || index}-${index}`}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOutgoing={item.senderId === currentUser?.id}
                onReaction={(emoji) => addReaction(item.id, emoji, convId)}
                onReply={(msg) => setReplyingTo(msg)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <View style={styles.encryptionCard}>
                  <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.encryptionCardText}>
                    Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
                  </Text>
                </View>
              </View>
            }
          />

          {/* Reply Preview Banner */}
          {replyingTo && (
            <View style={[styles.replyBanner, isDarkMode && styles.replyBannerDark]}>
              <View style={styles.replyContent}>
                <Text style={styles.replyAuthor}>{replyingTo.senderName}</Text>
                <Text style={styles.replySnippet} numberOfLines={1}>
                  {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyClose}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Voice Recording Active Bar */}
          {isRecordingVoice ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingPulse}>
                <View style={styles.redDot} />
                <Text style={styles.recordingTimer}>
                  {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')}
                </Text>
              </View>

              <TouchableOpacity style={styles.cancelRecordBtn} onPress={cancelRecording}>
                <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
                <Text style={styles.cancelRecordText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sendRecordBtn} onPress={stopAndSendRecording}>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            /* Input Bar */
            <View
              style={[
                styles.inputContainer,
                {
                  paddingBottom: Platform.OS === 'android' ? (isKeyboardVisible ? 6 : 10) : 6,
                },
              ]}
            >
              <View style={[styles.inputCard, isDarkMode && styles.inputCardDark]}>
                <TouchableOpacity style={styles.inputIcon}>
                  <Ionicons name="happy-outline" size={24} color={isDarkMode ? '#8696A0' : COLORS.textMuted} />
                </TouchableOpacity>

                <TextInput
                  style={[styles.textInput, isDarkMode && styles.textDark]}
                  placeholder="Message"
                  placeholderTextColor={isDarkMode ? '#8696A0' : COLORS.textMuted}
                  value={inputText}
                  onChangeText={handleTextChange}
                  multiline
                  textAlignVertical="center"
                />

                <TouchableOpacity
                  style={styles.inputIcon}
                  onPress={() => setShowAttachments(!showAttachments)}
                >
                  <Ionicons name="attach" size={24} color={isDarkMode ? '#8696A0' : COLORS.textMuted} />
                </TouchableOpacity>

                {!inputText.trim() && (
                  <TouchableOpacity
                    style={styles.inputIcon}
                    onPress={() => handleSendAttachment('image')}
                  >
                    <Ionicons name="camera" size={24} color={isDarkMode ? '#8696A0' : COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {inputText.trim() ? (
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                  <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.sendBtn} onPress={startRecording}>
                  <Ionicons name="mic" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Attachment Options Modal */}
        <Modal
          visible={showAttachments}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAttachments(false)}
        >
          <TouchableOpacity
            style={styles.attachmentBackdrop}
            activeOpacity={1}
            onPress={() => setShowAttachments(false)}
          >
            <View style={[styles.attachmentCard, isDarkMode && styles.attachmentCardDark]}>
              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={() => handleSendAttachment('document')}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#5F66CD' }]}>
                  <Ionicons name="document-text" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.attachLabel, isDarkMode && styles.textDark]}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={() => handleSendAttachment('image')}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#D3396D' }]}>
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.attachLabel, isDarkMode && styles.textDark]}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={() => handleSendAttachment('image')}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#AC44CF' }]}>
                  <Ionicons name="images" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.attachLabel, isDarkMode && styles.textDark]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={() => handleSendAttachment('location')}
              >
                <View style={[styles.attachCircle, { backgroundColor: '#00A884' }]}>
                  <Ionicons name="location" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.attachLabel, isDarkMode && styles.textDark]}>Location</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Chat Menu Dropdown Modal */}
        <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={[styles.dropdownCard, isDarkMode && styles.dropdownCardDark]}>
              <TouchableOpacity
                style={styles.dropdownRow}
                onPress={() => {
                  setShowMenu(false);
                  if (activeConversation?.isGroup) {
                    setShowGroupInfo(true);
                  } else {
                    setShowMediaGallery(true);
                  }
                }}
              >
                <Ionicons
                  name={activeConversation?.isGroup ? 'people-outline' : 'person-outline'}
                  size={20}
                  color={COLORS.primaryLight}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.dropdownText, isDarkMode && styles.textDark]}>
                  {activeConversation?.isGroup ? 'Group info' : 'Contact info'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownRow}
                onPress={() => {
                  setShowMenu(false);
                  setShowMediaGallery(true);
                }}
              >
                <Ionicons name="images-outline" size={20} color={COLORS.primaryLight} style={{ marginRight: 10 }} />
                <Text style={[styles.dropdownText, isDarkMode && styles.textDark]}>Media, links, and docs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownRow}
                onPress={() => {
                  setShowMenu(false);
                  setShowDisappearingModal(true);
                }}
              >
                <Ionicons name="timer-outline" size={20} color={COLORS.primaryLight} style={{ marginRight: 10 }} />
                <Text style={[styles.dropdownText, isDarkMode && styles.textDark]}>Disappearing messages</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownRow}
                onPress={() => {
                  setShowMenu(false);
                  Alert.alert('Clear Chat', 'Clear all messages in this conversation?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: () => clearChatHistory(convId) },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} style={{ marginRight: 10 }} />
                <Text style={[styles.dropdownText, { color: COLORS.danger }]}>Clear chat</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Disappearing Messages Duration Picker Modal */}
        <Modal
          visible={showDisappearingModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDisappearingModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.disappearingCard, isDarkMode && styles.disappearingCardDark]}>
              <Text style={[styles.modalTitle, isDarkMode && styles.textDark]}>Disappearing Messages</Text>
              <Text style={styles.modalDesc}>
                When turned on, new messages sent in this chat will disappear after the selected duration.
              </Text>

              {DISAPPEARING_OPTIONS.map((opt) => {
                const isActive = (activeConversation?.disappearingDuration || 0) === opt.seconds;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={styles.durationRow}
                    onPress={() => {
                      setDisappearingDuration(convId, opt.seconds);
                      setShowDisappearingModal(false);
                    }}
                  >
                    <Text style={[styles.durationLabel, isDarkMode && styles.textDark]}>{opt.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={22} color={COLORS.accent} />}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowDisappearingModal(false)}
              >
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Group Info Modal */}
        {showGroupInfo && activeConversation && (
          <Modal visible animationType="slide" onRequestClose={() => setShowGroupInfo(false)}>
            <GroupInfoScreen
              conversation={activeConversation}
              onBack={() => setShowGroupInfo(false)}
              onLeaveGroup={() => {
                setShowGroupInfo(false);
                setActiveConversation(null);
              }}
            />
          </Modal>
        )}

        {/* Media Gallery Modal */}
        {showMediaGallery && activeConversation && (
          <Modal visible animationType="slide" onRequestClose={() => setShowMediaGallery(false)}>
            <MediaGalleryScreen
              conversation={activeConversation}
              onBack={() => setShowMediaGallery(false)}
            />
          </Modal>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  containerDark: {
    backgroundColor: '#111B21',
  },
  textDark: {
    color: '#E9EDEF',
  },
  header: {
    height: 56,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  disappearingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F5132',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  disappearingBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  chatBackgroundDark: {
    backgroundColor: '#0B141A',
  },
  messageList: {
    paddingVertical: 10,
  },
  emptyMessages: {
    padding: 20,
    alignItems: 'center',
  },
  encryptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#FFE082',
    width: '90%',
  },
  encryptionCardText: {
    flex: 1,
    fontSize: 12,
    color: '#6D4C41',
    textAlign: 'center',
    lineHeight: 16,
  },
  replyBanner: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primaryLight,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 8,
  },
  replyBannerDark: {
    backgroundColor: '#1F2C34',
  },
  replyContent: {
    flex: 1,
  },
  replyAuthor: {
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    fontSize: 12,
  },
  replySnippet: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  replyClose: {
    padding: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  inputCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 10,
    minHeight: 46,
    maxHeight: 120,
    marginRight: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputCardDark: {
    backgroundColor: '#202C33',
  },
  inputIcon: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    maxHeight: 110,
    paddingVertical: 8,
    paddingHorizontal: 6,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 6,
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
  },
  recordingPulse: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },
  recordingTimer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  cancelRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  cancelRecordText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  sendRecordBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    paddingBottom: 70,
  },
  attachmentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    elevation: 8,
  },
  attachmentCardDark: {
    backgroundColor: '#1F2C34',
  },
  attachmentOption: {
    alignItems: 'center',
  },
  attachCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  attachLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dropdownCard: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 6,
    paddingVertical: 6,
    minWidth: 200,
  },
  dropdownCardDark: {
    backgroundColor: '#1F2C34',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  disappearingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  disappearingCardDark: {
    backgroundColor: '#1F2C34',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  durationLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  closeModalBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  closeModalText: {
    color: COLORS.primaryLight,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
