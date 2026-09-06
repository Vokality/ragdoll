import { expect, test } from "bun:test";
import { isAuthorizedRenderer } from "./renderer-authority.js";

test("IPC requires the owned main frame and exact app document", () => {
  const sender = {};
  const frame = { url: "http://localhost:5173/#settings" };
  const event = { sender, senderFrame: frame };
  const authority = {
    sender,
    mainFrame: frame,
    documentUrl: "http://localhost:5173",
  };
  expect(isAuthorizedRenderer(event, authority)).toBe(true);
  expect(isAuthorizedRenderer(event, null)).toBe(false);
  expect(isAuthorizedRenderer({ ...event, sender: {} }, authority)).toBe(false);
  expect(
    isAuthorizedRenderer({ ...event, senderFrame: { ...frame } }, authority),
  ).toBe(false);
  expect(isAuthorizedRenderer({ ...event, senderFrame: null }, authority)).toBe(
    false,
  );
  for (const url of [
    "http://localhost:5173/other",
    "http://localhost:51730/",
    "https://example.com/",
    "not a url",
  ]) {
    frame.url = url;
    expect(isAuthorizedRenderer(event, authority)).toBe(false);
  }
  authority.documentUrl = "file:///Applications/Lumen.app/renderer/index.html";
  frame.url = authority.documentUrl;
  expect(isAuthorizedRenderer(event, authority)).toBe(true);
  frame.url = "file:///tmp/index.html";
  expect(isAuthorizedRenderer(event, authority)).toBe(false);
});
