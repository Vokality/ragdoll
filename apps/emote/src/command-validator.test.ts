import { describe, expect, it } from "bun:test";
import { validateCommand } from "./command-validator";

describe("validateCommand", () => {
  it("rejects invalid command values from every transport", () => {
    expect(validateCommand({ type: "setMood", mood: "invalid" })).toEqual({
      ok: false,
      reason: 'Unknown mood "invalid"',
    });
  });

  it("normalizes head pose limits before dispatch", () => {
    expect(
      validateCommand({
        type: "setHeadPose",
        yawDegrees: 100,
        pitchDegrees: -100,
        duration: 10,
      }),
    ).toEqual({
      ok: true,
      command: {
        type: "setHeadPose",
        yawDegrees: 35,
        pitchDegrees: -20,
        duration: 2,
      },
    });
  });

  it("produces a complete speech-bubble message", () => {
    expect(
      validateCommand({ type: "setSpeechBubble", text: " hello " }),
    ).toEqual({
      ok: true,
      command: {
        type: "setSpeechBubble",
        text: "hello",
        tone: "default",
      },
    });
  });
});

it("rejects non-object transport payloads without throwing", () => {
  for (const value of [null, undefined, [], 42, "setMood", true]) {
    expect(validateCommand(value)).toEqual({
      ok: false,
      reason: "Command must be an object",
    });
  }
});

it("rejects invalid supplied numbers instead of treating them as omitted", () => {
  for (const value of [NaN, Infinity, -Infinity, null, "1"]) {
    expect(
      validateCommand({ type: "setMood", mood: "smile", duration: value }).ok,
    ).toBe(false);
    expect(validateCommand({ type: "setHeadPose", yawDegrees: value }).ok).toBe(
      false,
    );
  }
});

it("keeps complete Unicode characters at the speech-bubble limit", () => {
  const result = validateCommand({
    type: "setSpeechBubble",
    text: "a".repeat(239) + "🌍extra",
  });
  expect(result).toEqual({
    ok: true,
    command: {
      type: "setSpeechBubble",
      text: "a".repeat(239) + "🌍",
      tone: "default",
    },
  });
  expect(validateCommand({ type: "setSpeechBubble", text: {} }).ok).toBe(false);
});
