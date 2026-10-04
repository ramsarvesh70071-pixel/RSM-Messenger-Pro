import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { Conversation } from '../types';
import { ChatListItem } from '../components/ChatListItem';

interface ArchivedChatsScreenProps {
  onBack: () => void;
  onOpenConversation: (conv: Conversation) => void;
}

export const ArchivedChatsScreen: React.FC<ArchivedChatsScreenProps> = ({ onBack, onOpenConversation }) => {
  const { isDarkMode, togglePinChat, toggleMuteChat } = useStore();
  const [archivedChats, setArchivedChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchived();
  }, []);

  const loadArchived = async () => {
    setLoading(true);
    try {
      const res = await api.getChats(true);
      if (res?.data && Array.isArray(res.data)) {
        const mapped: Conversation[] = res.data.map((c: any) => ({
          id: c._id || c.id,
          name: c.name || 'Chat',
          isGroup: c.type === 'group',
          avatar: c.avatarUrl,
          description: c.description,
          participants: c.participants || [],
          lastMessage: c.lastMessage
            ? {
                id: c.lastMessage._id || c.lastMessage.id,
                content: c.lastMessage.content || '',
                senderName: c.lastMessage.senderId?.name || 'Contact',
                createdAt: new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                type: c.lastMessage.type || 'text',
                status: c.lastMessage.status || 'read',
              }
            : undefined,
          unreadCount: 0,
          updatedAt: c.lastMessageAt || c.updatedAt,
        }));
        setArchivedChats(mapped);
      }
    } catch (e) {
      console.warn('Failed to load archived chats:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (chatId: string) => {
    try {
      await api.toggleArchiveChat(chatId);
      setArchivedChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch (e) {
      console.warn('Failed to unarchive:', e);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived Chats</Text>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="archive-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <Text style={styles.infoBannerText}>
          These chats stay archived when new messages are received.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={archivedChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.chatRow}>
              <View style={{ flex: 1 }}>
                <ChatListItem
                  conversation={item}
                  onPress={() => onOpenConversation(item)}
                />
              </View>
              <TouchableOpacity
                style={styles.unarchiveBtn}
                onPress={() => handleUnarchive(item.id)}
              >
                <Ionicons name="arrow-undo-outline" size={20} color={COLORS.primaryLight} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyTitle, isDarkMode && styles.textDark]}>No archived chats</Text>
              <Text style={styles.emptySubtitle}>
                Swipe or hold on any conversation in Chats to archive it.
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
    backgroundColor: '#FFFFFF',
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  infoBannerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unarchiveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
