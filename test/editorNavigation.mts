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
  when: string;
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
const editorNavigation = editorTitle.filter((item) =>
  ["gitmin.previousFileDiff", "gitmin.nextFileDiff"].includes(item.command),
);
assert.deepEqual(editorNavigation.map((item) => item.command), [
  "gitmin.previousFileDiff",
  "gitmin.nextFileDiff",
]);
assert.deepEqual(editorNavigation.map((item) => item.group), [
  "navigation@12",
  "navigation@13",
]);

assert.equal(gitminView.name, "GitMin", "the merged sidebar title should only show GitMin");
for (const [index, id] of WORKBENCH_VIEW_IDS.entries()) {
  const metadata = WORKBENCH_VIEW_METADATA[id];
  const items = viewTitle.filter(
    (item) => item.command === metadata.toggleCommand,
  );

  assert.equal(items.length, 1, `${metadata.labelKey} should have one native toggle item`);
  const [item] = items;
  assert.equal(
    commands.filter((command) => command.command === metadata.toggleCommand).length,
    1,
  );
  assert.equal(item?.group, `1_views@${index + 1}`);
  assert.equal(item?.when, "view == gitmin.panel");
  assert.equal(item?.toggled, metadata.visibilityContext);
}
assert.ok(
  commands.every((item) => !item.command.endsWith(".checked")),
  "native toggled menu items should not require duplicate checked commands",
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
