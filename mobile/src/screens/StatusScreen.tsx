import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { StoryViewer } from '../components/StoryViewer';
import { COLORS } from '../config/constants';

const STATUS_COLORS = [
  '#075E54', // Emerald Green
  '#6B21A8', // Royal Purple
  '#BE123C', // Crimson Red
  '#1E3A8A', // Deep Blue
  '#B45309', // Amber Brown
  '#0F172A', // Midnight Slate
];

export const StatusScreen: React.FC = () => {
  const { stories, currentUser, postStatusUpdate, fetchStories, setActiveStory, isDarkMode } = useStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState(STATUS_COLORS[0]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStories();
    setRefreshing(false);
  };

  const myStory = stories.find((s) => s.userId === currentUser?.id);
  const otherStories = stories.filter((s) => s.userId !== currentUser?.id);

  const handlePost = async () => {
    if (!statusText.trim()) return;
    await postStatusUpdate(statusText.trim(), selectedBg);
    setStatusText('');
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <FlatList
        data={otherStories}
        keyExtractor={(item, index) => `${item.id || index}-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primaryLight]} />}
        ListHeaderComponent={
          <>
            {/* My Status Section */}
            <View style={[styles.myStatusCard, isDarkMode && styles.myStatusCardDark]}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => (myStory ? setActiveStory(myStory) : setModalVisible(true))}
              >
                <View
                  style={[
                    styles.avatar,
                    myStory ? styles.activeStatusRing : styles.noStatusRing,
                  ]}
                >
                  <Text style={styles.avatarText}>{currentUser?.name[0] || 'U'}</Text>
                </View>
                {!myStory && (
                  <View style={styles.plusBadge}>
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statusInfo}
                onPress={() => (myStory ? setActiveStory(myStory) : setModalVisible(true))}
              >
                <Text style={[styles.statusTitle, isDarkMode && styles.textDark]}>My status</Text>
                <Text style={styles.statusSubtitle}>
                  {myStory ? myStory.createdAt : 'Tap to add status update'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editBtn, isDarkMode && styles.editBtnDark]}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="pencil" size={20} color={COLORS.primaryLight} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionHeader, isDarkMode && styles.sectionHeaderDark]}>
              RECENT UPDATES
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.storyRow, isDarkMode && styles.storyRowDark]}
            onPress={() => setActiveStory(item)}
          >
            <View style={[styles.avatar, styles.activeStatusRing]}>
              <Text style={styles.avatarText}>{item.userName[0]}</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.userName, isDarkMode && styles.textDark]}>{item.userName}</Text>
              <Text style={styles.statusSubtitle}>{item.createdAt}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent updates from contacts</Text>
          </View>
        }
      />

      {/* Floating Pencil Button to add status */}
      <TouchableOpacity
        style={styles.fabPencil}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="pencil" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Story Viewer Component */}
      <StoryViewer />

      {/* Dynamic Add Status Modal with Color Picker */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={[styles.createModal, { backgroundColor: selectedBg }]}>
          {/* Header controls */}
          <View style={styles.createHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.colorPalette}>
              {STATUS_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, selectedBg === c && styles.activeColorDot]}
                  onPress={() => setSelectedBg(c)}
                />
              ))}
            </View>
          </View>

          {/* Central large text input */}
          <View style={styles.textCenterArea}>
            <TextInput
              style={styles.statusBigInput}
              placeholder="Type a status..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={statusText}
              onChangeText={setStatusText}
              multiline
              autoFocus
            />
          </View>

          {/* Bottom Send bar */}
          <View style={styles.bottomBar}>
            <Text style={styles.bottomHint}>Status will disappear after 24 hours</Text>
            <TouchableOpacity style={styles.sendFab} onPress={handlePost}>
              <Ionicons name="send" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  myStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F2F5',
  },
  myStatusCardDark: {
    borderBottomColor: '#202C33',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStatusRing: {
    borderWidth: 2.5,
    borderColor: COLORS.accent,
  },
  noStatusRing: {
    borderWidth: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  statusSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
  },
  editBtnDark: {
    backgroundColor: '#202C33',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sectionHeaderDark: {
    color: '#8696A0',
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F2F5',
  },
  storyRowDark: {
    borderBottomColor: '#202C33',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  fabPencil: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  createModal: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  closeBtn: {
    padding: 6,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 8,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  activeColorDot: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  textCenterArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  statusBigInput: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  sendFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
