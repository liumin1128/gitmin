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
}>;
const commandPalette = manifest.contributes.menus.commandPalette as Array<{
  command: string;
  when: string;
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
  const uncheckedItem = viewTitle.find((item) => item.command === metadata.toggleCommand);
  const checkedItem = viewTitle.find(
    (item) => item.command === metadata.checkedToggleCommand,
  );

  assert.equal(
    commands.find((item) => item.command === metadata.checkedToggleCommand)?.icon,
    "$(check)",
    `${metadata.labelKey} should use the native check icon when visible`,
  );
  assert.equal(uncheckedItem?.group, `1_views@${index + 1}`);
  assert.equal(checkedItem?.group, uncheckedItem?.group);
  assert.equal(
    uncheckedItem?.when,
    `view == gitmin.panel && !${metadata.visibilityContext}`,
  );
  assert.equal(
    checkedItem?.when,
    `view == gitmin.panel && ${metadata.visibilityContext}`,
  );
  assert.ok(
    commandPalette.some(
      (item) => item.command === metadata.checkedToggleCommand && item.when === "false",
    ),
    "internal checked variants should stay out of the Command Palette",
  );
}

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
