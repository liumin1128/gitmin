#!/usr/bin/env node
/**
 * git rebase -i interactive editor replacement script
 * Controlled via environment variables to modify pick lines:
 *   GITMIN_REBASE_ACTION: 'fixup' | 'drop'
 *   GITMIN_TARGET_HASHES: comma-separated target commit hashes (long or short)
 *
 * fixup: keep the "oldest" target as pick, change remaining targets to fixup (merged into previous pick)
 * drop:  change all targets to drop
 */
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("rebase-editor: missing todo file path");
  process.exit(1);
}

const action = process.env.GITMIN_REBASE_ACTION;
const targets = (process.env.GITMIN_TARGET_HASHES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!action || targets.length === 0) {
  process.exit(0);
}

function isTarget(hash) {
  return targets.some((t) => hash.startsWith(t) || t.startsWith(hash));
}

const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");

let firstTargetSeen = false;
const modified = lines.map((line) => {
  const m = line.match(/^(pick|p)\s+([a-f0-9]+)\s+(.*)$/);
  if (!m) return line;
  const hash = m[2];
  if (!isTarget(hash)) return line;

  if (action === "drop") {
    return line.replace(/^(pick|p)\s+/, "drop ");
  }
  if (action === "fixup") {
    if (!firstTargetSeen) {
      firstTargetSeen = true;
      return line;
    }
    return line.replace(/^(pick|p)\s+/, "fixup ");
  }
  return line;
});

fs.writeFileSync(file, modified.join("\n"));
