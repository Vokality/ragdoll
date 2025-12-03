import * as fs from 'fs';
import * as path from 'path';

export default async function afterPack(context) {
  const appOutDir = context.appOutDir;
  let appResourcesPath;

  if (context.electronPlatformName === 'darwin') {
    appResourcesPath = path.join(
      appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      'Contents',
      'Resources',
      'app'
    );
  } else {
    appResourcesPath = path.join(appOutDir, 'resources', 'app');
  }

  const sourceNodeModules = path.join(context.packager.projectDir, 'node_modules');
  const targetNodeModules = path.join(appResourcesPath, 'node_modules');

  console.log(`[afterPack] Copying node_modules from ${sourceNodeModules} to ${targetNodeModules}`);

  // Remove @vokality from node_modules (already bundled in renderer)
  function copyNodeModules(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Skip @vokality workspace packages and dev-only directories
      if (entry.name === '@vokality' || entry.name === '.bin' || entry.name === '.cache' || entry.name === '.vite' || entry.name === '.vite-temp') {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.name.startsWith('@')) {
          // Handle scoped packages
          copyNodeModules(srcPath, destPath);
        } else {
          // Copy entire package directory
          fs.cpSync(srcPath, destPath, { recursive: true });
        }
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyNodeModules(sourceNodeModules, targetNodeModules);
  console.log(`[afterPack] node_modules copied successfully`);
}
