import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

interface LinkedDevicesScreenProps {
  onBack: () => void;
}

export const LinkedDevicesScreen: React.FC<LinkedDevicesScreenProps> = ({ onBack }) => {
  const { isDarkMode } = useStore();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await api.getDevices();
      if (res?.data && Array.isArray(res.data)) {
        setDevices(res.data);
      }
    } catch (e) {
      console.warn('Failed to load devices:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    Alert.alert('Log out device', `Log out ${deviceName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.revokeDevice(deviceId);
            setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
          } catch (e) {
            Alert.alert('Error', 'Failed to log out device');
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
        <Text style={styles.headerTitle}>Linked Devices</Text>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroIconBox}>
          <Ionicons name="laptop-outline" size={48} color={COLORS.primaryLight} />
        </View>
        <Text style={[styles.heroTitle, isDarkMode && styles.textDark]}>Use RSM Messenger on Web</Text>
        <Text style={styles.heroSubtitle}>
          Use RSM Messenger on other devices to stay connected seamlessly.
        </Text>
        <TouchableOpacity
          style={styles.linkDeviceBtn}
          onPress={() => Alert.alert('Link Device', 'Point your camera at the QR code shown on web.rsm-messenger.com')}
        >
          <Text style={styles.linkDeviceBtnText}>Link a device</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>Device status</Text>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.deviceId || item._id}
          renderItem={({ item }) => {
            const isWeb = item.deviceType === 'web' || item.deviceName?.toLowerCase().includes('web') || item.deviceName?.toLowerCase().includes('chrome');

            return (
              <View style={[styles.deviceRow, isDarkMode && styles.deviceRowDark]}>
                <View style={styles.deviceIcon}>
                  <Ionicons name={isWeb ? 'desktop-outline' : 'phone-portrait-outline'} size={24} color={COLORS.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.deviceName, isDarkMode && styles.textDark]}>{item.deviceName || 'Device'}</Text>
                    {item.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>This device</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.deviceSub}>
                    Last active {new Date(item.lastActive).toLocaleDateString()} at {new Date(item.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {!item.isCurrent && (
                  <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => handleRevokeDevice(item.deviceId, item.deviceName || 'Device')}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted }}>No other linked devices</Text>
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
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  linkDeviceBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  linkDeviceBtnText: {
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  deviceRowDark: {
    borderBottomColor: '#202C33',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,168,132,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  currentBadge: {
    backgroundColor: '#DCF8C6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 11,
    color: '#00A884',
    fontWeight: '600',
  },
  deviceSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
