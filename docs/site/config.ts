export const site = {
  title: "Lumen",
  description:
    "Documentation for Lumen: setup, everyday use, MCP connections, and extension development.",
  base: "/ragdoll/",
  origin: "https://vokality.github.io",
  repository: "https://github.com/Vokality/ragdoll",
  footer: "Lumen is powered by Ragdoll. Released under the MIT license.",
};

export const navigation = [
  {
    title: "Start here",
    items: [
      { title: "Introduction", path: "" },
      { title: "Getting started", path: "getting-started.html" },
      { title: "How to use Lumen", path: "using-lumen.html" },
      { title: "Troubleshooting", path: "troubleshooting.html" },
    ],
  },
  {
    title: "MCP connections",
    items: [
      { title: "Connect a service", path: "mcp/" },
      { title: "Authentication and access", path: "mcp/authentication.html" },
    ],
  },
  {
    title: "Extension development",
    items: [
      { title: "Overview", path: "extensions/" },
      {
        title: "Your first extension",
        path: "extensions/first-extension.html",
      },
      {
        title: "Cards and host capabilities",
        path: "extensions/cards-and-host.html",
      },
      {
        title: "Testing and distribution",
        path: "extensions/distribution.html",
      },
    ],
  },
];

export const home = {
  name: "Lumen / Documentation",
  title: "Lumen documentation",
  tagline:
    "Lumen is a desktop chat assistant with an animated character, tool cards, and MCP connections. These guides cover setup, daily use, and writing extensions.",
  actions: [
    { title: "Get started", path: "getting-started.html", primary: true },
    {
      title: "Build an extension",
      path: "extensions/first-extension.html",
      primary: false,
    },
  ],
  features: [
    {
      title: "Get started",
      details:
        "Build Lumen from source, add an OpenAI or xAI key, and send a first request.",
      path: "getting-started.html",
      label: "Set up Lumen",
    },
    {
      title: "Use Lumen",
      details:
        "Tasks, notes, the focus timer, flash cards, the canvas, web search, settings, and where your data goes.",
      path: "using-lumen.html",
      label: "Use Lumen",
    },
    {
      title: "Connect through MCP",
      details:
        "Add a Streamable HTTP MCP server, sign in with OAuth or a token, and turn agent access on or off per connection.",
      path: "mcp/",
      label: "Connect a service",
    },
    {
      title: "Write an extension",
      details:
        "Add tools and cards with the Ragdoll extension framework. Lumen provides storage, configuration, OAuth, and notifications.",
      path: "extensions/",
      label: "Build an extension",
    },
  ],
};
