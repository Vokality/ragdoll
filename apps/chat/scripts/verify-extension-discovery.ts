#!/usr/bin/env bun
/**
 * Verification script to test extension discovery after installation.
 * 
 * This script:
 * 1. Checks if extensions directory exists
 * 2. Scans for installed extensions
 * 3. Verifies package.json structure
 * 4. Tests discovery logic
 * 
 * Usage:
 *   bun run scripts/verify-extension-discovery.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Get user data path (same logic as main.ts)
// In Electron, this would be app.getPath("userData")
const USER_DATA_PATH = process.env.USER_DATA_PATH ||
  (process.platform === "darwin"
    ? path.join(os.homedir(), "Library/Application Support/Lumen")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA || os.homedir(), "Lumen")
      : path.join(os.homedir(), ".lumen"));

const EXTENSIONS_PATH = path.join(USER_DATA_PATH, "extensions");
const REGISTRY_PATH = path.join(USER_DATA_PATH, "extensions-registry.json");

interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  repoUrl: string;
  installedAt: string;
}

interface ExtensionRegistry {
  extensions: Record<string, InstalledExtension>;
}

function loadRegistry(): ExtensionRegistry {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    }
  } catch (error) {
    console.error("Failed to load registry:", error);
  }
  return { extensions: {} };
}

function checkExtensionDirectory(extPath: string): {
  valid: boolean;
  errors: string[];
  packageName?: string;
} {
  const errors: string[] = [];

  // Check if directory exists
  if (!fs.existsSync(extPath)) {
    errors.push(`Directory does not exist: ${extPath}`);
    return { valid: false, errors };
  }

  // Check for package.json
  const packageJsonPath = path.join(extPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    errors.push(`package.json not found in ${extPath}`);
    return { valid: false, errors };
  }

  // Read and validate package.json
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Check for ragdollExtension field
    if (!packageJson.ragdollExtension) {
      errors.push(`package.json missing ragdollExtension field`);
    }

    // Check for package name
    if (!packageJson.name) {
      errors.push(`package.json missing name field`);
    }

    // Check for dist directory (compiled code)
    const distPath = path.join(extPath, "dist");
    if (!fs.existsSync(distPath)) {
      errors.push(`dist directory not found - extension may not be built`);
    }

    return {
      valid: errors.length === 0,
      errors,
      packageName: packageJson.name,
    };
  } catch (error) {
    errors.push(`Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors };
  }
}

function simulateDiscovery(extensionsPath: string): string[] {
  const discovered: string[] = [];

  if (!fs.existsSync(extensionsPath)) {
    return discovered;
  }

  const entries = fs.readdirSync(extensionsPath);

  for (const entry of entries) {
    // Skip hidden files/directories
    if (entry.startsWith(".")) {
      continue;
    }

    const subdirPath = path.join(extensionsPath, entry);
    const packageJsonPath = path.join(subdirPath, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

        if (packageJson.ragdollExtension && packageJson.name) {
          discovered.push(packageJson.name);
        }
      } catch {
        // Skip invalid package.json files
        continue;
      }
    }
  }

  return discovered;
}

function main() {
  console.log("🔍 Extension Discovery Verification\n");
  console.log(`User Data Path: ${USER_DATA_PATH}`);
  console.log(`Extensions Path: ${EXTENSIONS_PATH}\n`);

  // Check if extensions directory exists
  if (!fs.existsSync(EXTENSIONS_PATH)) {
    console.log("❌ Extensions directory does not exist");
    console.log("   Install an extension first to create this directory.");
    process.exit(1);
  }

  // Load registry
  const registry = loadRegistry();
  const installedExtensions = Object.values(registry.extensions);

  console.log(`📦 Found ${installedExtensions.length} installed extension(s) in registry\n`);

  if (installedExtensions.length === 0) {
    console.log("ℹ️  No extensions installed. Install an extension to test discovery.");
    process.exit(0);
  }

  // Check each extension
  let allValid = true;
  const discoveredPackages: string[] = [];

  for (const ext of installedExtensions) {
    console.log(`\n📋 Extension: ${ext.name} (${ext.id})`);
    console.log(`   Path: ${ext.path}`);
    console.log(`   Version: ${ext.version}`);

    const check = checkExtensionDirectory(ext.path);

    if (check.valid) {
      console.log(`   ✅ Valid extension structure`);
      if (check.packageName) {
        console.log(`   📦 Package name: ${check.packageName}`);
        discoveredPackages.push(check.packageName);
      }
    } else {
      console.log(`   ❌ Invalid extension structure:`);
      check.errors.forEach(err => console.log(`      - ${err}`));
      allValid = false;
    }
  }

  // Test discovery simulation
  console.log(`\n🔍 Simulating discovery process...`);
  const simulatedDiscovery = simulateDiscovery(EXTENSIONS_PATH);

  console.log(`\n📊 Discovery Results:`);
  console.log(`   Registry entries: ${installedExtensions.length}`);
  console.log(`   Discovered packages: ${simulatedDiscovery.length}`);

  if (simulatedDiscovery.length === installedExtensions.length) {
    console.log(`   ✅ All extensions discoverable`);
  } else {
    console.log(`   ⚠️  Some extensions not discoverable`);
    console.log(`   Discovered: ${simulatedDiscovery.join(", ")}`);
    allValid = false;
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  if (allValid && simulatedDiscovery.length === installedExtensions.length) {
    console.log(`✅ All checks passed! Extensions should be discoverable.`);
    process.exit(0);
  } else {
    console.log(`❌ Some checks failed. Review errors above.`);
    process.exit(1);
  }
}

main();
