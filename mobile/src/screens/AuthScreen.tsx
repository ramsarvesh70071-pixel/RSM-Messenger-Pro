import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';
import { api } from '../services/api';

const REAL_TEST_ACCOUNTS = [
  { name: 'Ramsarvesh (Admin)', phone: '+919876543210' },
  { name: 'Aarav Sharma', phone: '+919876543211' },
  { name: 'Priya Patel', phone: '+919876543212' },
  { name: 'Rohan Verma', phone: '+919876543213' },
];

export const AuthScreen: React.FC = () => {
  const { requestOtp, verifyOtp, isLoading, error } = useStore();
  const [phone, setPhone] = useState('+919876543210');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hostInput, setHostInput] = useState(api.getHost());
  const [showHostConfig, setShowHostConfig] = useState(false);
  const [testingHost, setTestingHost] = useState(false);

  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number with country code (e.g. +919876543210)');
      return;
    }
    const res = await requestOtp(phone.trim());
    if (res.success) {
      setStep('otp');
      Alert.alert('Verification Code Sent', res.message + '\n\nDefault Demo OTP is: 123456');
    } else {
      Alert.alert('Failed', res.message);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code (default: 123456)');
      return;
    }
    const success = await verifyOtp(phone.trim(), otp.trim());
    if (!success) {
      Alert.alert('Authentication Failed', error || 'Invalid OTP. Please check your credentials or server connection.');
    }
  };

  const selectDemoAccount = (accPhone: string) => {
    setPhone(accPhone);
    setOtp('123456');
  };

  const saveHost = (newHost?: string) => {
    const target = newHost || hostInput;
    api.setHost(target);
    setHostInput(target);
    Alert.alert('Backend Updated', `Active API host set to:\n${target}`);
    setShowHostConfig(false);
  };

  const pingServer = async () => {
    setTestingHost(true);
    try {
      const startTime = Date.now();
      await fetch(`${api.getHost()}/health`, { method: 'GET' });
      const ms = Date.now() - startTime;
      Alert.alert('Connected! ✅', `Backend is live and responding in ${ms}ms!\nHost: ${api.getHost()}`);
    } catch (err: any) {
      Alert.alert('Connection Failed ❌', `Could not reach ${api.getHost()}.\nEnsure backend server is running.\n\nError: ${err.message}`);
    } finally {
      setTestingHost(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Ionicons name="chatbubbles" size={46} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Welcome to RSM Messenger</Text>
        <Text style={styles.subtitle}>
          Full-Stack real-time messaging, WebRTC calling & 24h stories powered by React Native and MongoDB.
        </Text>
      </View>

      <View style={styles.card}>
        {step === 'phone' ? (
          <>
            <Text style={styles.stepTitle}>Enter your phone number</Text>
            <Text style={styles.stepDesc}>
              RSM Messenger will verify your account with SMS OTP code.
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="call" size={20} color={COLORS.primaryLight} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>GET VERIFICATION CODE</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stepTitle}>Enter 6-digit Code</Text>
            <Text style={styles.stepDesc}>Code sent to {phone}. Auto-fill demo code: 123456</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="keypad" size={20} color={COLORS.primaryLight} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="123456"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>VERIFY & LOGIN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('phone')}>
              <Text style={styles.linkText}>Wrong number? Change phone</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Quick Test Accounts from MongoDB */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>QUICK LOGIN WITH REGISTERED USERS:</Text>
          <View style={styles.demoChips}>
            {REAL_TEST_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.phone}
                style={[styles.chip, phone === acc.phone && styles.activeChip]}
                onPress={() => selectDemoAccount(acc.phone)}
              >
                <Text style={[styles.chipText, phone === acc.phone && styles.activeChipText]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dynamic Server Host Config */}
        <View style={styles.hostSection}>
          <TouchableOpacity
            style={styles.toggleHostBtn}
            onPress={() => setShowHostConfig(!showHostConfig)}
          >
            <Ionicons name="server-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.toggleHostText}>
              Server: {api.getHost()} ({showHostConfig ? 'Close' : 'Change'})
            </Text>
          </TouchableOpacity>

          {showHostConfig && (
            <View style={styles.hostBox}>
              <Text style={styles.hostHint}>
                Select a preset or enter custom host IP (e.g. PC's Wi-Fi IP http://192.168.1.X:5000):
              </Text>

              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[styles.presetBtn, { backgroundColor: COLORS.primaryLight }]}
                  onPress={() => saveHost('https://rsm-messenger-pro.onrender.com')}
                >
                  <Text style={[styles.presetText, { color: '#FFFFFF' }]}>Cloud Live (Render)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => saveHost('http://10.0.2.2:5000')}
                >
                  <Text style={styles.presetText}>Emulator</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => saveHost('http://localhost:5000')}
                >
                  <Text style={styles.presetText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.hostInput}
                value={hostInput}
                onChangeText={setHostInput}
                autoCapitalize="none"
              />

              <View style={styles.hostActions}>
                <TouchableOpacity style={styles.testBtn} onPress={pingServer} disabled={testingHost}>
                  <Text style={styles.testBtnText}>{testingHost ? 'Pinging...' : 'Test Ping'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveHostBtn} onPress={() => saveHost()}>
                  <Text style={styles.saveHostText}>Save Host</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primaryLight,
    paddingVertical: 10,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  linkBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  linkText: {
    color: COLORS.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  demoSection: {
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  demoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F0F2F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeChip: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  hostSection: {
    marginTop: 20,
    paddingTop: 8,
  },
  toggleHostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleHostText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  hostBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hostHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  presetBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  hostInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginBottom: 8,
  },
  hostActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  testBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  testBtnText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  saveHostBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  saveHostText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
