import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { Conversation, Message } from '../types';
import { MediaService } from '../services/media';

interface MediaGalleryScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 32) / 3;

export const MediaGalleryScreen: React.FC<MediaGalleryScreenProps> = ({ conversation, onBack }) => {
  const { messages, isDarkMode } = useStore();
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');

  const convMessages = messages[conversation.id] || [];

  const mediaMessages = convMessages.filter(
    (m) => (m.type === 'image' || m.type === 'video') && m.attachments && m.attachments.length > 0
  );

  const docMessages = convMessages.filter(
    (m) => m.type === 'document' && m.attachments && m.attachments.length > 0
  );

  const linkMessages = convMessages.filter(
    (m) => m.content && (m.content.includes('http://') || m.content.includes('https://'))
  );

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{conversation.name}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, isDarkMode && styles.tabBarDark]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'media' && styles.tabItemActive]}
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabText, activeTab === 'media' && styles.tabTextActive]}>
            MEDIA ({mediaMessages.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'docs' && styles.tabItemActive]}
          onPress={() => setActiveTab('docs')}
        >
          <Text style={[styles.tabText, activeTab === 'docs' && styles.tabTextActive]}>
            DOCS ({docMessages.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'links' && styles.tabItemActive]}
          onPress={() => setActiveTab('links')}
        >
          <Text style={[styles.tabText, activeTab === 'links' && styles.tabTextActive]}>
            LINKS ({linkMessages.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'media' && (
        <FlatList
          data={mediaMessages}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            const att = item.attachments?.[0];
            if (!att) return null;
            return (
              <View style={styles.gridItem}>
                <Image source={{ uri: att.thumbnailUrl || att.url }} style={styles.gridImage} resizeMode="cover" />
                {item.type === 'video' && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>No media shared</Text>
            </View>
          }
        />
      )}

      {activeTab === 'docs' && (
        <FlatList
          data={docMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const att = item.attachments?.[0];
            if (!att) return null;
            return (
              <TouchableOpacity
                style={[styles.docRow, isDarkMode && styles.docRowDark]}
                onPress={() => MediaService.downloadAndShare(att.url, att.fileName || 'file.pdf')}
              >
                <View style={styles.docIcon}>
                  <Ionicons name="document-text" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docName, isDarkMode && styles.textDark]} numberOfLines={1}>
                    {att.fileName || 'Document'}
                  </Text>
                  <Text style={styles.docMeta}>
                    {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : ''} · {item.createdAt}
                  </Text>
                </View>
                <Ionicons name="download-outline" size={20} color={COLORS.primaryLight} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>No documents shared</Text>
            </View>
          }
        />
      )}

      {activeTab === 'links' && (
        <FlatList
          data={linkMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.linkRow, isDarkMode && styles.linkRowDark]}>
              <View style={styles.linkIcon}>
                <Ionicons name="link-outline" size={22} color={COLORS.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkUrl} numberOfLines={2}>
                  {item.content}
                </Text>
                <Text style={styles.docMeta}>{item.createdAt}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="link-outline" size={64} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>No links shared</Text>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
  },
  tabBarDark: {
    backgroundColor: '#111B21',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  gridContent: {
    padding: 8,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    gap: 12,
  },
  docRowDark: {
    backgroundColor: '#111B21',
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  docMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    gap: 12,
  },
  linkRowDark: {
    backgroundColor: '#111B21',
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,168,132,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkUrl: {
    fontSize: 13,
    color: '#0284C7',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 12,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
