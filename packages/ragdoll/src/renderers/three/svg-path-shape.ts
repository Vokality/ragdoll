import { Shape } from "three";

export interface PathCommand {
  type: string;
  values: number[];
}

const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/;
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

export function parseSvgPath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const trimmed = d.trim();
  if (!trimmed) return commands;

  let current = "";
  let rawValues = "";
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    if (COMMAND.test(ch) && (i === 0 || trimmed[i - 1] !== "e" && trimmed[i - 1] !== "E")) {
      if (current) {
        commands.push({ type: current, values: parseNumbers(rawValues) });
      }
      current = ch;
      rawValues = "";
    } else {
      rawValues += ch;
    }
  }
  if (current) {
    commands.push({ type: current, values: parseNumbers(rawValues) });
  }
  return commands;
}

function parseNumbers(source: string): number[] {
  const values: number[] = [];
  NUMBER.lastIndex = 0;
  let match = NUMBER.exec(source);
  while (match) {
    values.push(Number(match[0]));
    match = NUMBER.exec(source);
  }
  return values;
}

function flipY(y: number): number {
  return -y;
}

/**
 * Convert face-outline path data into a Three.js shape in y-up coordinates.
 */
export function svgPathToShape(
  d: string,
  options: { close?: boolean } = {},
): Shape | null {
  const commands = parseSvgPath(d);
  if (commands.length === 0) return null;

  const shape = new Shape();
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let prevType = "";
  let prevCx = 0;
  let prevCy = 0;
  let started = false;

  const move = (nx: number, ny: number) => {
    shape.moveTo(nx, flipY(ny));
    startX = nx;
    startY = ny;
    x = nx;
    y = ny;
    started = true;
  };

  for (const command of commands) {
    const type = command.type;
    const values = command.values;
    switch (type) {
      case "M":
      case "m": {
        const relative = type === "m";
        for (let i = 0; i + 1 < values.length; i += 2) {
          const nx = relative ? x + values[i]! : values[i]!;
          const ny = relative ? y + values[i + 1]! : values[i + 1]!;
          if (i === 0) move(nx, ny);
          else {
            shape.lineTo(nx, flipY(ny));
            x = nx;
            y = ny;
          }
        }
        break;
      }
      case "L":
      case "l": {
        const relative = type === "l";
        for (let i = 0; i + 1 < values.length; i += 2) {
          x = relative ? x + values[i]! : values[i]!;
          y = relative ? y + values[i + 1]! : values[i + 1]!;
          shape.lineTo(x, flipY(y));
        }
        break;
      }
      case "H":
      case "h": {
        const relative = type === "h";
        for (const value of values) {
          x = relative ? x + value : value;
          shape.lineTo(x, flipY(y));
        }
        break;
      }
      case "V":
      case "v": {
        const relative = type === "v";
        for (const value of values) {
          y = relative ? y + value : value;
          shape.lineTo(x, flipY(y));
        }
        break;
      }
      case "C":
      case "c": {
        const relative = type === "c";
        for (let i = 0; i + 5 < values.length; i += 6) {
          const x1 = relative ? x + values[i]! : values[i]!;
          const y1 = relative ? y + values[i + 1]! : values[i + 1]!;
          const x2 = relative ? x + values[i + 2]! : values[i + 2]!;
          const y2 = relative ? y + values[i + 3]! : values[i + 3]!;
          const nx = relative ? x + values[i + 4]! : values[i + 4]!;
          const ny = relative ? y + values[i + 5]! : values[i + 5]!;
          shape.bezierCurveTo(x1, flipY(y1), x2, flipY(y2), nx, flipY(ny));
          prevCx = x2;
          prevCy = y2;
          x = nx;
          y = ny;
        }
        break;
      }
      case "S":
      case "s": {
        const relative = type === "s";
        const reflect =
          prevType === "C" ||
          prevType === "c" ||
          prevType === "S" ||
          prevType === "s";
        for (let i = 0; i + 3 < values.length; i += 4) {
          const x1 = reflect ? 2 * x - prevCx : x;
          const y1 = reflect ? 2 * y - prevCy : y;
          const x2 = relative ? x + values[i]! : values[i]!;
          const y2 = relative ? y + values[i + 1]! : values[i + 1]!;
          const nx = relative ? x + values[i + 2]! : values[i + 2]!;
          const ny = relative ? y + values[i + 3]! : values[i + 3]!;
          shape.bezierCurveTo(x1, flipY(y1), x2, flipY(y2), nx, flipY(ny));
          prevCx = x2;
          prevCy = y2;
          x = nx;
          y = ny;
        }
        break;
      }
      case "Q":
      case "q": {
        const relative = type === "q";
        for (let i = 0; i + 3 < values.length; i += 4) {
          const x1 = relative ? x + values[i]! : values[i]!;
          const y1 = relative ? y + values[i + 1]! : values[i + 1]!;
          const nx = relative ? x + values[i + 2]! : values[i + 2]!;
          const ny = relative ? y + values[i + 3]! : values[i + 3]!;
          shape.quadraticCurveTo(x1, flipY(y1), nx, flipY(ny));
          prevCx = x1;
          prevCy = y1;
          x = nx;
          y = ny;
        }
        break;
      }
      case "T":
      case "t": {
        const relative = type === "t";
        const reflect =
          prevType === "Q" ||
          prevType === "q" ||
          prevType === "T" ||
          prevType === "t";
        for (let i = 0; i + 1 < values.length; i += 2) {
          const x1 = reflect ? 2 * x - prevCx : x;
          const y1 = reflect ? 2 * y - prevCy : y;
          const nx = relative ? x + values[i]! : values[i]!;
          const ny = relative ? y + values[i + 1]! : values[i + 1]!;
          shape.quadraticCurveTo(x1, flipY(y1), nx, flipY(ny));
          prevCx = x1;
          prevCy = y1;
          x = nx;
          y = ny;
        }
        break;
      }
      case "Z":
      case "z":
        shape.closePath();
        x = startX;
        y = startY;
        break;
      default:
        break;
    }
    prevType = type;
  }

  if (!started || (shape.curves.length === 0 && shape.currentPoint.x === 0)) {
    if (shape.curves.length === 0) return null;
  }

  if (options.close !== false && (x !== startX || y !== startY)) {
    shape.closePath();
  }

  return shape.curves.length > 0 ? shape : null;
}
