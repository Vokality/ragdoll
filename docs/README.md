# Lumen documentation

The public documentation lives in `docs/site` and is built with Bun’s native Markdown parser and bundler. The other Markdown files in this directory describe internal architecture contracts.

From the repository root:

```bash
bun install --frozen-lockfile
bun run docs:dev
bun run docs:build
bun run docs:preview
```

Development and preview serve `http://localhost:4174/ragdoll/`. Development rebuilds and reloads when Markdown or assets change. Its output is isolated in `docs/site/.dev`.

The site uses `/ragdoll/` as its base path for `https://vokality.github.io/ragdoll/`. The production output is `docs/site/dist`; do not commit generated output.

The Documentation workflow builds pull requests and deploys changes on `main` to GitHub Pages. In repository Settings → Pages, the source must be **GitHub Actions**. A manual workflow dispatch on `main` can also deploy. No custom domain is configured.

Keep guides grounded in current behavior. Run `bun run docs:build` to check internal links and inspect the production preview at desktop and mobile widths before publishing navigation or theme changes.

## Vokality theme

The documentation theme follows `vokality-website/app/globals.css`, `app/fonts.ts`, and `app/page.module.css`: warm charcoal, orange accents, square controls, IBM Plex Sans body text, and Manrope headings. The site uses a fixed dark appearance to match that site.

The Latin variable font assets and Vokality wordmark are hosted under `docs/site/public`; font licenses are included beside the WOFF2 files. No runtime requests to Google Fonts are needed. The theme lives in `docs/site/theme.css`. Navigation and home-page content live in `docs/site/config.ts`. The build validates internal pages, assets, and heading links.
