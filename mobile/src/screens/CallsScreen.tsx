import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { CallSession, User } from '../types';
import { NewChatModal } from '../components/NewChatModal';

export const CallsScreen: React.FC = () => {
  const { calls, startCall, currentUser, fetchCallHistory, isDarkMode } = useStore();
  const [showCallPicker, setShowCallPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCallHistory();
    setRefreshing(false);
  };

  const renderCallArrow = (call: CallSession) => {
    const isCaller = call.caller.id === currentUser?.id;
    if (call.status === 'missed') {
      return <Ionicons name="arrow-down" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />;
    }
    if (isCaller) {
      return <Ionicons name="arrow-up" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />;
    }
    return <Ionicons name="arrow-down" size={16} color={COLORS.accent} style={{ marginRight: 6 }} />;
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primaryLight]} />}
        renderItem={({ item }) => {
          const target = item.caller.id === currentUser?.id ? item.receiver : item.caller;
          return (
            <View style={[styles.callRow, isDarkMode && styles.callRowDark]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{target.name[0] || 'U'}</Text>
              </View>

              <View style={styles.callDetails}>
                <Text style={[styles.callerName, isDarkMode && styles.textDark]}>{target.name}</Text>
                <View style={styles.statusRow}>
                  {renderCallArrow(item)}
                  <Text style={styles.statusText}>
                    {item.status === 'missed'
                      ? 'Missed call'
                      : item.duration
                      ? `${item.duration}s call`
                      : 'Connected'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => startCall(target, item.type)}
              >
                <Ionicons
                  name={item.type === 'video' ? 'videocam' : 'call'}
                  size={22}
                  color={COLORS.primaryLight}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="call-outline" size={54} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, isDarkMode && styles.textDark]}>No call logs yet</Text>
            <Text style={styles.emptySubText}>
              To make peer-to-peer WebRTC voice & video calls, tap the call button below.
            </Text>
          </View>
        }
      />

      {/* Floating Action Button (New Call) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setShowCallPicker(true)}
      >
        <Ionicons name="call" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <NewChatModal visible={showCallPicker} onClose={() => setShowCallPicker(false)} />
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
  callRowDark: {
    borderBottomColor: '#202C33',
  },
  textDark: {
    color: '#E9EDEF',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F2F5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callDetails: {
    flex: 1,
  },
  callerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionBtn: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  emptyContainer: {
    paddingTop: 80,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 14,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});
