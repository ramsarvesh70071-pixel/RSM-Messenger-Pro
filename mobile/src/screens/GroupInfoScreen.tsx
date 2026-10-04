import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { Conversation, User } from '../types';

interface GroupInfoScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onLeaveGroup?: () => void;
}

export const GroupInfoScreen: React.FC<GroupInfoScreenProps> = ({
  conversation,
  onBack,
  onLeaveGroup,
}) => {
  const { currentUser, isDarkMode, registeredUsers } = useStore();
  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [conversation.id]);

  const loadGroup = async () => {
    setLoading(true);
    try {
      const res = await api.getGroupDetails(conversation.id);
      if (res?.data) {
        setGroupData(res.data);
      }
    } catch (e) {
      console.warn('Failed to load group details:', e);
    } finally {
      setLoading(false);
    }
  };

  const currentMemberMeta = groupData?.membersMeta?.find(
    (m: any) => m.userId?._id === currentUser?.id || m.userId === currentUser?.id
  );
  const isAdmin = currentMemberMeta?.role === 'admin' || currentMemberMeta?.role === 'owner';

  const handleAddMember = async (userId: string) => {
    try {
      await api.addGroupMember(conversation.id, userId);
      setShowAddMemberModal(false);
      loadGroup();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not add member');
    }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    Alert.alert('Remove Member', `Remove ${userName} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.removeGroupMember(conversation.id, userId);
            loadGroup();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Could not remove member');
          }
        },
      },
    ]);
  };

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await api.setMemberRole(conversation.id, userId, newRole);
      loadGroup();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Could not update role');
    }
  };

  const handleExitGroup = () => {
    Alert.alert('Exit Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveGroup(conversation.id);
            if (onLeaveGroup) onLeaveGroup();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Could not exit group');
          }
        },
      },
    ]);
  };

  const participants = groupData?.participants || conversation.participants || [];
  const existingUserIds = new Set(participants.map((p: any) => p._id || p.id));
  const availableUsersToAdd = registeredUsers.filter((u) => !existingUserIds.has(u.id));

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Avatar and Group Name */}
          <View style={[styles.card, styles.centerCard, isDarkMode && styles.cardDark]}>
            <View style={styles.avatarLarge}>
              <Ionicons name="people" size={48} color="#FFFFFF" />
            </View>
            <Text style={[styles.groupName, isDarkMode && styles.textDark]}>{conversation.name}</Text>
            <Text style={styles.groupCount}>Group · {participants.length} participants</Text>
          </View>

          {/* Description */}
          {Boolean(conversation.description) && (
            <View style={[styles.card, isDarkMode && styles.cardDark]}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={[styles.descriptionText, isDarkMode && styles.textDark]}>
                {conversation.description}
              </Text>
            </View>
          )}

          {/* Participants Section */}
          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            <View style={styles.participantsHeader}>
              <Text style={styles.sectionTitle}>{participants.length} participants</Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.addMemberBtn}
                  onPress={() => setShowAddMemberModal(true)}
                >
                  <Ionicons name="person-add" size={16} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
                  <Text style={styles.addMemberText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {participants.map((item: any) => {
              const uId = item._id || item.id;
              const isSelf = uId === currentUser?.id;
              const meta = groupData?.membersMeta?.find(
                (m: any) => (m.userId?._id || m.userId) === uId
              );
              const role = meta?.role || 'member';

              return (
                <View key={uId} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isDarkMode && styles.textDark]}>
                      {isSelf ? 'You' : item.name || 'User'}
                    </Text>
                    <Text style={styles.memberAbout} numberOfLines={1}>
                      {item.about || item.phoneNumber || ''}
                    </Text>
                  </View>

                  {role === 'admin' || role === 'owner' ? (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Group Admin</Text>
                    </View>
                  ) : null}

                  {isAdmin && !isSelf && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleToggleAdmin(uId, role)}
                      >
                        <Ionicons
                          name={role === 'admin' ? 'shield-half' : 'shield-outline'}
                          size={18}
                          color={COLORS.primaryLight}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleRemoveMember(uId, item.name || 'User')}
                      >
                        <Ionicons name="remove-circle-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Exit Group Button */}
          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            <TouchableOpacity style={styles.exitRow} onPress={handleExitGroup}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" style={{ marginRight: 12 }} />
              <Text style={styles.exitText}>Exit group</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Add Member Modal */}
      <Modal visible={showAddMemberModal} transparent animationType="slide" onRequestClose={() => setShowAddMemberModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.textDark]}>Add Participants</Text>
              <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableUsersToAdd}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.selectUserRow}
                  onPress={() => handleAddMember(item.id)}
                >
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, isDarkMode && styles.textDark]}>{item.name}</Text>
                    <Text style={styles.memberAbout}>{item.phone}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={COLORS.primaryLight} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textMuted }}>All registered users are already members</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardDark: {
    backgroundColor: '#111B21',
  },
  centerCard: {
    alignItems: 'center',
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  groupCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryLight,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,168,132,0.1)',
  },
  addMemberText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  memberAbout: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DCF8C6',
    marginRight: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    color: '#00A884',
    fontWeight: 'bold',
  },
  adminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  exitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  exitText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 16,
  },
  modalContentDark: {
    backgroundColor: '#111B21',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  selectUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  textDark: {
    color: '#E9EDEF',
  },
});
