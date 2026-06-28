const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const rootDir = path.join(__dirname, '..');
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(rootDir, '.next', 'standalone', '.next', 'static');
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(rootDir, '.next', 'standalone', 'public');

console.log('Copying static assets for standalone server...');
try {
  copyDirSync(staticSrc, staticDest);
  copyDirSync(publicSrc, publicDest);
  console.log('✓ Static assets copied successfully!');

  // Patch standalone server.js for app.asar compatibility
  const serverJsPath = path.join(rootDir, '.next', 'standalone', 'server.js');
  if (fs.existsSync(serverJsPath)) {
    console.log('Patching standalone server.js for app.asar compatibility...');
    let content = fs.readFileSync(serverJsPath, 'utf8');
    content = content.replace(
      'process.chdir(__dirname)',
      'try { process.chdir(__dirname) } catch (e) { console.warn("Failed to chdir:", e.message) }'
    );
    fs.writeFileSync(serverJsPath, content, 'utf8');
    console.log('✓ server.js patched successfully!');
  }
} catch (err) {
  console.error('Error in post-build step:', err);
  process.exit(1);
}
