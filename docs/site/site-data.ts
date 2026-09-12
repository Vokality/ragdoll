import { site } from "./config";

export interface Heading {
  id: string;
  title: string;
  level: number;
}
export interface Page {
  source: string;
  path: string;
  title: string;
  description: string;
  html: string;
  text: string;
  headings: Heading[];
  updated: string;
}

export function pagePath(source: string): string {
  if (!source.endsWith(".md"))
    throw new Error(`Expected Markdown page: ${source}`);
  return source.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, ".html");
}

export function localLink(value: string, path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  const url = new URL(
    value.startsWith("/") ? `${site.base}${value.slice(1)}` : value,
    `${site.origin}${site.base}${path}`,
  );
  if (!url.pathname.startsWith(site.base))
    throw new Error(`Link escapes documentation: ${value}`);
  url.pathname = url.pathname
    .replace(/\/index\.md$/, "/")
    .replace(/\.md$/, ".html");
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function renderMarkdown(
  source: string,
  markdown: string,
): Promise<Omit<Page, "updated">> {
  const path = pagePath(source);
  const headings: Heading[] = [];
  let text = "";
  let title = "";
  let description = "";
  let paragraph = "";
  const rewriter = new HTMLRewriter()
    .on("a[href]", {
      element(element) {
        element.setAttribute(
          "href",
          localLink(element.getAttribute("href") ?? "", path),
        );
      },
    })
    .on("img[src]", {
      element(element) {
        element.setAttribute(
          "src",
          localLink(element.getAttribute("src") ?? "", path),
        );
        element.setAttribute("loading", "lazy");
      },
    })
    .on("h1", {
      text(chunk) {
        title += chunk.text;
      },
    })
    .on("h2, h3", {
      element(element) {
        headings.push({
          id: element.getAttribute("id") ?? "",
          title: "",
          level: Number(element.tagName.slice(1)),
        });
      },
      text(chunk) {
        const heading = headings.at(-1);
        if (heading) heading.title += chunk.text;
      },
    })
    .on("p", {
      element(element) {
        paragraph = "";
        element.onEndTag(() => {
          if (!description) description = paragraph;
        });
      },
      text(chunk) {
        paragraph += chunk.text;
      },
    })
    .on("*", {
      text(chunk) {
        text += chunk.text;
      },
    });
  const html = await rewriter
    .transform(
      new Response(Bun.markdown.html(markdown, { headings: { ids: true } })),
    )
    .text();
  return {
    source,
    path,
    title: title || site.title,
    description: description || site.description,
    html,
    text,
    headings,
  };
}

export async function validateLinks(
  outputs: Map<string, string | Bun.BunFile>,
): Promise<void> {
  const documents = new Map<string, { ids: Set<string>; links: string[] }>();
  for (const [path, content] of outputs) {
    if (!path.endsWith(".html") || typeof content !== "string") continue;
    const ids = new Set<string>();
    const links: string[] = [];
    await new HTMLRewriter()
      .on("[id]", {
        element(element) {
          const id = element.getAttribute("id");
          if (id) ids.add(id);
        },
      })
      .on("[href], [src]", {
        element(element) {
          const link =
            element.getAttribute("href") ?? element.getAttribute("src");
          if (link) links.push(link);
        },
      })
      .transform(new Response(content))
      .text();
    documents.set(path, { ids, links });
  }
  const errors: string[] = [];
  for (const [path, document] of documents) {
    for (const link of document.links) {
      const url = new URL(link, `${site.origin}${site.base}${path}`);
      if (url.origin !== site.origin || !url.pathname.startsWith(site.base))
        continue;
      let target = decodeURIComponent(url.pathname.slice(site.base.length));
      if (!target || target.endsWith("/")) target += "index.html";
      if (!outputs.has(target)) errors.push(`${path}: missing ${link}`);
      else if (
        url.hash &&
        documents.has(target) &&
        !documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1)))
      ) {
        errors.push(`${path}: missing heading ${link}`);
      }
    }
  }
  if (errors.length)
    throw new Error(`Broken documentation links:\n${errors.join("\n")}`);
}
