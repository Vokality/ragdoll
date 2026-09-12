export const site = {
  title: "Lumen",
  description:
    "Get started with Lumen, use its tools, connect MCP services, and build extensions.",
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
  title: "An assistant you can work with.",
  tagline:
    "Chat with an expressive character, use interactive tools, and connect your services. Start here to make Lumen your own.",
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
        "Build and launch Lumen, add your API key, and give your assistant its first task.",
      path: "getting-started.html",
      label: "Set up Lumen",
    },
    {
      title: "Use Lumen",
      details:
        "Manage tasks, save longer notes, focus with a timer, study flash cards, draw on a canvas, and research the web while keeping the conversation visible.",
      path: "using-lumen.html",
      label: "Explore the app",
    },
    {
      title: "Connect through MCP",
      details:
        "Add remote or local MCP servers, sign in with your provider, and choose which tools the agent can use on your behalf.",
      path: "mcp/",
      label: "Connect a service",
    },
    {
      title: "Extend its capabilities",
      details:
        "Create tools and interactive cards using the Ragdoll extension framework. Lumen supplies storage, configuration, OAuth, and other host services.",
      path: "extensions/",
      label: "Build an extension",
    },
  ],
};
