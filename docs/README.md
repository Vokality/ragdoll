# Lumen documentation

The public documentation lives in `docs/site` and is built with VitePress. The other Markdown files in this directory describe internal architecture contracts.

From the repository root:

```bash
bun install --frozen-lockfile
bun run docs:dev
bun run docs:build
bun run docs:preview
```

The site uses `/ragdoll/` as its base path for `https://vokality.github.io/ragdoll/`. The production output is `docs/site/.vitepress/dist`; do not commit generated output or the VitePress cache.

The Documentation workflow builds pull requests and deploys changes on `main` to GitHub Pages. In repository Settings → Pages, the source must be **GitHub Actions**. A manual workflow dispatch on `main` can also deploy. No custom domain is configured.

Keep guides grounded in current behavior. Run `bun run docs:build` to check internal links and inspect the production preview at desktop and mobile widths before publishing navigation or theme changes.

## Vokality theme

The documentation theme follows `vokality-website/app/globals.css`, `app/fonts.ts`, and `app/page.module.css`: warm charcoal, orange accents, square controls, IBM Plex Sans body text, and Manrope headings. VitePress uses a fixed dark appearance to match that site.

The Latin variable font assets and Vokality wordmark are hosted under `docs/site/public`; font licenses are included beside the WOFF2 files. No runtime requests to Google Fonts are needed. Theme overrides live in `docs/site/.vitepress/theme/custom.css`. Restart `docs:preview` after rebuilding so its static asset index reflects the new build.
