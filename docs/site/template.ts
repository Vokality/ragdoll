import { home, navigation, site } from "./config";
import type { Page } from "./site-data";

const escape = Bun.escapeHTML;
const href = (path: string) => `${site.base}${path}`;

export function renderPage(page: Page, pages: Page[]): string {
  const isHome = page.path === "";
  const allLinks = navigation.flatMap((group) => group.items);
  const index = allLinks.findIndex((link) => link.path === page.path);
  const previous = allLinks[index - 1];
  const next = allLinks[index + 1];
  const sidebar = navigation
    .map(
      (group) =>
        `<section><h2>${escape(group.title)}</h2>${group.items.map((link) => `<a href="${href(link.path)}"${page.path === link.path ? ' aria-current="page"' : ""}>${escape(link.title)}</a>`).join("")}</section>`,
    )
    .join("");
  const hero = `<section class="hero"><div class="container"><p class="eyebrow">${home.name}</p><h1>${home.title}</h1><p class="tagline">${home.tagline}</p><div class="actions">${home.actions.map((action) => `<a class="button${action.primary ? " primary" : ""}" href="${href(action.path)}">${action.title}</a>`).join("")}</div></div></section>
    <section class="features container" aria-label="Documentation guides">${home.features.map((feature, position) => `<a class="feature" href="${href(feature.path)}"><span class="number">0${position + 1}</span><h2>${feature.title}</h2><p>${feature.details}</p><span class="feature-link">${feature.label} →</span></a>`).join("")}</section>`;
  return `<!doctype html>
<html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(isHome ? site.title : `${page.title} | ${site.title}`)}</title>
<meta name="description" content="${escape(page.description)}"><meta name="theme-color" content="#0d0d0c">
<link rel="canonical" href="${site.origin}${href(page.path)}"><link rel="stylesheet" href="${href("theme.css")}">
<script type="module" src="${href("client.js")}"></script></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<header class="header"><a class="brand" href="${href("")}" aria-label="Lumen documentation home"><img src="${href("vokality-wordmark.png")}" alt="Vokality" width="104"><span>Lumen</span><small>DOCS</small></a>
<button class="search-button" data-open-search>Search <kbd>⌘ K</kbd></button>
<nav aria-label="Main navigation"><a href="${href("getting-started.html")}">Get started</a><a href="${href("using-lumen.html")}">Use Lumen</a><a href="${href("mcp/")}">MCP</a><a href="${href("extensions/")}">Build extensions</a><a href="${site.repository}">GitHub ↗</a></nav></header>
${isHome ? hero : ""}
<div class="${isHome ? "home-content container" : "docs-layout"}">
${isHome ? "" : `<details class="sidebar" open><summary>Documentation menu</summary><nav aria-label="Documentation">${sidebar}</nav></details>`}
<main id="main" tabindex="-1" class="article">${page.html}
${isHome ? "" : `<footer class="article-footer"><div><a href="${site.repository}/edit/main/docs/site/${page.source}">Edit this page on GitHub</a>${page.updated ? `<p>Last updated: <time datetime="${page.updated}">${new Date(page.updated).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })}</time></p>` : ""}</div><nav class="pager" aria-label="Adjacent pages">${previous ? `<a href="${href(previous.path)}"><small>Previous page</small>${previous.title}</a>` : "<span></span>"}${next ? `<a href="${href(next.path)}"><small>Next page</small>${next.title}</a>` : ""}</nav></footer>`}
</main>${isHome ? "" : `<aside class="outline"><nav aria-label="On this page"><h2>On this page</h2>${page.headings.map((heading) => `<a class="level-${heading.level}" href="#${escape(heading.id)}">${escape(heading.title)}</a>`).join("")}</nav></aside>`}</div>
<footer class="site-footer">${site.footer}</footer>
<dialog id="search-dialog" aria-labelledby="search-title"><div class="search-header"><h2 id="search-title">Search documentation</h2><button data-close-search aria-label="Close search">✕</button></div><label for="search-query">Search pages</label><input id="search-query" type="search" placeholder="Search tools, extensions, setup…" autocomplete="off"><p id="search-status" role="status"></p><ul class="search-results">${pages.map((result) => `<li data-search="${escape(`${result.title} ${result.text}`.toLowerCase())}"><a href="${href(result.path)}"><strong>${escape(result.title)}</strong><span>${escape(result.description)}</span></a></li>`).join("")}</ul></dialog>
</body></html>`;
}
