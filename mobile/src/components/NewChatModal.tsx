import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { User } from '../types';
import { COLORS } from '../config/constants';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'chat' | 'group';
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ visible, onClose, initialMode = 'chat' }) => {
  const { registeredUsers, fetchRegisteredUsers, startConversationWithUser, createNewGroup, isDarkMode } = useStore();
  const [search, setSearch] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(initialMode === 'group');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchRegisteredUsers();
      setIsCreatingGroup(initialMode === 'group');
      setSelectedUserIds([]);
      setGroupName('');
      setGroupDesc('');
    }
  }, [visible, initialMode]);

  const filtered = registeredUsers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.username && c.username.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectUser = async (user: User) => {
    if (isCreatingGroup) {
      if (selectedUserIds.includes(user.id)) {
        setSelectedUserIds(selectedUserIds.filter((id) => id !== user.id));
      } else {
        setSelectedUserIds([...selectedUserIds, user.id]);
      }
      return;
    }

    setLoading(true);
    const conv = await startConversationWithUser(user);
    setLoading(false);
    if (conv) {
      onClose();
    } else {
      Alert.alert('Error', 'Could not start conversation with user');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please provide a group subject/name');
      return;
    }
    if (selectedUserIds.length === 0) {
      Alert.alert('Members Required', 'Please select at least 1 contact to create group');
      return;
    }

    setLoading(true);
    const groupConv = await createNewGroup(groupName.trim(), selectedUserIds, groupDesc.trim());
    setLoading(false);
    if (groupConv) {
      onClose();
    } else {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.headerTitle}>
              {isCreatingGroup ? 'New Group' : 'Select Contact'}
            </Text>
            <Text style={styles.contactCount}>
              {isCreatingGroup
                ? `${selectedUserIds.length} selected`
                : `${registeredUsers.length} dynamic contacts`}
            </Text>
          </View>
        </View>

        {/* Group Creation Info Header (when creating group) */}
        {isCreatingGroup && (
          <View style={[styles.groupMetaBox, isDarkMode && styles.groupMetaBoxDark]}>
            <View style={styles.groupIconCircle}>
              <Ionicons name="camera" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.groupInputWrap}>
              <TextInput
                style={[styles.groupNameInput, isDarkMode && styles.textDark]}
                placeholder="Type group subject here..."
                placeholderTextColor={isDarkMode ? '#8696A0' : '#667781'}
                value={groupName}
                onChangeText={setGroupName}
              />
              <TextInput
                style={[styles.groupDescInput, isDarkMode && styles.textDark]}
                placeholder="Group description (optional)"
                placeholderTextColor={isDarkMode ? '#8696A0' : '#667781'}
                value={groupDesc}
                onChangeText={setGroupDesc}
              />
            </View>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchBar, isDarkMode && styles.searchBarDark]}>
          <Ionicons name="search" size={20} color={isDarkMode ? '#8696A0' : COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.textDark]}
            placeholder="Search registered users..."
            placeholderTextColor={isDarkMode ? '#8696A0' : '#667781'}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Quick Actions (only when not in group mode) */}
        {!isCreatingGroup && (
          <View style={[styles.quickActions, isDarkMode && styles.quickActionsDark]}>
            <TouchableOpacity style={styles.actionRow} onPress={() => setIsCreatingGroup(true)}>
              <View style={styles.iconCircle}>
                <Ionicons name="people" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, isDarkMode && styles.textDark]}>New group</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionHeader, isDarkMode && styles.sectionHeaderDark]}>
          {isCreatingGroup ? 'ADD PARTICIPANTS' : 'REGISTERED USERS ON RSM MESSENGER'}
        </Text>

        {/* Dynamic Contacts List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primaryLight} />
            <Text style={{ marginTop: 10, color: COLORS.textMuted }}>Connecting to server...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedUserIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.contactRow, isDarkMode && styles.contactRowDark]}
                  onPress={() => handleSelectUser(item)}
                >
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.name[0] || 'U'}</Text>
                    </View>
                    {item.isOnline && <View style={styles.onlineDot} />}
                  </View>

                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, isDarkMode && styles.textDark]}>{item.name}</Text>
                    <Text style={styles.contactStatus} numberOfLines={1}>
                      {item.statusMessage || item.phone}
                    </Text>
                  </View>

                  {isCreatingGroup && (
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxActive,
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.textMuted }}>No registered users found</Text>
              </View>
            }
          />
        )}

        {/* Group create floating confirm button */}
        {isCreatingGroup && (
          <TouchableOpacity style={styles.createGroupFab} onPress={handleCreateGroup}>
            <Ionicons name="checkmark" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
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
  textDark: {
    color: '#E9EDEF',
  },
  header: {
    height: 60,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
  },
  titleCol: {
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  groupMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  groupMetaBoxDark: {
    backgroundColor: '#111B21',
    borderBottomColor: '#202C33',
  },
  groupIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInputWrap: {
    flex: 1,
  },
  groupNameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primaryLight,
    paddingVertical: 4,
    marginBottom: 6,
  },
  groupDescInput: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingVertical: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F0F2F5',
    margin: 10,
    borderRadius: 8,
  },
  searchBarDark: {
    backgroundColor: '#202C33',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  quickActions: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  quickActionsDark: {
    borderBottomColor: '#202C33',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sectionHeaderDark: {
    color: '#8696A0',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F2F5',
  },
  contactRowDark: {
    borderBottomColor: '#202C33',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  contactStatus: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  createGroupFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
});
