# Testing and distribution

## Validate the package

Run the extension's build, tests, and typecheck. Inside the monorepo, also run:

```bash
bun run lint
bun run verify:architecture
bun run verify:packages
```

`verify:packages` only checks the packages it lists, so add a new package to it. Test the built output, not just the TypeScript source: the identity, the declared capabilities, that the entry file exists, that dependencies resolve, and that the extension activates in the host you're targeting.

Cover invalid arguments, domain errors, disposing and reactivating, and persistence if the extension saves anything. Panels need a check at small card sizes. Changes that cross IPC need tests for serialization and action routing.

## Build a release archive

Lumen's extension library reads the latest release of a GitHub repository and picks the first asset whose name contains `ragdoll` and ends in `.tar.gz`. A repository URL with no such asset, or GitHub's source-code ZIP, won't install.

The archive must have a single top-level directory containing `package.json` and the built entry. The installer strips that directory when it extracts:

```text
package/
  package.json
  dist/
    index.js
    index.d.ts
```

The installer doesn't install dependencies, so the archive has to contain everything the extension needs at runtime. Workspace links from your checkout won't exist on another machine. Stage the package in an isolated directory, confirm its dependencies resolve there, and bundle dependencies where the host's runtime requires it.

With the staged `package/` directory complete, create the archive from its parent directory:

```bash
tar -czf ragdoll-extension-word-count.tar.gz package
```

Attach the archive to a GitHub release. The package version, runtime version, descriptor ID, and release version should all agree. When GitHub publishes a SHA-256 digest for the asset, Lumen checks it before extracting.

## Install in Lumen

Open Settings → Extensions → Extension library, add the GitHub repository URL, and install. Fill in any required configuration; the extension stays inactive until you do. Its tools then become available to the agent, and its cards can be opened from the toolbar or by the agent.

An extension runs its code inside Lumen, so only install packages from authors you trust.

## Updates

To ship an update, publish a new GitHub release with the new archive attached; Lumen always reads the latest release. Keep the extension ID the same; Lumen rejects an update whose ID has changed. Before releasing, test the upgrade against data saved by the previous version.
