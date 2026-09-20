import { expect, test } from "bun:test";
import { ExternalNavigationService } from "./external-navigation-service.js";

test("navigation rejects unsafe or malformed URLs without launching them", async () => {
  const opened: string[] = [];
  const service = new ExternalNavigationService(async (url) => {
    opened.push(url);
  });
  for (const url of [
    "invalid",
    "file:///tmp/a",
    "javascript:alert(1)",
    "http://example.com",
  ]) {
    expect((await service.open(url)).success).toBe(false);
  }
  expect(opened).toEqual([]);
  expect(await service.open("https://example.com")).toEqual({ success: true });
  expect(opened).toEqual(["https://example.com/"]);
});

test("OS launch failures become operation failures rather than unhandled rejections", async () => {
  const service = new ExternalNavigationService(async () => {
    throw new Error("No browser");
  });
  expect(await service.open("https://example.com")).toEqual({
    success: false,
    error: "No browser",
  });
});

test("loopback HTTP opens only for callers that ask for it", async () => {
  const opened: string[] = [];
  const service = new ExternalNavigationService(async (url) => {
    opened.push(url);
  });
  const local = "http://127.0.0.1:8080/authorize";

  expect((await service.open(local)).success).toBe(false);
  expect(
    (await service.open("http://example.com", { allowLoopbackHttp: true }))
      .success,
  ).toBe(false);
  expect(await service.open(local, { allowLoopbackHttp: true })).toEqual({
    success: true,
  });
  expect(opened).toEqual([local]);
});
