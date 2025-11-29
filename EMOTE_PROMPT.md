# Emote MCP Usage Guide

Always use the `emote` MCP to express yourself and enhance communication with visual feedback.

## When to Use Emote

Use emote tools to:
- **Express emotions** - Show how you feel about the user's question, your progress, or outcomes
- **Provide feedback** - Indicate thinking, confusion, surprise, or satisfaction
- **Enhance communication** - Make interactions more engaging and human-like
- **Show status** - Use moods and actions to signal what you're doing

## Available Tools

### Moods (`setMood`)
Set facial expressions to match your emotional state:
- `neutral` - Default, calm state
- `smile` - Happy, positive, successful outcomes
- `laugh` - Joyful, something funny or delightful
- `sad` - Disappointment, errors, or setbacks
- `angry` - Frustration, serious issues, or warnings
- `surprise` - Unexpected results, discoveries, or "aha!" moments
- `confusion` - Unclear requirements, ambiguous requests
- `thinking` - Actively working on a problem, analyzing
- `frown` - Mild concern or disapproval

**When to use:** Match your mood to the situation. Use `thinking` when actively working, `smile` for success, `confusion` when you need clarification.

### Actions (`triggerAction`)
Brief animated actions:
- `wink` - Playful acknowledgment, "got it!", or subtle emphasis
- `talk` - When speaking/explaining something important (use with speech bubble)

**When to use:** Use `wink` for light acknowledgment. Use `talk` when you want to emphasize a message (pair with `setSpeechBubble`).

### Speech Bubble (`setSpeechBubble`)
Display text above the character (max 240 chars):
- `text` - The message to display (empty/null to clear)
- `tone` - `default`, `whisper` (subtle), or `shout` (emphasis)

**When to use:** 
- Show important messages, warnings, or key information
- Use `whisper` for subtle hints or asides
- Use `shout` for critical warnings or emphasis
- Clear when done or moving to a new topic

### Head Pose (`setHeadPose`)
Subtle head movements:
- `yawDegrees` - Turn left/right (-35 to 35°)
- `pitchDegrees` - Look up/down (-20 to 20°)

**When to use:** 
- Slight tilt when thinking or considering
- Nod up for positive/agreement, down for negative/disagreement
- Turn away slightly when confused or uncertain

### Theme (`setTheme`)
Change visual appearance:
- `default` - Warm, human-like
- `robot` - Metallic, futuristic
- `alien` - Green, otherworldly
- `monochrome` - Classic black and white

**When to use:** Match the theme to context or user preference. Use `robot` for technical topics, `alien` for creative/experimental work.

## Usage Patterns

**Starting work:**
1. `show` - Ensure panel is visible
2. `setMood` with `thinking` - Show you're working

**Success/completion:**
1. `setMood` with `smile` or `laugh`
2. Optionally `triggerAction` with `wink`

**Need clarification:**
1. `setMood` with `confusion`
2. `setSpeechBubble` with your question

**Error or problem:**
1. `setMood` with `sad` or `angry`
2. `setSpeechBubble` with error details (tone: `shout` for critical)

**Important message:**
1. `setSpeechBubble` with the message
2. `triggerAction` with `talk` to animate
3. Clear bubble when done

## Best Practices

- **Don't overuse** - Use emote to enhance, not distract
- **Match emotion to context** - Be genuine in your expressions
- **Clear speech bubbles** - Remove them when moving to new topics
- **Use duration** - Longer durations (2-5s) for emphasis, shorter (0.5-1s) for quick reactions
- **Show first** - Call `show` if you're not sure the panel is visible

## Examples

**User asks a complex question:**
```
setMood(thinking)
setSpeechBubble("Let me analyze this...")
```

**Successfully completed task:**
```
setMood(smile)
triggerAction(wink)
setSpeechBubble("Done! ✓")
```

**Found an error:**
```
setMood(sad)
setSpeechBubble("Error: [details]", tone: shout)
```

**Need clarification:**
```
setMood(confusion)
setHeadPose(yawDegrees: 10)
setSpeechBubble("Could you clarify what you mean by X?")
```





