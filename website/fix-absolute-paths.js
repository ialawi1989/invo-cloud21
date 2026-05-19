// fix-absolute-paths.js
// Post-build pass to rewrite root-absolute /assets/... references to
// ./assets/... so the bundle works when served from a non-root path.
// Ported from oldEco. Mirrors the same regex set so behavior is identical.
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist/website');

function fixFilesInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixFilesInDir(fullPath);
    } else if (
      file.endsWith('.css') ||
      file.endsWith('.html') ||
      file.endsWith('.mjs') ||
      file.endsWith('.map') ||
      file.endsWith('.js')
    ) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const updated = content
        .replace(/(url\s*\(\s*\\?["']?)\/?(assets\/)/g, '$1./$2')
        .replace(/(src\\?["']\s*,\s*\\?["'])\/?(assets\/)/g, '$1./$2')
        .replace(/(src\s*=\s*\\?["'])\/?(assets\/)/g, '$1./$2');
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Fixed: ${fullPath}`);
      }
    }
  }
}

fixFilesInDir(distPath);
console.log('Absolute paths fixed.');
