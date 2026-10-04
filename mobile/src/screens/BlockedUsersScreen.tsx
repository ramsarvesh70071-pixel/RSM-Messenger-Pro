import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

interface BlockedUsersScreenProps {
  onBack: () => void;
}

export const BlockedUsersScreen: React.FC<BlockedUsersScreenProps> = ({ onBack }) => {
  const { isDarkMode } = useStore();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlocked();
  }, []);

  const loadBlocked = async () => {
    setLoading(true);
    try {
      const res = await api.getBlockedUsers();
      if (res?.data && Array.isArray(res.data)) {
        setBlockedUsers(res.data);
      }
    } catch (e) {
      console.warn('Failed to load blocked users:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = (userId: string, userName: string) => {
    Alert.alert('Unblock User', `Unblock ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await api.unblockUser(userId);
            setBlockedUsers((prev) => prev.filter((b) => (b.blockedUserId?._id || b.blockedUserId) !== userId));
          } catch (e) {
            Alert.alert('Error', 'Failed to unblock user');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Contacts</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item._id || item.id}
          renderItem={({ item }) => {
            const user = item.blockedUserId || {};
            const userId = user._id || item.blockedUserId;
            const userName = user.name || 'User';

            return (
              <View style={[styles.userRow, isDarkMode && styles.userRowDark]}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, isDarkMode && styles.textDark]}>{userName}</Text>
                  <Text style={styles.userPhone}>{user.phoneNumber || ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() => handleUnblock(userId, userName)}
                >
                  <Text style={styles.unblockBtnText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyTitle, isDarkMode && styles.textDark]}>No blocked contacts</Text>
              <Text style={styles.emptySubtitle}>
                Blocked contacts will no longer be able to call you or send you messages.
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  userRowDark: {
    borderBottomColor: '#202C33',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
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
