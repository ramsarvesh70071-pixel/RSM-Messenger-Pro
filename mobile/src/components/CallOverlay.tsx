import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { COLORS } from '../config/constants';

export const CallOverlay: React.FC = () => {
  const { activeCall, endCall, acceptCall, currentUser } = useStore();
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const isIncoming = activeCall && activeCall.receiver.id === currentUser?.id && activeCall.status === 'ringing';

  useEffect(() => {
    let timer: any;
    if (activeCall?.status === 'connected') {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  if (!activeCall) return null;

  const targetPerson = activeCall.caller.id === currentUser?.id ? activeCall.receiver : activeCall.caller;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={!!activeCall} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.encryptionBadge}>
            <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.encryptionText}>End-to-end encrypted</Text>
          </View>
        </View>

        {/* Center Profile / Video area */}
        <View style={styles.centerArea}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {targetPerson.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>

          <Text style={styles.callerName}>{targetPerson.name}</Text>
          <Text style={styles.callStatus}>
            {activeCall.status === 'ringing'
              ? isIncoming
                ? 'Incoming WhatsApp call...'
                : 'Ringing...'
              : formatTimer(seconds)}
          </Text>
          <Text style={styles.callType}>{activeCall.type.toUpperCase()} CALL</Text>
        </View>

        {/* Bottom Call Controls */}
        <View style={styles.controlsArea}>
          {isIncoming ? (
            <View style={styles.incomingActions}>
              <TouchableOpacity style={[styles.controlBtn, styles.declineBtn]} onPress={endCall}>
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlBtn, styles.acceptBtn]} onPress={acceptCall}>
                <Ionicons name="call" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inCallActions}>
              <TouchableOpacity
                style={[styles.smallBtn, isMuted && styles.activeSmallBtn]}
                onPress={() => setIsMuted(!isMuted)}
              >
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {activeCall.type === 'video' && (
                <TouchableOpacity
                  style={[styles.smallBtn, !isVideoEnabled && styles.activeSmallBtn]}
                  onPress={() => setIsVideoEnabled(!isVideoEnabled)}
                >
                  <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.smallBtn, isSpeaker && styles.activeSmallBtn]}
                onPress={() => setIsSpeaker(!isSpeaker)}
              >
                <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1E24',
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  topHeader: {
    alignItems: 'center',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  encryptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginLeft: 6,
  },
  centerArea: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
  },
  avatarInitials: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  callType: {
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
    color: COLORS.accent,
  },
  controlsArea: {
    alignItems: 'center',
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
  },
  inCallActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
  },
  smallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeSmallBtn: {
    backgroundColor: '#FFFFFF',
  },
});
