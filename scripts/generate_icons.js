const path = require('path');
const fs = require('fs');
const sharp = require('../server/node_modules/sharp');

const sourceIcon = 'C:\\Users\\JAY_SHREE_RAM\\.gemini\\antigravity-ide\\brain\\0ffbaade-372d-4738-9d72-285f6e6206fc\\rsm_dhaansu_icon_1790999489141.jpg';
const mobileDir = path.resolve(__dirname, '../mobile');
const resDir = path.resolve(mobileDir, 'android/app/src/main/res');

async function buildIcons() {
  console.log('Generating ultra-dhaansu app icons from:', sourceIcon);

  // 1. Copy master icon to project root
  await sharp(sourceIcon).resize(1024, 1024).png().toFile(path.resolve(__dirname, '../app_icon.png'));
  console.log('Created app_icon.png at project root');

  // 2. Mobile assets
  await sharp(sourceIcon).resize(1024, 1024).png().toFile(path.resolve(mobileDir, 'assets/icon.png'));
  await sharp(sourceIcon).resize(1024, 1024).png().toFile(path.resolve(mobileDir, 'assets/android-icon-foreground.png'));
  await sharp(sourceIcon).resize(512, 512).png().toFile(path.resolve(mobileDir, 'assets/splash-icon.png'));
  await sharp(sourceIcon).resize(192, 192).png().toFile(path.resolve(mobileDir, 'assets/favicon.png'));
  console.log('Updated mobile/assets icons');

  // 3. Android res mipmap densities
  const densities = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const d of densities) {
    const targetDir = path.resolve(resDir, d.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.webp
    await sharp(sourceIcon)
      .resize(d.size, d.size)
      .webp({ quality: 95 })
      .toFile(path.resolve(targetDir, 'ic_launcher.webp'));

    // ic_launcher_round.webp
    await sharp(sourceIcon)
      .resize(d.size, d.size)
      .webp({ quality: 95 })
      .toFile(path.resolve(targetDir, 'ic_launcher_round.webp'));

    // ic_launcher_foreground.webp
    await sharp(sourceIcon)
      .resize(d.fgSize, d.fgSize)
      .webp({ quality: 95 })
      .toFile(path.resolve(targetDir, 'ic_launcher_foreground.webp'));

    console.log(`Updated ${d.dir} icons`);
  }

  console.log('All Dhaansu Android App Icons successfully generated!');
}

buildIcons().catch(console.error);
