# Testing and distribution

## Validate the package

Run your extension's build, tests, and typecheck. In the monorepo, also run:

```bash
bun run lint
bun run verify:architecture
bun run verify:packages
```

The repository's package verifier covers its maintained package set; adding a new package also requires adding appropriate verification coverage. Check the **built artifact**, not just TypeScript source. Validate identity, declared capabilities, entrypoint existence, dependency resolution, and activation against the intended host.

Test invalid arguments, domain failures, disposal and reactivation, and persistence where relevant. Panels need small-card rendering checks; IPC changes need serialization and action-routing coverage.

## Prepare a release archive

Lumen's GitHub extension library reads the repository's **latest release** and selects an asset whose name contains `ragdoll` and ends in `.tar.gz`. A source-code ZIP or repository URL without a suitable release asset is not enough.

The archive must contain one top-level directory, with `package.json` and the built entry inside it. The installer strips that first directory during extraction:

```text
package/
  package.json
  dist/
    index.js
    index.d.ts
```

Include all files needed at runtime. The installer does not run a dependency installation command. Workspace dependency links from your checkout are not portable; verify dependency resolution from an isolated staged package before publishing. Bundle dependencies where appropriate for the host's runtime contract.

Once the staged `package/` directory is complete, create the archive from its parent directory:

```bash
tar -czf ragdoll-extension-word-count.tar.gz package
```

Attach it to a GitHub release. Keep the package version, runtime version, descriptor identity, and release version consistent. If GitHub supplies a SHA-256 asset digest, Lumen verifies it before extraction.

## Install in Lumen

Open **Settings → Extension Library**, add the GitHub repository URL, and install the extension. Configure any required fields before expecting it to activate. An installed extension's tools become available through the host; any visible slots can be opened through the toolbar or agent card controls.

Extension packages execute code inside the host. Install packages from authors you trust.

## Updates

Publish a new compatible archive in the repository's latest release. Preserve the stable extension ID; an update with a different ID is rejected. Test upgrade behavior with existing saved data before release.
