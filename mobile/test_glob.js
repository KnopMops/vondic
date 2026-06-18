const glob = require('@react-native-community/cli-platform-android/node_modules/glob') || require('glob');
const fs = require('fs');
const path = require('path');

const folder = 'D:\\vondic\\mobile\\node_modules\\react-native-keychain\\android';
try {
  const files = glob.sync('**/+(*.java|*.kt)', { cwd: folder });
  console.log('Glob found files:', files.length);
  for (const f of files) {
    const full = path.join(folder, f);
    const exists = fs.existsSync(full);
    console.log(`File: ${f} -> Exists: ${exists}`);
  }
} catch (e) {
  console.error(e);
}
