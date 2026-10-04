import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TextInput,
  BackHandler,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from './src/store/useStore';
import { Header } from './src/components/Header';
import { CallOverlay } from './src/components/CallOverlay';
import { NewChatModal } from './src/components/NewChatModal';
import { AuthScreen } from './src/screens/AuthScreen';
import { ChatsScreen } from './src/screens/ChatsScreen';
import { ChatRoomScreen } from './src/screens/ChatRoomScreen';
import { StatusScreen } from './src/screens/StatusScreen';
import { CallsScreen } from './src/screens/CallsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { COLORS } from './src/config/constants';
import { NotificationService } from './src/services/notification';

// Error Boundary to prevent any launch or render crash from killing the app
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.message || 'Unknown error occurred' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#FFF" style={{ marginBottom: 16 }} />
          <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            RSM Messenger Recovery
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            {this.state.error}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#25D366', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Restart App</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const {
    currentUser,
    activeConversation,
    setActiveConversation,
    activeTab,
    restoreAuth,
    isRestoringAuth,
    searchQuery,
    setSearchQuery,
    isDarkMode,
    conversations,
  } = useStore();

  const [showNewChat, setShowNewChat] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 1. Restore auth state on launch with a guaranteed 2.5s fallback timeout
  useEffect(() => {
    let isMounted = true;
    const restorePromise = restoreAuth();
    const timeout = setTimeout(() => {
      if (isMounted && useStore.getState().isRestoringAuth) {
        useStore.setState({ isRestoringAuth: false });
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  // 2. Hardware Back Button Handling on Android
  useEffect(() => {
    const onBackPress = () => {
      if (activeConversation) {
        setActiveConversation(null);
        return true;
      }
      if (isSearching) {
        setIsSearching(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeConversation, isSearching]);

  // 3. Deep-link on notification tap
  useEffect(() => {
    const sub = NotificationService.addNotificationResponseListener((data) => {
      if (data?.chatId) {
        const target = conversations.find((c) => c.id === data.chatId);
        if (target) {
          setActiveConversation(target);
        }
      }
    });
    return () => sub?.remove?.();
  }, [conversations]);

  const headerBg = isDarkMode ? '#111B21' : COLORS.primary;

  // Luxury Splash Screen while restoring auth
  if (isRestoringAuth) {
    return (
      <View style={{ flex: 1, backgroundColor: '#05110E' }}>
        <StatusBar backgroundColor="#05110E" barStyle="light-content" translucent={false} />
        <Image
          source={require('./assets/splash.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={{ position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#D4AF37" />
        </View>
      </View>
    );
  }

  // Not logged in -> Show Auth & Verification
  if (!currentUser) {
    return (
      <SafeAreaView style={[styles.safeContainer, isDarkMode && styles.safeContainerDark]}>
        <StatusBar backgroundColor={headerBg} barStyle="light-content" translucent={false} />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  // Active Chat conversation -> Show Full Chat Room
  if (activeConversation) {
    return (
      <SafeAreaView style={[styles.safeContainer, isDarkMode && styles.safeContainerDark]} edges={['top']}>
        <StatusBar backgroundColor={headerBg} barStyle="light-content" translucent={false} />
        <ChatRoomScreen />
        <CallOverlay />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeContainer, isDarkMode && styles.safeContainerDark]}>
      <StatusBar backgroundColor={headerBg} barStyle="light-content" translucent={false} />

      {/* Main WhatsApp Header */}
      <Header
        onOpenNewChat={() => setShowNewChat(true)}
        onSearchPress={() => {
          setIsSearching(!isSearching);
          if (isSearching) setSearchQuery('');
        }}
        isSearching={isSearching}
      />

      {/* Search Input Bar (when search is toggled) */}
      {isSearching && (
        <View style={[styles.searchBarContainer, isDarkMode && styles.searchBarContainerDark]}>
          <TextInput
            style={[styles.searchBarInput, isDarkMode && styles.searchBarInputDark]}
            placeholder="Search chats, contacts, or messages..."
            placeholderTextColor={isDarkMode ? '#8696A0' : COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* Tab Screen Content */}
      <View style={[styles.mainContent, isDarkMode && styles.mainContentDark]}>
        {activeTab === 'chats' && <ChatsScreen />}
        {activeTab === 'status' && <StatusScreen />}
        {activeTab === 'calls' && <CallsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Modals & Overlays */}
      <CallOverlay />
      <NewChatModal visible={showNewChat} onClose={() => setShowNewChat(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <MainApp />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  safeContainerDark: {
    backgroundColor: '#111B21',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContentDark: {
    backgroundColor: '#0B141A',
  },
  searchBarContainer: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBarContainerDark: {
    backgroundColor: '#202C33',
  },
  searchBarInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  searchBarInputDark: {
    backgroundColor: '#111B21',
    color: '#E9EDEF',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContainerDark: {
    backgroundColor: '#0B141A',
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,168,132,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  splashFooter: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  splashFooterSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  splashFooterBrand: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    letterSpacing: 1,
  },
  textDark: {
    color: '#E9EDEF',
  },
});
