import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Lumen",
  description: "Get started with Lumen, use its tools, connect MCP services, and build extensions.",
  lang: "en-US",
  base: "/ragdoll/",
  cleanUrls: false,
  lastUpdated: true,
  head: [["meta", { name: "theme-color", content: "#101827" }]],
  themeConfig: {
    siteTitle: "Lumen Docs",
    nav: [
      { text: "Get started", link: "/getting-started" },
      { text: "Use Lumen", link: "/using-lumen" },
      { text: "MCP", link: "/mcp/" },
      { text: "Build extensions", link: "/extensions/" },
    ],
    sidebar: [
      { text: "Start here", items: [
        { text: "Introduction", link: "/" },
        { text: "Getting started", link: "/getting-started" },
        { text: "How to use Lumen", link: "/using-lumen" },
        { text: "Troubleshooting", link: "/troubleshooting" },
      ] },
      { text: "MCP connections", items: [
        { text: "Connect a service", link: "/mcp/" },
        { text: "Authentication and access", link: "/mcp/authentication" },
      ] },
      { text: "Extension development", items: [
        { text: "Overview", link: "/extensions/" },
        { text: "Your first extension", link: "/extensions/first-extension" },
        { text: "Cards and host capabilities", link: "/extensions/cards-and-host" },
        { text: "Testing and distribution", link: "/extensions/distribution" },
      ] },
    ],
    search: { provider: "local" },
    editLink: { pattern: "https://github.com/Vokality/ragdoll/edit/main/docs/site/:path", text: "Edit this page on GitHub" },
    socialLinks: [{ icon: "github", link: "https://github.com/Vokality/ragdoll" }],
    footer: { message: "Lumen is powered by Ragdoll. Released under the MIT license." },
    outline: [2, 3],
  },
});
