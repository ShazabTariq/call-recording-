const fs = require('fs');
const path = require('path');
const resBase = String.raw`d:\project\CallRecorder\android\app\src\main\res\`;
const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

// Fix PNG filenames and remove duplicates
for (const folder of folders) {
  const dir = path.join(resBase, folder);
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    console.log(`Checking ${folder}...`);
    files.forEach(f => {
      // 1. Delete double extensions
      if (f.endsWith('.png.png')) {
        console.log(`Deleting double extension: ${f}`);
        fs.unlinkSync(path.join(dir, f));
      }
      // 2. Delete old launcher names to keep it clean
      if (f.startsWith('ic_launcher')) {
        console.log(`Deleting legacy launcher: ${f}`);
        fs.unlinkSync(path.join(dir, f));
      }
    });
  }
}

// 3. Create Adaptive XML properly pointing to the new name (ic_app_icon)
const anyDpi = path.join(resBase, 'mipmap-anydpi-v26');
if (!fs.existsSync(anyDpi)) fs.mkdirSync(anyDpi, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_app_icon" />
</adaptive-icon>`;

fs.writeFileSync(path.join(anyDpi, 'ic_app_icon.xml'), adaptiveXml);
fs.writeFileSync(path.join(anyDpi, 'ic_app_icon_round.xml'), adaptiveXml);

console.log('✨ All Resource Names Unified successfully!');
