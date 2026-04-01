const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 🎯 Source point to the root file to avoid reading old resized versions
const src = String.raw`D:\project\CallRecorder\ic_app_icon_round.png`;
const base = String.raw`D:\project\CallRecorder\android\app\src\main\res`;

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

console.log('🚀 Force generating and cleaning icons...');

for (const [folder, size] of Object.entries(sizes)) {
  const dir = path.join(base, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const out1 = path.join(dir, 'ic_app_icon.png');
  const out2 = path.join(dir, 'ic_app_icon_round.png');
  const fg = path.join(dir, 'ic_launcher_foreground.png'); // Adaptive fallback

  try {
    // 1. Purane standard launcher icons delete karo taaki confusion zero ho
    const oldFiles = ['ic_launcher.png', 'ic_launcher_round.png'];
    oldFiles.forEach(file => {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    // 2. Naye icons generate karo (Sharp-cli use karke)
    execSync(`npx -y sharp-cli resize ${size} ${size} --input "${src}" --output "${out1}"`);
    execSync(`npx -y sharp-cli resize ${size} ${size} --input "${src}" --output "${out2}"`);

    // 3. Adaptive foreground bhi update karo (80% size look ke liye best hai)
    const fgSize = Math.floor(size * 0.8);
    execSync(`npx -y sharp-cli resize ${fgSize} ${fgSize} --input "${src}" --output "${fg}" --fit contain --background transparent`);

    console.log(`✅ Fixed & Updated ${folder}`);
  } catch (e) {
    console.error(`❌ Failed ${folder}: ${e.message}`);
  }
}

console.log('✨ Force Rename & Icon generation complete!');