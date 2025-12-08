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

  const allowedScopedPackages = {
    '@vokality': new Set([
      'ragdoll',
      'ragdoll-extensions',
      'ragdoll-extension-character',
      'ragdoll-extension-tasks',
      'ragdoll-extension-pomodoro',
    ]),
  };

  function copyNodeModules(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.name === '.bin' || entry.name === '.cache' || entry.name === '.vite' || entry.name === '.vite-temp') {
        continue;
      }

      if (entry.isDirectory() && entry.name.startsWith('@')) {
        const allowed = allowedScopedPackages[entry.name];
        if (!allowed) {
          continue;
        }

        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }

        const scopedEntries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const scopedEntry of scopedEntries) {
          if (!allowed.has(scopedEntry.name)) {
            continue;
          }
          const scopedSrc = path.join(srcPath, scopedEntry.name);
          const scopedDest = path.join(destPath, scopedEntry.name);
          fs.cpSync(scopedSrc, scopedDest, { recursive: true });
        }
        continue;
      }

      if (entry.isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyNodeModules(sourceNodeModules, targetNodeModules);
  console.log(`[afterPack] node_modules copied successfully`);
}
