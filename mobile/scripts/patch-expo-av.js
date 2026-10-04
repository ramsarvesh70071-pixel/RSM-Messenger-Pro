const fs = require('fs');
const path = require('path');

const expoAvDir = path.join(__dirname, '..', 'node_modules', 'expo-av');

// 1. Remove publication from expo-module.config.json
const configPath = path.join(expoAvDir, 'expo-module.config.json');
if (fs.existsSync(configPath)) {
  let content = fs.readFileSync(configPath, 'utf8');
  if (content.includes('"publication"')) {
    content = content.replace(/,\s*"publication":\s*\{[^}]*\}/s, '');
    fs.writeFileSync(configPath, content, 'utf8');
    console.log('[patch-expo-av] Removed publication from expo-module.config.json');
  }
}

// 2. Patch ViewUtils.kt
const viewUtilsPath = path.join(expoAvDir, 'android', 'src', 'main', 'java', 'expo', 'modules', 'av', 'ViewUtils.kt');
if (fs.existsSync(viewUtilsPath)) {
  let content = fs.readFileSync(viewUtilsPath, 'utf8');
  if (content.includes('resolveView')) {
    content = content.replace(
      /try\s*\{\s*val videoWrapperView = moduleRegistry\.getModule\(UIManager::class\.java\)\.resolveView\(viewTag\)[^}]*\}\s*catch[^{]*\{[^}]*\}/gs,
      'promise.reject("E_VIDEO_TAGINCORRECT", "VideoView lookup is not supported on New Architecture.")'
    );
    fs.writeFileSync(viewUtilsPath, content, 'utf8');
    console.log('[patch-expo-av] Patched ViewUtils.kt');
  }
}

// 3. Patch FullscreenVideoPlayer.java
const playerPath = path.join(expoAvDir, 'android', 'src', 'main', 'java', 'expo', 'modules', 'av', 'video', 'FullscreenVideoPlayer.java');
if (fs.existsSync(playerPath)) {
  let content = fs.readFileSync(playerPath, 'utf8');
  if (content.includes('KeepAwakeManager')) {
    content = content.replace("import expo.modules.core.interfaces.services.KeepAwakeManager;\n", "");
    content = content.replace(
      /AppContext appContext = fullscreenVideoPlayer\.mAppContext\.get\(\);[\s\S]*?\}\s*\}\s*\}\s*\}/m,
      `if (isPlaying) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
          } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
          }
        }`
    );
    fs.writeFileSync(playerPath, content, 'utf8');
    console.log('[patch-expo-av] Patched FullscreenVideoPlayer.java');
  }
}

// 4. Patch expo-notifications warnOfExpoGoPushUsage (SDK 53+ Expo Go crash)
const notifFiles = [
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'warnOfExpoGoPushUsage.js'),
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'src', 'warnOfExpoGoPushUsage.ts'),
];
for (const notifPath of notifFiles) {
  if (fs.existsSync(notifPath)) {
    let content = fs.readFileSync(notifPath, 'utf8');
    if (content.includes('throw new Error(message);')) {
      content = content.replace('throw new Error(message);', 'console.warn(message);');
      fs.writeFileSync(notifPath, content, 'utf8');
      console.log(`[patch-expo-notifications] Patched ${path.basename(notifPath)}`);
    }
  }
}
