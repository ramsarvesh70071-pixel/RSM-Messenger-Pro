import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

const { width, height } = Dimensions.get('window');

export const StoryViewer: React.FC = () => {
  const { activeStory, setActiveStory } = useStore();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!activeStory) return;

    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(interval);
          setActiveStory(null);
          return 1;
        }
        return prev + 0.02;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStory]);

  if (!activeStory) return null;

  return (
    <Modal visible={!!activeStory} animationType="fade" transparent={false}>
      <View style={styles.container}>
        {/* Progress Bar Header */}
        <View style={styles.header}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.userInfoRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{activeStory.userName[0]}</Text>
            </View>
            <View style={styles.names}>
              <Text style={styles.userName}>{activeStory.userName}</Text>
              <Text style={styles.storyTime}>{activeStory.createdAt}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveStory(null)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Media / Story Content */}
        <View style={styles.imageWrapper}>
          <Image source={{ uri: activeStory.mediaUrl }} style={styles.storyImage} resizeMode="contain" />
        </View>

        {/* Caption */}
        {activeStory.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>{activeStory.caption}</Text>
          </View>
        )}

        {/* Footer View Count */}
        <View style={styles.footer}>
          <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>{activeStory.viewers.length} views</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  names: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  storyTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: width,
    height: height * 0.7,
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
});
