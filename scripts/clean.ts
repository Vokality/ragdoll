import { $ } from "bun";

const targets = Bun.argv.slice(2);
if (targets.length === 0)
  throw new Error("At least one clean target is required");
for (const target of targets) {
  const segments = target.split(/[\\/]/);
  if (
    !target ||
    target === "." ||
    target.startsWith("-") ||
    target.startsWith("/") ||
    target.startsWith("~") ||
    segments.includes("..")
  ) {
    throw new Error(`Unsafe clean target: ${target}`);
  }
}

await $`rm -rf ${targets}`.quiet();
