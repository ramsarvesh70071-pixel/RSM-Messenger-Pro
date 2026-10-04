import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

interface ChannelsScreenProps {
  onBack: () => void;
}

const SAMPLE_CHANNELS = [
  {
    id: 'ch-1',
    name: 'RSM Messenger Official',
    description: 'Latest product updates, features, and tips from the RSM engineering team.',
    followers: '1.2M',
    isVerified: true,
    isFollowing: true,
    lastUpdate: 'We just launched real WebRTC calling with time-limited TURN credentials! 🚀',
    time: '10:30 AM',
  },
  {
    id: 'ch-2',
    name: 'Tech & AI Insights',
    description: 'Curated news and breakthroughs in AI and full-stack development.',
    followers: '450K',
    isVerified: true,
    isFollowing: false,
    lastUpdate: 'Real-time WebSocket vs HTTP polling in modern applications.',
    time: 'Yesterday',
  },
  {
    id: 'ch-3',
    name: 'India Tech Radar',
    description: 'Startup ecosystem, open source, and developer stories across India.',
    followers: '85K',
    isVerified: false,
    isFollowing: false,
    lastUpdate: 'Top upcoming developer hackathons and meetups in Bengaluru & Delhi.',
    time: '2 days ago',
  },
];

export const ChannelsScreen: React.FC<ChannelsScreenProps> = ({ onBack }) => {
  const { isDarkMode } = useStore();
  const [channels, setChannels] = useState(SAMPLE_CHANNELS);

  const toggleFollow = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, isFollowing: !c.isFollowing } : c))
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Channels</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.introBox}>
          <Text style={[styles.introTitle, isDarkMode && styles.textDark]}>Stay updated on topics you care about</Text>
          <Text style={styles.introSubtitle}>
            Find channels to follow below. Channels are public, so anyone can find and view them.
          </Text>
        </View>

        <Text style={styles.sectionHeading}>Featured Channels</Text>

        {channels.map((item) => (
          <View key={item.id} style={[styles.channelCard, isDarkMode && styles.channelCardDark]}>
            <View style={styles.cardHeader}>
              <View style={styles.channelAvatar}>
                <Ionicons name="newspaper-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.channelName, isDarkMode && styles.textDark]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color="#00A884" style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text style={styles.followerCount}>{item.followers} followers</Text>
              </View>

              <TouchableOpacity
                style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                onPress={() => toggleFollow(item.id)}
              >
                <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.channelDesc, isDarkMode && styles.textDark]} numberOfLines={2}>
              {item.description}
            </Text>

            <View style={styles.updateCard}>
              <Text style={[styles.updateText, isDarkMode && styles.textDark]}>{item.lastUpdate}</Text>
              <Text style={styles.updateTime}>{item.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 12,
  },
  introBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryLight,
    paddingHorizontal: 4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  channelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  channelCardDark: {
    backgroundColor: '#111B21',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  followerCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  followBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followingBtnText: {
    color: COLORS.primaryLight,
  },
  channelDesc: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
  },
  updateCard: {
    backgroundColor: 'rgba(0,168,132,0.06)',
    borderRadius: 8,
    padding: 10,
  },
  updateText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  updateTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
