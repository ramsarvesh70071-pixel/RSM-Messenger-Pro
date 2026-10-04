import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Text,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { ChatListItem } from '../components/ChatListItem';
import { NewChatModal } from '../components/NewChatModal';
import { COLORS } from '../config/constants';
import { Conversation } from '../types';

export const ChatsScreen: React.FC = () => {
  const {
    conversations,
    setActiveConversation,
    fetchConversations,
    searchQuery,
    onlineUserIds,
    togglePinChat,
    toggleMuteChat,
    clearChatHistory,
    typingUsers,
    isDarkMode,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatMode, setNewChatMode] = useState<'chat' | 'group'>('chat');
  const [selectedChatForOptions, setSelectedChatForOptions] = useState<Conversation | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleLongPressChat = (conv: Conversation) => {
    setSelectedChatForOptions(conv);
  };

  const handleAction = async (action: 'pin' | 'mute' | 'clear') => {
    if (!selectedChatForOptions) return;
    const cId = selectedChatForOptions.id;
    setSelectedChatForOptions(null);

    if (action === 'pin') {
      await togglePinChat(cId);
    } else if (action === 'mute') {
      await toggleMuteChat(cId);
    } else if (action === 'clear') {
      Alert.alert('Clear Chat', 'Delete all messages in this chat?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearChatHistory(cId) },
      ]);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <FlatList
        data={filteredConversations}
        keyExtractor={(item, index) => `${item.id || index}-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primaryLight]} />}
        renderItem={({ item }) => {
          const otherParticipant = item.participants?.find((p) => p.name !== 'Ramsarvesh Maurya');
          const isOnline = otherParticipant ? onlineUserIds.has(otherParticipant.id) : false;
          const typingName = typingUsers[item.id];

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => handleLongPressChat(item)}
              onPress={() => setActiveConversation(item)}
            >
              <ChatListItem
                conversation={{
                  ...item,
                  lastMessage: typingName
                    ? {
                        id: 'typing',
                        content: `${typingName} is typing...`,
                        senderName: '',
                        createdAt: 'Now',
                        type: 'text',
                        status: 'delivered',
                      }
                    : item.lastMessage,
                }}
                isOnline={isOnline}
                onPress={() => setActiveConversation(item)}
              />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={54} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>No conversations yet</Text>
            <Text style={styles.emptySubText}>
              Connect with registered users dynamically or create a group to start chatting!
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                setNewChatMode('chat');
                setShowNewChat(true);
              }}
            >
              <Text style={styles.emptyBtnText}>START A CHAT</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Action Button (New Chat & New Group) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.miniFab}
          activeOpacity={0.8}
          onPress={() => {
            setNewChatMode('group');
            setShowNewChat(true);
          }}
        >
          <Ionicons name="people" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => {
            setNewChatMode('chat');
            setShowNewChat(true);
          }}
        >
          <MaterialCommunityIcons name="chat-plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Chat Options Context Modal (Pin, Mute, Clear) */}
      <Modal visible={!!selectedChatForOptions} transparent animationType="fade" onRequestClose={() => setSelectedChatForOptions(null)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedChatForOptions(null)}
        >
          <View style={[styles.optionsCard, isDarkMode && styles.optionsCardDark]}>
            <Text style={[styles.optionsTitle, isDarkMode && styles.textDark]} numberOfLines={1}>
              {selectedChatForOptions?.name}
            </Text>

            <TouchableOpacity style={styles.optionRow} onPress={() => handleAction('pin')}>
              <Ionicons
                name={selectedChatForOptions?.isPinned ? 'pin' : 'pin-outline'}
                size={22}
                color={COLORS.primaryLight}
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.optionLabel, isDarkMode && styles.textDark]}>
                {selectedChatForOptions?.isPinned ? 'Unpin chat' : 'Pin chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={() => handleAction('mute')}>
              <Ionicons
                name={selectedChatForOptions?.isMuted ? 'volume-high' : 'volume-mute'}
                size={22}
                color={COLORS.primaryLight}
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.optionLabel, isDarkMode && styles.textDark]}>
                {selectedChatForOptions?.isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={() => handleAction('clear')}>
              <Ionicons name="trash-outline" size={22} color={COLORS.danger} style={{ marginRight: 12 }} />
              <Text style={[styles.optionLabel, { color: COLORS.danger }]}>Clear chat history</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Chat & Group Modal */}
      <NewChatModal
        visible={showNewChat}
        initialMode={newChatMode}
        onClose={() => setShowNewChat(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  containerDark: {
    backgroundColor: '#0B141A',
  },
  textDark: {
    color: '#E9EDEF',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
    gap: 12,
  },
  miniFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 26,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 14,
  },
  emptySubText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    padding: 16,
    elevation: 8,
  },
  optionsCardDark: {
    backgroundColor: '#1F2C34',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});
