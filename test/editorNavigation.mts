import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKBENCH_VIEW_IDS,
  WORKBENCH_VIEW_METADATA,
} from "../shared/workbenchViews.ts";

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
const viewTitle = manifest.contributes.menus["view/title"] as Array<{
  command: string;
  group: string;
  toggled?: string;
}>;
const gitminView = manifest.contributes.views.gitmin[0] as {
  id: string;
  name: string;
};

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

assert.equal(gitminView.name, "GitMin", "the merged sidebar title should only show GitMin");
assert.deepEqual(
  viewTitle.slice(1).map((item) => item.command),
  WORKBENCH_VIEW_IDS.map((id) => WORKBENCH_VIEW_METADATA[id].toggleCommand),
);
assert.ok(
  viewTitle.slice(1).every((item) => !item.group.startsWith("navigation")),
  "view visibility actions should render in the native title overflow menu",
);
assert.ok(
  viewTitle
    .slice(1)
    .every((item, index) =>
      item.toggled === WORKBENCH_VIEW_METADATA[WORKBENCH_VIEW_IDS[index]!].visibilityContext
    ),
  "native visibility actions should expose their checked state",
);

const selectionHook = readFileSync(
  new URL('../webview-ui/src/hooks/useSelectionDetails.ts', import.meta.url),
  'utf8',
);
const messageHandler = readFileSync(
  new URL('../src/ipc/MessageHandler.ts', import.meta.url),
  'utf8',
);
const appSource = readFileSync(
  new URL('../webview-ui/src/App.tsx', import.meta.url),
  'utf8',
);
const webviewHtml = readFileSync(
  new URL('../src/utils/webviewHtml.ts', import.meta.url),
  'utf8',
);
assert.match(selectionHook, /type:\s*'selectionDetails\/clear'/);
assert.match(messageHandler, /case "selectionDetails\/clear"/);
assert.match(messageHandler, /fileDiffNavigator\.clear\(\)/);
assert.match(appSource, /showWorkbenchToolbar\s*=\s*document\.body\.dataset\.gitminHost\s*===\s*'panel'/);
assert.match(webviewHtml, /data-gitmin-host="\$\{host\}"/);

console.log("editor navigation manifest checks passed");
