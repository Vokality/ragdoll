import { describe, expect, test } from "bun:test";
import {
  localLink,
  pagePath,
  renderMarkdown,
  validateLinks,
} from "./site-data";

describe("documentation routes", () => {
  test("preserves published nested paths and Markdown fragment links", () => {
    expect(pagePath("index.md")).toBe("");
    expect(pagePath("mcp/index.md")).toBe("mcp/");
    expect(pagePath("extensions/first-extension.md")).toBe(
      "extensions/first-extension.html",
    );
    expect(
      localLink(
        "../getting-started.md#requirements",
        "extensions/first-extension.html",
      ),
    ).toBe("/ragdoll/getting-started.html#requirements");
    expect(localLink("./index.md", "mcp/authentication.html")).toBe(
      "/ragdoll/mcp/",
    );
    expect(localLink("/screenshots/lumen-chat.png", "")).toBe(
      "/ragdoll/screenshots/lumen-chat.png",
    );
    expect(localLink("https://example.com/docs.md", "")).toBe(
      "https://example.com/docs.md",
    );
    expect(() => localLink("../../outside.md", "mcp/")).toThrow(
      "escapes documentation",
    );
  });
  test("renders code, tables, headings, and local asset links", async () => {
    const page = await renderMarkdown(
      "guide.md",
      "# Guide\n\nHello **world**.\n\n## Set up\n\n[Start](./index.md)\n\n![App](/screenshots/lumen-chat.png)\n\n| Name | Value |\n| --- | --- |\n| Tool | Yes |\n\n```ts\nconst value = '<unsafe>';\n```",
    );
    expect(page.title).toBe("Guide");
    expect(page.description).toBe("Hello world.");
    expect(page.headings).toEqual([
      { id: "set-up", title: "Set up", level: 2 },
    ]);
    expect(page.html).toContain('href="/ragdoll/"');
    expect(page.html).toContain('src="/ragdoll/screenshots/lumen-chat.png"');
    expect(page.html).toContain("<table>");
    expect(page.html).toContain("&lt;unsafe&gt;");
  });
  test("rejects missing pages, assets, and fragments before publishing", async () => {
    const outputs = new Map<string, string>([
      [
        "index.html",
        '<a href="/ragdoll/guide.html#setup">Guide</a><img src="/ragdoll/app.png">',
      ],
      ["guide.html", '<h2 id="setup">Setup</h2>'],
      ["app.png", ""],
    ]);
    await validateLinks(outputs);
    outputs.set("guide.html", '<h2 id="renamed">Setup</h2>');
    await expect(validateLinks(outputs)).rejects.toThrow("missing heading");
    outputs.delete("app.png");
    await expect(validateLinks(outputs)).rejects.toThrow(
      "missing /ragdoll/app.png",
    );
  });
});
