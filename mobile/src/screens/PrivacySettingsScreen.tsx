import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

interface PrivacySettingsScreenProps {
  onBack: () => void;
  onOpenBlockedUsers: () => void;
}

export const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({
  onBack,
  onOpenBlockedUsers,
}) => {
  const { isDarkMode } = useStore();
  const [loading, setLoading] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [profilePhoto, setProfilePhoto] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [statusPrivacy, setStatusPrivacy] = useState<'everyone' | 'contacts' | 'nobody'>('contacts');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getPrivacySettings();
      if (res?.data) {
        setReadReceipts(res.data.readReceipts ?? true);
        setLastSeen(res.data.lastSeen || 'everyone');
        setProfilePhoto(res.data.profilePhoto || 'everyone');
        setStatusPrivacy(res.data.status || 'contacts');
      }
    } catch (e) {
      console.warn('Failed to load privacy settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      await api.updatePrivacySettings({ [key]: value });
    } catch (e) {
      Alert.alert('Error', 'Failed to update privacy setting');
    }
  };

  const cycleOption = (current: 'everyone' | 'contacts' | 'nobody'): 'everyone' | 'contacts' | 'nobody' => {
    if (current === 'everyone') return 'contacts';
    if (current === 'contacts') return 'nobody';
    return 'everyone';
  };

  const formatOption = (opt: string) => {
    if (opt === 'everyone') return 'Everyone';
    if (opt === 'contacts') return 'My contacts';
    return 'Nobody';
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.groupHeading}>Who can see my personal info</Text>

          {/* Last Seen & Online */}
          <TouchableOpacity
            style={[styles.settingRow, isDarkMode && styles.settingRowDark]}
            onPress={() => {
              const next = cycleOption(lastSeen);
              setLastSeen(next);
              updateSetting('lastSeen', next);
            }}
          >
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Last seen and online</Text>
              <Text style={styles.settingSubtitle}>{formatOption(lastSeen)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Profile Photo */}
          <TouchableOpacity
            style={[styles.settingRow, isDarkMode && styles.settingRowDark]}
            onPress={() => {
              const next = cycleOption(profilePhoto);
              setProfilePhoto(next);
              updateSetting('profilePhoto', next);
            }}
          >
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Profile photo</Text>
              <Text style={styles.settingSubtitle}>{formatOption(profilePhoto)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Status */}
          <TouchableOpacity
            style={[styles.settingRow, isDarkMode && styles.settingRowDark]}
            onPress={() => {
              const next = cycleOption(statusPrivacy);
              setStatusPrivacy(next);
              updateSetting('status', next);
            }}
          >
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Status</Text>
              <Text style={styles.settingSubtitle}>{formatOption(statusPrivacy)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Read Receipts */}
          <View style={[styles.settingRow, isDarkMode && styles.settingRowDark]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Read receipts</Text>
              <Text style={styles.settingSubtitle}>
                If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.
              </Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={(val) => {
                setReadReceipts(val);
                updateSetting('readReceipts', val);
              }}
              trackColor={{ false: '#767577', true: '#A7F3D0' }}
              thumbColor={readReceipts ? COLORS.primaryLight : '#f4f3f4'}
            />
          </View>

          <Text style={[styles.groupHeading, { marginTop: 24 }]}>Disappearing messages</Text>

          {/* Default message timer */}
          <View style={[styles.settingRow, isDarkMode && styles.settingRowDark]}>
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Default message timer</Text>
              <Text style={styles.settingSubtitle}>Start new chats with disappearing messages</Text>
            </View>
            <Text style={[styles.settingValue, isDarkMode && styles.textDark]}>Off</Text>
          </View>

          <Text style={[styles.groupHeading, { marginTop: 24 }]}>Contacts</Text>

          {/* Blocked Contacts */}
          <TouchableOpacity
            style={[styles.settingRow, isDarkMode && styles.settingRowDark]}
            onPress={onOpenBlockedUsers}
          >
            <View>
              <Text style={[styles.settingTitle, isDarkMode && styles.textDark]}>Blocked contacts</Text>
              <Text style={styles.settingSubtitle}>Tap to manage blocked users</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </ScrollView>
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
  content: {
    flex: 1,
  },
  groupHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  settingRowDark: {
    borderBottomColor: '#202C33',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  settingSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
