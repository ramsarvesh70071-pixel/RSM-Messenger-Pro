import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';
import { COLORS } from '../config/constants';

import { useStore } from '../store/useStore';

interface ChatListItemProps {
  conversation: Conversation;
  onPress: () => void;
  isOnline?: boolean;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ conversation, onPress, isOnline }) => {
  const { isDarkMode } = useStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getStatusIcon = (status?: string) => {
    if (status === 'read') {
      return <Ionicons name="checkmark-done" size={16} color={COLORS.accentBlue} style={styles.tickIcon} />;
    }
    if (status === 'delivered') {
      return <Ionicons name="checkmark-done" size={16} color={COLORS.textMuted} style={styles.tickIcon} />;
    }
    return <Ionicons name="checkmark" size={16} color={COLORS.textMuted} style={styles.tickIcon} />;
  };

  return (
    <TouchableOpacity
      style={[styles.container, isDarkMode && styles.containerDark]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, conversation.isGroup ? styles.groupAvatar : styles.userAvatar]}>
          {conversation.isGroup ? (
            <Ionicons name="people" size={24} color="#FFFFFF" />
          ) : (
            <Text style={styles.avatarText}>{getInitials(conversation.name)}</Text>
          )}
        </View>
        {isOnline && !conversation.isGroup && <View style={styles.onlineDot} />}
      </View>

      {/* Info */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, isDarkMode && styles.textDark]} numberOfLines={1}>
            {conversation.name}
          </Text>
          <Text style={[styles.time, conversation.unreadCount > 0 && styles.activeTime]}>
            {conversation.lastMessage?.createdAt || 'Now'}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.messagePreview}>
            {conversation.lastMessage?.senderName === 'You' && getStatusIcon(conversation.lastMessage?.status)}
            <Text
              style={[
                styles.messageText,
                isDarkMode && styles.messageTextDark,
                conversation.unreadCount > 0 && (isDarkMode ? styles.textDark : styles.unreadMessageText),
              ]}
              numberOfLines={1}
            >
              {conversation.lastMessage?.content || 'Tap to start chatting'}
            </Text>
          </View>

          <View style={styles.metaCol}>
            {conversation.disappearingDuration ? (
              <Ionicons name="timer-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 4 }} />
            ) : null}
            {conversation.isMuted && (
              <Ionicons name="volume-mute" size={14} color={COLORS.textMuted} style={{ marginRight: 4 }} />
            )}
            {conversation.isPinned && (
              <Ionicons name="pin" size={14} color={COLORS.textMuted} style={{ marginRight: 4 }} />
            )}
            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F2F5',
  },
  containerDark: {
    backgroundColor: '#111B21',
    borderBottomColor: '#202C33',
  },
  textDark: {
    color: '#E9EDEF',
  },
  messageTextDark: {
    color: '#8696A0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: '#00A884',
  },
  groupAvatar: {
    backgroundColor: '#536471',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  activeTime: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tickIcon: {
    marginRight: 4,
  },
  messageText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  unreadMessageText: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
