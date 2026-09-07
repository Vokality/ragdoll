---
layout: home
hero:
  name: Lumen / Documentation
  text: An assistant you can work with.
  tagline: Chat with an expressive character, use interactive tools, and connect your services. Start here to make Lumen your own.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Build an extension
      link: /extensions/first-extension
features:
  - title: Get started
    details: Build and launch Lumen, add your API key, and give your assistant its first task.
    link: /getting-started
    linkText: Set up Lumen
  - title: Use Lumen
    details: Manage tasks, focus with a timer, study flash cards, draw on a canvas, and research the web while keeping the conversation visible.
    link: /using-lumen
    linkText: Explore the app
  - title: Connect through MCP
    details: Add remote or local MCP servers, sign in with your provider, and choose which tools the agent can use on your behalf.
    link: /mcp/
    linkText: Connect a service
  - title: Extend its capabilities
    details: Create tools and interactive cards using the Ragdoll extension framework. Lumen supplies storage, configuration, OAuth, and other host services.
    link: /extensions/
    linkText: Build an extension
---

## A conversation that gets things done

<div class="product-gallery">

<figure>

![Lumen suggests a morning plan in chat](/screenshots/lumen-chat.png)

<figcaption><strong>Talk it through.</strong> Plan your day in a conversation with Lumen.</figcaption>
</figure>

<figure>

![Lumen opens an interactive task card above the conversation](/screenshots/lumen-tasks.png)

<figcaption><strong>Put it into action.</strong> Work with your tasks while keeping the conversation visible.</figcaption>
</figure>

</div>

## What is Lumen?

Lumen is an Electron desktop assistant powered by OpenAI and the Ragdoll character framework. Its agent can perform tool actions, control which extension card is open, and continue through several steps before replying. The animated character stays visible alongside your work.

These pages document the current source version of Lumen in the [Ragdoll repository](https://github.com/Vokality/ragdoll). Lumen runs on your desktop; this website contains documentation, not a browser version of the app.

New to the project? Follow [Getting started](./getting-started.md), then try the examples in [How to use Lumen](./using-lumen.md).
