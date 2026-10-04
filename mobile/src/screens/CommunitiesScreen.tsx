import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { Conversation } from '../types';

interface CommunitiesScreenProps {
  onBack: () => void;
  onOpenConversation?: (conv: Conversation) => void;
}

export const CommunitiesScreen: React.FC<CommunitiesScreenProps> = ({ onBack, onOpenConversation }) => {
  const { isDarkMode, conversations } = useStore();
  const [loading, setLoading] = useState(false);

  // Group conversations by community if any, or show active group communities
  const communityGroups = conversations.filter((c) => c.isGroup);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Communities</Text>
      </View>

      {/* Hero Banner */}
      <View style={styles.heroSection}>
        <View style={styles.heroIconBox}>
          <Ionicons name="people" size={48} color={COLORS.primaryLight} />
        </View>
        <Text style={[styles.heroTitle, isDarkMode && styles.textDark]}>Stay connected with a community</Text>
        <Text style={styles.heroSubtitle}>
          Communities bring members together in topic-based groups, and make it easy to get admin announcements.
        </Text>
        <TouchableOpacity
          style={styles.newCommunityBtn}
          onPress={() => Alert.alert('New Community', 'Community creation will be enabled for your account.')}
        >
          <Text style={styles.newCommunityBtnText}>Start your community</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>Your Community Groups</Text>

      <FlatList
        data={communityGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.groupRow, isDarkMode && styles.groupRowDark]}
            onPress={() => onOpenConversation && onOpenConversation(item)}
          >
            <View style={styles.groupAvatar}>
              <Ionicons name="megaphone-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupName, isDarkMode && styles.textDark]}>{item.name}</Text>
              <Text style={styles.groupSub}>
                {item.participants.length} participants · {item.description || 'Announcements'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: COLORS.textMuted }}>No active communities found</Text>
          </View>
        }
      />
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
  heroSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,168,132,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  newCommunityBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newCommunityBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  groupRowDark: {
    borderBottomColor: '#202C33',
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  groupSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
