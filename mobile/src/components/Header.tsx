import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useStore } from '../store/useStore';

interface HeaderProps {
  onOpenNewChat: () => void;
  onSearchPress: () => void;
  isSearching: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewChat, onSearchPress, isSearching }) => {
  const { activeTab, setActiveTab, conversations, isDarkMode } = useStore();

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <StatusBar backgroundColor={isDarkMode ? '#111B21' : COLORS.primary} barStyle="light-content" />
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <Text style={styles.brandTitle}>RSM Messenger</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress}>
            <Ionicons name={isSearching ? 'close' : 'search'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenNewChat}>
            <MaterialCommunityIcons name="chat-plus" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setActiveTab(activeTab === 'settings' ? 'chats' : 'settings')}
          >
            <Ionicons
              name={activeTab === 'settings' ? 'chatbubble-ellipses' : 'ellipsis-vertical'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'chats' && styles.activeTabItem]}
          onPress={() => setActiveTab('chats')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabLabel, activeTab === 'chats' && styles.activeTabLabel]} numberOfLines={1}>CHATS</Text>
            {totalUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalUnread}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'status' && styles.activeTabItem]}
          onPress={() => setActiveTab('status')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabLabel, activeTab === 'status' && styles.activeTabLabel]} numberOfLines={1}>STATUS</Text>
            <View style={styles.statusDot} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'calls' && styles.activeTabItem]}
          onPress={() => setActiveTab('calls')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabLabel, activeTab === 'calls' && styles.activeTabLabel]} numberOfLines={1}>CALLS</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.activeTabItem]}
          onPress={() => setActiveTab('settings')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabLabel, activeTab === 'settings' && styles.activeTabLabel]} numberOfLines={1}>SETTINGS</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  containerDark: {
    backgroundColor: '#111B21',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 6,
  },
  tabBar: {
    flexDirection: 'row',
    height: 44,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#FFFFFF',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activeTabLabel: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#25D366',
    marginLeft: 6,
  },
});
