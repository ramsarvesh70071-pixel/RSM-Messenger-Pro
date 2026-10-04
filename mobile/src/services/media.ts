import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';

export class MediaService {
  private static currentRecording: Audio.Recording | null = null;

  // 1. Pick Image from Gallery
  static async pickImage(): Promise<{ uri: string; name: string; type: string } | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      return {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType || 'image/jpeg',
      };
    }
    return null;
  }

  // 2. Take Photo with Camera
  static async takePhoto(): Promise<{ uri: string; name: string; type: string } | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `camera_${Date.now()}.jpg`;
      return {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType || 'image/jpeg',
      };
    }
    return null;
  }

  // 3. Pick Document (PDF, doc, txt)
  static async pickDocument(): Promise<{ uri: string; name: string; type: string; size?: number } | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      };
    }
    return null;
  }

  // 4. Voice Recording using real Audio.Recording
  static async startVoiceRecording(): Promise<boolean> {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.currentRecording = recording;
      return true;
    } catch (e) {
      console.warn('Failed to start voice recording:', e);
      return false;
    }
  }

  static async stopVoiceRecording(): Promise<{ uri: string; durationSec: number } | null> {
    if (!this.currentRecording) return null;

    try {
      await this.currentRecording.stopAndUnloadAsync();
      const uri = this.currentRecording.getURI();
      const status = await this.currentRecording.getStatusAsync();
      const durationSec = Math.round((status.durationMillis || 0) / 1000);
      this.currentRecording = null;

      if (uri) {
        return { uri, durationSec };
      }
    } catch (e) {
      console.warn('Failed to stop voice recording:', e);
      this.currentRecording = null;
    }
    return null;
  }

  // 5. Current Location
  static async getCurrentLocation(): Promise<{ latitude: number; longitude: number; address?: string } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address = '';
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (rev && rev.length > 0) {
          const item = rev[0];
          address = [item.name, item.street, item.city, item.region].filter(Boolean).join(', ');
        }
      } catch {}

      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address,
      };
    } catch (e) {
      console.warn('Could not get current location:', e);
      return null;
    }
  }

  // 6. Contact Sync with E.164 normalization
  static async syncDeviceContacts(): Promise<number> {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return 0;

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const phoneNumbers: string[] = [];
      for (const contact of data) {
        if (contact.phoneNumbers) {
          for (const p of contact.phoneNumbers) {
            if (p.number) {
              const cleaned = p.number.replace(/[\s\-\(\)]/g, '');
              if (cleaned.length >= 8) {
                phoneNumbers.push(cleaned);
              }
            }
          }
        }
      }

      if (phoneNumbers.length > 0) {
        const unique = Array.from(new Set(phoneNumbers));
        const res = await api.syncContacts(unique);
        return res?.data?.length || 0;
      }
      return 0;
    } catch (e) {
      console.warn('Could not sync device contacts:', e);
      return 0;
    }
  }

  // 7. Download and Share File
  static async downloadAndShare(fileUrl: string, fileName: string): Promise<void> {
    try {
      const targetFile = new File(Paths.document, fileName);
      const downloadedFile = await File.downloadFileAsync(fileUrl, targetFile, { idempotent: true });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadedFile.uri);
      }
    } catch (e) {
      console.warn('Download and share failed:', e);
    }
  }
}
