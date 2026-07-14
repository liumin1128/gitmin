import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const commands = manifest.contributes.commands as Array<{
  command: string;
  icon?: string;
}>;
const editorTitle = manifest.contributes.menus["editor/title"] as Array<{
  command: string;
  group: string;
}>;

assert.equal(
  commands.find((item) => item.command === "gitmin.previousFileDiff")?.icon,
  "$(arrow-left)",
);
assert.equal(
  commands.find((item) => item.command === "gitmin.nextFileDiff")?.icon,
  "$(arrow-right)",
);
assert.deepEqual(
  editorTitle.map((item) => item.command),
  ["gitmin.previousFileDiff", "gitmin.nextFileDiff"],
);
assert.deepEqual(
  editorTitle.map((item) => item.group),
  ["navigation@12", "navigation@13"],
);

const selectionHook = readFileSync(
  new URL('../webview-ui/src/hooks/useSelectionDetails.ts', import.meta.url),
  'utf8',
);
const messageHandler = readFileSync(
  new URL('../src/ipc/MessageHandler.ts', import.meta.url),
  'utf8',
);
assert.match(selectionHook, /type:\s*'selectionDetails\/clear'/);
assert.match(messageHandler, /case "selectionDetails\/clear"/);
assert.match(messageHandler, /fileDiffNavigator\.clear\(\)/);

console.log("editor navigation manifest checks passed");
