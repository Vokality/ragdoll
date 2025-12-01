/**
 * MCP Tools definitions for OpenAI function calling
 * These map to the ragdoll CharacterController methods
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Valid values for validation
export const VALID_MOODS = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
  "confusion",
  "thinking",
] as const;

export const VALID_ACTIONS = ["wink", "talk", "shake"] as const;

export const VALID_TONES = ["default", "whisper", "shout"] as const;

export const VALID_TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;

export const VALID_POMODORO_DURATIONS = [5, 15, 30, 60, 120] as const;

// Tool definitions for OpenAI
export const mcpTools: ChatCompletionTool[] = [
  // Expression Tools
  {
    type: "function",
    function: {
      name: "setMood",
      description: "Set the character's facial mood/expression",
      parameters: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            enum: [...VALID_MOODS],
            description: "The mood to set",
          },
          duration: {
            type: "number",
            description: "Transition duration in seconds (0-5)",
            minimum: 0,
            maximum: 5,
          },
        },
        required: ["mood"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "triggerAction",
      description: "Trigger a facial action like wink, talk animation, or shake head",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [...VALID_ACTIONS],
            description: "The action to trigger",
          },
          duration: {
            type: "number",
            description: "Action duration in seconds (0.2-5)",
            minimum: 0.2,
            maximum: 5,
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setHeadPose",
      description: "Rotate the character's head",
      parameters: {
        type: "object",
        properties: {
          yawDegrees: {
            type: "number",
            description: "Horizontal rotation in degrees (-35 to 35)",
            minimum: -35,
            maximum: 35,
          },
          pitchDegrees: {
            type: "number",
            description: "Vertical rotation in degrees (-20 to 20)",
            minimum: -20,
            maximum: 20,
          },
          duration: {
            type: "number",
            description: "Transition duration in seconds",
            minimum: 0.1,
            maximum: 2,
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setSpeechBubble",
      description: "Override the speech bubble with specific text and tone (use sparingly, normally the response text is shown)",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to show (null to clear)",
            maxLength: 240,
          },
          tone: {
            type: "string",
            enum: [...VALID_TONES],
            description: "The tone of the bubble",
          },
        },
      },
    },
  },

  // Pomodoro Tools
  {
    type: "function",
    function: {
      name: "startPomodoro",
      description: "Start a pomodoro timer session for focused work",
      parameters: {
        type: "object",
        properties: {
          sessionDuration: {
            type: "number",
            enum: [...VALID_POMODORO_DURATIONS],
            description: "Session duration in minutes",
          },
          breakDuration: {
            type: "number",
            enum: [5, 10, 15, 30],
            description: "Break duration in minutes",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pausePomodoro",
      description: "Pause the active pomodoro timer",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resetPomodoro",
      description: "Reset/stop the pomodoro timer",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPomodoroState",
      description: "Get the current pomodoro timer state",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // Task Tools
  {
    type: "function",
    function: {
      name: "addTask",
      description: "Add a new task to the task list",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The task description",
          },
          status: {
            type: "string",
            enum: [...VALID_TASK_STATUSES],
            description: "Initial status (default: todo)",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTaskStatus",
      description: "Update a task's status",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The task ID to update",
          },
          status: {
            type: "string",
            enum: [...VALID_TASK_STATUSES],
            description: "New status",
          },
          blockedReason: {
            type: "string",
            description: "Reason for blocking (only when status is blocked)",
          },
        },
        required: ["taskId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setActiveTask",
      description: "Set a task as the currently active (in_progress) task",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The task ID to make active",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "removeTask",
      description: "Remove a task from the list",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The task ID to remove",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "completeActiveTask",
      description: "Mark the currently active task as done",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearCompletedTasks",
      description: "Remove all completed tasks from the list",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearAllTasks",
      description: "Remove all tasks from the list",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listTasks",
      description: "Get all tasks with their IDs, status, and text",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// Whitelist of allowed function names
export const ALLOWED_FUNCTIONS = new Set(mcpTools.map((t) => t.function.name));

// Validate function call arguments
export function validateFunctionCall(
  name: string,
  args: Record<string, unknown>
): { valid: boolean; error?: string } {
  if (!ALLOWED_FUNCTIONS.has(name)) {
    return { valid: false, error: `Unknown function: ${name}` };
  }

  // Specific validations
  switch (name) {
    case "setMood":
      if (!args.mood || !VALID_MOODS.includes(args.mood as typeof VALID_MOODS[number])) {
        return { valid: false, error: "Invalid mood" };
      }
      break;
    case "triggerAction":
      if (!args.action || !VALID_ACTIONS.includes(args.action as typeof VALID_ACTIONS[number])) {
        return { valid: false, error: "Invalid action" };
      }
      break;
    case "addTask":
      if (!args.text || typeof args.text !== "string") {
        return { valid: false, error: "Task text is required" };
      }
      break;
    case "updateTaskStatus":
      if (!args.taskId || !args.status) {
        return { valid: false, error: "taskId and status are required" };
      }
      if (!VALID_TASK_STATUSES.includes(args.status as typeof VALID_TASK_STATUSES[number])) {
        return { valid: false, error: "Invalid task status" };
      }
      break;
  }

  return { valid: true };
}

