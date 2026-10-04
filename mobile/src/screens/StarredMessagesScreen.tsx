import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { Message } from '../types';
import { MessageBubble } from '../components/MessageBubble';

interface StarredMessagesScreenProps {
  onBack: () => void;
  onOpenChat?: (chatId: string) => void;
}

export const StarredMessagesScreen: React.FC<StarredMessagesScreenProps> = ({ onBack, onOpenChat }) => {
  const { isDarkMode, addReaction } = useStore();
  const [starredList, setStarredList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStarred();
  }, []);

  const loadStarred = async () => {
    setLoading(true);
    try {
      const res = await api.getStarredMessages();
      if (res?.data && Array.isArray(res.data)) {
        setStarredList(res.data);
      }
    } catch (e) {
      console.warn('Failed to load starred messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const msg: Message = {
      id: item._id || item.id,
      conversationId: item.chatId?._id || item.chatId || '',
      senderId: item.senderId?._id || item.senderId,
      senderName: item.senderId?.name || 'Contact',
      senderAvatar: item.senderId?.avatarUrl,
      content: item.content || '',
      type: item.type || 'text',
      status: item.status || 'read',
      createdAt: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: item.attachments,
      isStarred: true,
      reactions: item.reactions || {},
    };

    const chatName = item.chatId?.name || (item.chatId?.isGroup ? 'Group Chat' : 'Direct Chat');

    return (
      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.chatName, isDarkMode && styles.textDark]}>{chatName}</Text>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        <MessageBubble
          message={msg}
          isOutgoing={false}
          onReaction={(emoji) => addReaction(msg.id, emoji, msg.conversationId)}
          onReply={() => {}}
        />

        {onOpenChat && (
          <TouchableOpacity
            style={styles.jumpBtn}
            onPress={() => onOpenChat(msg.conversationId)}
          >
            <Text style={styles.jumpBtnText}>Go to chat</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primaryLight} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Starred Messages</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={starredList}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyTitle, isDarkMode && styles.textDark]}>No starred messages</Text>
              <Text style={styles.emptySubtitle}>
                Tap and hold any message in a chat to star it, so you can easily find it later.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#0B141A',
  },
  header: {
    height: 60,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerDark: {
    backgroundColor: '#111B21',
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: '#111B21',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  jumpBtnText: {
    fontSize: 13,
    color: COLORS.primaryLight,
    fontWeight: '500',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
