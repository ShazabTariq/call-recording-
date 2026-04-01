const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 🎯 Point this to your FRESH icon in the main project folder
const src = String.raw`D:\project\CallRecorder\ic_app_icon_round.png`;
const resBase = String.raw`D:\project\CallRecorder\android\app\src\main\res`;

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

console.log('🚀 Starting Icon Generation...');

for (const [folder, size] of Object.entries(sizes)) {
  const dir = path.join(resBase, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const out1 = path.join(dir, 'ic_launcher.png');
  const out2 = path.join(dir, 'ic_launcher_round.png');
  const fg = path.join(dir, 'ic_launcher_foreground.png');

  try {
    // 1. Generate Legacy Icons
    execSync(`npx -y sharp-cli resize ${size} ${size} --input "${src}" --output "${out1}"`);
    execSync(`npx -y sharp-cli resize ${size} ${size} --input "${src}" --output "${out2}"`);

    // 2. Generate Foreground for Adaptive Icon (Must be 108dp equivalent, 60-70% size is safe)
    const fgSize = Math.floor(size * 0.7);
    execSync(`npx -y sharp-cli resize ${size} ${size} --input "${src}" --output "${fg}" --fit contain --background transparent`);

    console.log(`✅ Generated icons for ${folder}`);
  } catch (e) {
    console.error(`❌ Failed ${folder}: ${e.message}`);
  }
}

// 3. Adaptive XML Setup
const anyDpi = path.join(resBase, 'mipmap-anydpi-v26');
if (!fs.existsSync(anyDpi)) fs.mkdirSync(anyDpi, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

fs.writeFileSync(path.join(anyDpi, 'ic_launcher.xml'), adaptiveXml);
fs.writeFileSync(path.join(anyDpi, 'ic_launcher_round.xml'), adaptiveXml);

console.log('✨ All Adaptive Icon resources created successfully!');