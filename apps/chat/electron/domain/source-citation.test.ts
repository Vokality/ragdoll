import { expect, it } from "bun:test";
import { citedResponse, sourceCitationSchema } from "../electron-api.js";
it("separates legacy inline citations and deduplicates structured sources", () => {
  const source = { title: "NASA", url: "https://www.nasa.gov/" };
  expect(
    citedResponse("News.\nSource: [NASA](https://www.nasa.gov/)", [
      source,
      source,
    ]),
  ).toEqual({ content: "News.", sources: [source] });
  expect(citedResponse("News. Source: NASA update", [source])).toEqual({
    content: "News.",
    sources: [source],
  });
  expect(citedResponse("Hello")).toEqual({ content: "Hello" });
});
it("rejects source URLs that cannot be rendered as safe external links", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///tmp/example",
    "https://user:secret@example.com",
  ]) {
    expect(
      sourceCitationSchema.safeParse({ title: "Source", url }).success,
    ).toBe(false);
  }
});
