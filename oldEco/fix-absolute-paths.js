// fix-absolute-paths.js
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist/invo-ecommerce-front');

function fixFilesInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixFilesInDir(fullPath);
    } else if (file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.mjs') || file.endsWith('.map') || file.endsWith('.js')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        const updated = content
              //.replace(/(=?,?\s*["'])\/?(assets\/)/g, '$1./$2')
                    .replace(/(url\s*\(\s*\\?["']?)\/?(assets\/)/g, '$1./$2')
                    .replace(/(src\\?["']\s*,\s*\\?["'])\/?(assets\/)/g, '$1./$2')
                    .replace(/(src\s*=\s*\\?["'])\/?(assets\/)/g, '$1./$2')
                    ;
        if (updated !== content) {
          fs.writeFileSync(fullPath, updated, 'utf8');
          console.log(`Fixed: ${fullPath}`);
        }
      }
  }
}

fixFilesInDir(distPath);
console.log('✅ Absolute paths fixed.');
