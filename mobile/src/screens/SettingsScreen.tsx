import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { api } from '../services/api';
import { MediaService } from '../services/media';
import { StarredMessagesScreen } from './StarredMessagesScreen';
import { LinkedDevicesScreen } from './LinkedDevicesScreen';
import { PrivacySettingsScreen } from './PrivacySettingsScreen';
import { BlockedUsersScreen } from './BlockedUsersScreen';
import { CommunitiesScreen } from './CommunitiesScreen';
import { ChannelsScreen } from './ChannelsScreen';

export const SettingsScreen: React.FC = () => {
  const { currentUser, logout, updateProfile, isDarkMode, toggleDarkMode, fetchRegisteredUsers } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [about, setAbout] = useState(currentUser?.statusMessage || '');
  const [serverHost, setServerHost] = useState(api.getHost());
  const [isEditingServer, setIsEditingServer] = useState(false);

  // Sub-screens modals
  const [showStarred, setShowStarred] = useState(false);
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    await updateProfile({ name: name.trim(), about: about.trim() });
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated on server');
  };

  const handleSaveServer = () => {
    api.setHost(serverHost);
    setIsEditingServer(false);
    Alert.alert('Server Updated', `Mobile app backend URL set to:\n${serverHost}`);
  };

  const handlePing = async () => {
    try {
      const startTime = Date.now();
      await fetch(`${serverHost}/health`);
      const latency = Date.now() - startTime;
      Alert.alert('Ping Success ✅', `Server reached in ${latency}ms!\nHost: ${serverHost}`);
    } catch (err: any) {
      Alert.alert('Ping Failed ❌', `Could not reach ${serverHost}.\nEnsure backend server is running.\n\n${err.message}`);
    }
  };

  const handleSyncContacts = async () => {
    setIsSyncingContacts(true);
    try {
      const count = await MediaService.syncDeviceContacts();
      Alert.alert('Contacts Synced', `Synced ${count} contact(s) from your device address book.`);
      fetchRegisteredUsers();
    } catch (e) {
      Alert.alert('Sync failed', 'Could not sync device contacts.');
    } finally {
      setIsSyncingContacts(false);
    }
  };

  return (
    <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Profile Card */}
      <View style={[styles.profileCard, isDarkMode && styles.cardDark]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser?.name[0] || 'U'}</Text>
        </View>

        {!isEditing ? (
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDarkMode && styles.textDark]}>{currentUser?.name}</Text>
            <Text style={styles.profileStatus}>{currentUser?.statusMessage || 'Hey there! I am using RSM Messenger.'}</Text>
            <Text style={styles.profilePhone}>{currentUser?.phone}</Text>
          </View>
        ) : (
          <View style={styles.editSection}>
            <TextInput
              style={[styles.editInput, isDarkMode && styles.inputDark]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={isDarkMode ? '#8696A0' : COLORS.textMuted}
            />
            <TextInput
              style={[styles.editInput, isDarkMode && styles.inputDark]}
              value={about}
              onChangeText={setAbout}
              placeholder="About / status"
              placeholderTextColor={isDarkMode ? '#8696A0' : COLORS.textMuted}
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.editToggleBtn}
          onPress={() => {
            if (isEditing) handleSaveProfile();
            else setIsEditing(true);
          }}
        >
          <Ionicons
            name={isEditing ? 'checkmark-circle' : 'create-outline'}
            size={24}
            color={COLORS.primaryLight}
          />
        </TouchableOpacity>
      </View>

      {/* WhatsApp Features Navigation */}
      <View style={[styles.section, isDarkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>FEATURES</Text>

        {/* Starred Messages */}
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowStarred(true)}>
          <Ionicons name="star-outline" size={22} color="#F59E0B" style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Starred Messages</Text>
            <Text style={styles.itemSubtitle}>View your saved messages across chats</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Linked Devices */}
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowLinkedDevices(true)}>
          <Ionicons name="laptop-outline" size={22} color={COLORS.primaryLight} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Linked Devices</Text>
            <Text style={styles.itemSubtitle}>Manage Web and Desktop sessions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Communities */}
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowCommunities(true)}>
          <Ionicons name="people-outline" size={22} color="#00A884" style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Communities</Text>
            <Text style={styles.itemSubtitle}>Organize groups and view announcements</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Channels */}
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowChannels(true)}>
          <Ionicons name="newspaper-outline" size={22} color="#3B82F6" style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Channels</Text>
            <Text style={styles.itemSubtitle}>Follow updates on topics and creators</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Contact Sync */}
        <TouchableOpacity style={styles.menuRow} onPress={handleSyncContacts} disabled={isSyncingContacts}>
          <Ionicons name="sync-outline" size={22} color={COLORS.primaryLight} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Sync Device Contacts</Text>
            <Text style={styles.itemSubtitle}>Match contacts with registered users</Text>
          </View>
          {isSyncingContacts ? (
            <ActivityIndicator size="small" color={COLORS.primaryLight} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Privacy & Security */}
      <View style={[styles.section, isDarkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>PRIVACY & SECURITY</Text>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowPrivacy(true)}>
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.primaryLight} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Privacy Settings</Text>
            <Text style={styles.itemSubtitle}>Last seen, profile photo, read receipts, and blocked contacts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Theme Settings (Dark Mode) */}
      <View style={[styles.section, isDarkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>APPEARANCE</Text>
        <View style={styles.menuRow}>
          <Ionicons
            name={isDarkMode ? 'moon' : 'sunny'}
            size={22}
            color={isDarkMode ? '#34B7F1' : COLORS.primaryLight}
            style={styles.itemIcon}
          />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Dark Theme</Text>
            <Text style={styles.itemSubtitle}>{isDarkMode ? 'Dark mode enabled' : 'Light mode enabled'}</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#CBD5E1', true: COLORS.primaryLight }}
            thumbColor={isDarkMode ? COLORS.accent : '#F8FAFC'}
          />
        </View>
      </View>

      {/* Backend Server Configuration */}
      <View style={[styles.section, isDarkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>SERVER CONNECTIVITY</Text>
        <View style={styles.cardItem}>
          <Ionicons name="server-outline" size={22} color={COLORS.primaryLight} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={[styles.itemTitle, isDarkMode && styles.textDark]}>Backend API Host</Text>
            {isEditingServer ? (
              <TextInput
                style={[styles.serverInput, isDarkMode && styles.inputDark]}
                value={serverHost}
                onChangeText={setServerHost}
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.itemSubtitle}>{api.getHost()}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.pingBtn} onPress={handlePing}>
              <Ionicons name="pulse" size={16} color={COLORS.primaryLight} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editServerBtn}
              onPress={() => {
                if (isEditingServer) handleSaveServer();
                else setIsEditingServer(true);
              }}
            >
              <Text style={styles.editServerText}>{isEditingServer ? 'Save' : 'Change'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.hintText}>
          Set to your computer's Wi-Fi IP (e.g. http://192.168.1.15:5000) when testing on a physical phone.
        </Text>
      </View>

      {/* Logout & Info */}
      <View style={styles.footerSection}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log out of RSM Messenger</Text>
        </TouchableOpacity>

        <View style={styles.aboutBox}>
          <Text style={[styles.versionTitle, isDarkMode && styles.textDark]}>RSM Messenger Pro</Text>
          <Text style={styles.versionSub}>Production WhatsApp Engine v2.0</Text>
          <Text style={styles.versionSub}>Built with React Native, TypeScript & Node</Text>
        </View>
      </View>

      {/* Modals for Sub-screens */}
      {showStarred && (
        <Modal visible animationType="slide" onRequestClose={() => setShowStarred(false)}>
          <StarredMessagesScreen onBack={() => setShowStarred(false)} />
        </Modal>
      )}

      {showLinkedDevices && (
        <Modal visible animationType="slide" onRequestClose={() => setShowLinkedDevices(false)}>
          <LinkedDevicesScreen onBack={() => setShowLinkedDevices(false)} />
        </Modal>
      )}

      {showPrivacy && (
        <Modal visible animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
          <PrivacySettingsScreen
            onBack={() => setShowPrivacy(false)}
            onOpenBlockedUsers={() => setShowBlocked(true)}
          />
        </Modal>
      )}

      {showBlocked && (
        <Modal visible animationType="slide" onRequestClose={() => setShowBlocked(false)}>
          <BlockedUsersScreen onBack={() => setShowBlocked(false)} />
        </Modal>
      )}

      {showCommunities && (
        <Modal visible animationType="slide" onRequestClose={() => setShowCommunities(false)}>
          <CommunitiesScreen onBack={() => setShowCommunities(false)} />
        </Modal>
      )}

      {showChannels && (
        <Modal visible animationType="slide" onRequestClose={() => setShowChannels(false)}>
          <ChannelsScreen onBack={() => setShowChannels(false)} />
        </Modal>
      )}
    </ScrollView>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#111B21',
    borderBottomColor: '#202C33',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  profileStatus: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: COLORS.primaryLight,
    marginTop: 2,
    fontWeight: '500',
  },
  editSection: {
    flex: 1,
  },
  editInput: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primaryLight,
    paddingVertical: 4,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputDark: {
    color: '#E9EDEF',
    borderBottomColor: '#00A884',
  },
  editToggleBtn: {
    padding: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionTitleDark: {
    color: '#00A884',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemIcon: {
    width: 32,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  serverInput: {
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  pingBtn: {
    backgroundColor: 'rgba(0,168,132,0.1)',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editServerBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
  },
  editServerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginVertical: 6,
    lineHeight: 16,
  },
  footerSection: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: 'bold',
  },
  aboutBox: {
    alignItems: 'center',
  },
  versionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  versionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
