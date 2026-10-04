import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Message } from '../types';
import { COLORS } from '../config/constants';
import { useStore } from '../store/useStore';
import { MediaService } from '../services/media';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  onReaction: (emoji: string) => void;
  onReply: (message: Message) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOutgoing,
  onReaction,
  onReply,
}) => {
  const { toggleStarMessage, deleteMessage, isDarkMode } = useStore();
  const [showPicker, setShowPicker] = useState(false);

  // Audio Playback State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Media preview modal
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const togglePlayAudio = async () => {
    const audioUrl = message.attachments?.[0]?.url;
    if (!audioUrl) return;

    try {
      if (sound) {
        if (isPlayingAudio) {
          await sound.pauseAsync();
          setIsPlayingAudio(false);
        } else {
          await sound.playAsync();
          setIsPlayingAudio(true);
        }
      } else {
        setIsLoadingAudio(true);
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (playbackStatus) => {
            if (playbackStatus.isLoaded) {
              setAudioPosition(playbackStatus.positionMillis || 0);
              setAudioDuration(playbackStatus.durationMillis || 0);
              setIsPlayingAudio(playbackStatus.isPlaying);
              if (playbackStatus.didJustFinish) {
                setIsPlayingAudio(false);
                setAudioPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsLoadingAudio(false);
        setIsPlayingAudio(true);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
      setIsLoadingAudio(false);
      setIsPlayingAudio(false);
    }
  };

  const renderStatus = () => {
    if (!isOutgoing) return null;
    if (message.status === 'read') {
      return <Ionicons name="checkmark-done" size={15} color={COLORS.accentBlue} style={styles.tick} />;
    }
    if (message.status === 'delivered') {
      return <Ionicons name="checkmark-done" size={15} color={COLORS.textMuted} style={styles.tick} />;
    }
    return <Ionicons name="checkmark" size={15} color={COLORS.textMuted} style={styles.tick} />;
  };

  const reactionEntries = Object.entries(message.reactions || {});

  const handleStar = async () => {
    setShowPicker(false);
    await toggleStarMessage(message.id, message.conversationId);
  };

  const handleDelete = () => {
    setShowPicker(false);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for me',
        onPress: () => deleteMessage(message.id, message.conversationId, false),
      },
      {
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: () => deleteMessage(message.id, message.conversationId, true),
      },
    ]);
  };

  const primaryAttachment = message.attachments?.[0];

  return (
    <View style={[styles.wrapper, isOutgoing ? styles.wrapperOut : styles.wrapperIn]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => setShowPicker(true)}
        style={[
          styles.bubble,
          isOutgoing
            ? isDarkMode
              ? styles.bubbleOutDark
              : styles.bubbleOut
            : isDarkMode
            ? styles.bubbleInDark
            : styles.bubbleIn,
        ]}
      >
        {/* Reply Quote Banner */}
        {message.replyTo && (
          <View style={[styles.replyQuote, isDarkMode && styles.replyQuoteDark]}>
            <Text style={styles.replyAuthor}>{message.replyTo.senderName}</Text>
            <Text style={[styles.replyText, isDarkMode && styles.textDark]} numberOfLines={2}>
              {message.replyTo.content}
            </Text>
          </View>
        )}

        {/* Sender Name in Group */}
        {!isOutgoing && message.senderName && (
          <Text style={styles.senderHeader}>{message.senderName}</Text>
        )}

        {/* 1. Image Rendering */}
        {message.type === 'image' && primaryAttachment && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPreviewMediaUrl(primaryAttachment.url)}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: primaryAttachment.url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* 2. Audio / Voice Note Rendering */}
        {message.type === 'audio' && (
          <View style={styles.audioRow}>
            <TouchableOpacity
              style={styles.playBtn}
              onPress={togglePlayAudio}
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isPlayingAudio ? 'pause' : 'play'}
                  size={20}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>

            <View style={styles.waveformContainer}>
              <View style={[styles.waveformBar, { height: 14 }]} />
              <View style={[styles.waveformBar, { height: 22 }]} />
              <View style={[styles.waveformBar, { height: 16 }]} />
              <View style={[styles.waveformBar, { height: 26 }]} />
              <View style={[styles.waveformBar, { height: 18 }]} />
              <View style={[styles.waveformBar, { height: 10 }]} />
              <View style={[styles.waveformBar, { height: 20 }]} />
              <View style={[styles.waveformBar, { height: 12 }]} />
            </View>

            <Text style={[styles.audioDuration, isDarkMode && styles.textDark]}>
              {audioDuration > 0
                ? `${Math.floor(audioPosition / 1000)}s / ${Math.floor(audioDuration / 1000)}s`
                : primaryAttachment?.duration
                ? `${primaryAttachment.duration}s`
                : 'Voice'}
            </Text>
          </View>
        )}

        {/* 3. Document Rendering */}
        {message.type === 'document' && primaryAttachment && (
          <TouchableOpacity
            style={styles.docRow}
            onPress={() => MediaService.downloadAndShare(primaryAttachment.url, primaryAttachment.fileName || 'file.pdf')}
          >
            <View style={styles.docIconBox}>
              <Ionicons name="document-text" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.docInfo}>
              <Text style={[styles.docName, isDarkMode && styles.textDark]} numberOfLines={1}>
                {primaryAttachment.fileName || 'Document'}
              </Text>
              <Text style={styles.docSub}>
                {primaryAttachment.fileSize ? `${Math.round(primaryAttachment.fileSize / 1024)} KB` : 'Tap to open'}
              </Text>
            </View>
            <Ionicons name="download-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
        )}

        {/* 4. Location Rendering */}
        {message.type === 'location' && message.location && (
          <View style={styles.locationBox}>
            <View style={styles.locationMapPlaceholder}>
              <Ionicons name="location" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.locationTitle, isDarkMode && styles.textDark]}>
              {message.location.name || 'Shared Location'}
            </Text>
            {message.location.address ? (
              <Text style={styles.locationAddress} numberOfLines={2}>
                {message.location.address}
              </Text>
            ) : null}
          </View>
        )}

        {/* 5. Contact Card Rendering */}
        {message.type === 'contact' && message.contact && (
          <View style={styles.contactCard}>
            <View style={styles.contactAvatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, isDarkMode && styles.textDark]}>{message.contact.name}</Text>
              <Text style={styles.contactPhone}>{message.contact.phoneNumber}</Text>
            </View>
          </View>
        )}

        {/* Message Text (if any or text type) */}
        {Boolean(message.content) && message.type !== 'audio' && (
          <Text
            style={[
              styles.content,
              isDarkMode && styles.textDark,
              message.deletedForEveryone && styles.deletedText,
            ]}
          >
            {message.content}
          </Text>
        )}

        {/* Footer: Star, Time & Status */}
        <View style={styles.footer}>
          {message.isStarred && (
            <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
          )}
          <Text style={styles.time}>{message.createdAt}</Text>
          {renderStatus()}
        </View>

        {/* Reactions floating pill */}
        {reactionEntries.length > 0 && (
          <View style={[styles.reactionsPill, isDarkMode && styles.reactionsPillDark]}>
            {reactionEntries.map(([emoji, users]) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionItem}
                onPress={() => onReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && <Text style={[styles.reactionCount, isDarkMode && styles.textDark]}>{users.length}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Media Fullscreen Preview Modal */}
      {previewMediaUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewMediaUrl(null)}>
          <View style={styles.fullscreenModal}>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setPreviewMediaUrl(null)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image source={{ uri: previewMediaUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          </View>
        </Modal>
      )}

      {/* Reaction & Action Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={[styles.pickerBox, isDarkMode && styles.pickerBoxDark]}>
            <View style={styles.reactionRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionChoice}
                  onPress={() => {
                    onReaction(emoji);
                    setShowPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.pickerActionBtn}
              onPress={() => {
                setShowPicker(false);
                onReply(message);
              }}
            >
              <Ionicons name="arrow-undo" size={20} color={COLORS.primaryLight} style={{ marginRight: 12 }} />
              <Text style={[styles.actionBtnText, isDarkMode && styles.textDark]}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerActionBtn} onPress={handleStar}>
              <Ionicons
                name={message.isStarred ? 'star' : 'star-outline'}
                size={20}
                color="#F59E0B"
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.actionBtnText, isDarkMode && styles.textDark]}>
                {message.isStarred ? 'Unstar message' : 'Star message'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerActionBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 3,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  wrapperOut: {
    justifyContent: 'flex-end',
  },
  wrapperIn: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleOut: {
    backgroundColor: '#E7FFDB',
    borderTopRightRadius: 2,
  },
  bubbleOutDark: {
    backgroundColor: '#005C4B',
    borderTopRightRadius: 2,
  },
  bubbleIn: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
  },
  bubbleInDark: {
    backgroundColor: '#202C33',
    borderTopLeftRadius: 2,
  },
  senderHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00A884',
    marginBottom: 4,
  },
  replyQuote: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  replyQuoteDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
  },
  replyText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 8,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 4,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 8,
  },
  waveformBar: {
    width: 3,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
  },
  audioDuration: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  docSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  locationBox: {
    width: 220,
    paddingBottom: 4,
  },
  locationMapPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  locationAddress: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 10,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  content: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  deletedText: {
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  time: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  tick: {
    marginLeft: 2,
  },
  reactionsPill: {
    position: 'absolute',
    bottom: -10,
    left: 8,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reactionsPillDark: {
    backgroundColor: '#202C33',
    borderColor: '#111B21',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    marginLeft: 2,
    color: COLORS.textMuted,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerBoxDark: {
    backgroundColor: '#202C33',
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reactionChoice: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  pickerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
