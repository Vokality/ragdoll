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

  // In Bun workspaces, dependencies are in the workspace root, not the app directory
  let sourceNodeModules = path.join(context.packager.projectDir, 'node_modules');

  // If app-level node_modules doesn't exist, use workspace root (up 2 levels from apps/chat)
  if (!fs.existsSync(sourceNodeModules)) {
    sourceNodeModules = path.resolve(context.packager.projectDir, '../..', 'node_modules');
  }

  const targetNodeModules = path.join(appResourcesPath, 'node_modules');

  console.log(`[afterPack] Copying node_modules from ${sourceNodeModules} to ${targetNodeModules}`);

  // Dynamically discover all @vokality packages in node_modules
  const vokality = path.join(sourceNodeModules, '@vokality');
  const allowedPackages = new Set();

  if (fs.existsSync(vokality)) {
    const packages = fs.readdirSync(vokality, { withFileTypes: true });
    for (const pkg of packages) {
      // Check both directories and symlinks (Bun workspaces use symlinks)
      if (pkg.isDirectory() || pkg.isSymbolicLink()) {
        // Include core ragdoll packages and all extensions
        if (pkg.name === 'ragdoll' ||
            pkg.name === 'ragdoll-extensions' ||
            pkg.name.startsWith('ragdoll-extension-')) {
          allowedPackages.add(pkg.name);
        }
      }
    }
  }

  const allowedScopedPackages = {
    '@vokality': allowedPackages,
  };

  console.log(`[afterPack] Found ${allowedPackages.size} @vokality packages to bundle:`);
  for (const pkg of allowedPackages) {
    console.log(`  - @vokality/${pkg}`);
  }

  function copyNodeModules(src, dest) {
    if (!fs.existsSync(src)) {
      console.log(`[afterPack] Source node_modules not found at ${src}, skipping copy`);
      return;
    }

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

          // Resolve symlinks before copying (important for Bun workspaces)
          const resolvedSrc = fs.lstatSync(scopedSrc).isSymbolicLink()
            ? fs.realpathSync(scopedSrc)
            : scopedSrc;

          console.log(`[afterPack]   Copying ${scopedEntry.name}${resolvedSrc !== scopedSrc ? ' (resolved symlink)' : ''}`);
          fs.cpSync(resolvedSrc, scopedDest, { recursive: true });
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
