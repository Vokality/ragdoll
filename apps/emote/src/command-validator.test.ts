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
