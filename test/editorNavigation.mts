import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const commands = manifest.contributes.commands as Array<{
  command: string;
  title: string;
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
assert.equal(
  commands.find((item) => item.command === "gitmin.manageViews")?.icon,
  "$(ellipsis)",
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
assert.ok(
  commands.every((item) => !item.command.startsWith("gitmin.toggle")),
  "view visibility is owned by the shared webview menu, not duplicate native commands",
);
assert.deepEqual(
  viewTitle.map((item) => item.command),
  ["gitmin.openPanel", "gitmin.openSettings", "gitmin.manageViews"],
  "the native title menu should expose the shared view menu at the far right",
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
const viewProvider = readFileSync(
  new URL('../src/panels/GitPanelViewProvider.ts', import.meta.url),
  'utf8',
);
assert.match(selectionHook, /type:\s*'selectionDetails\/clear'/);
assert.match(messageHandler, /case "selectionDetails\/clear"/);
assert.match(messageHandler, /fileDiffNavigator\.clear\(\)/);
assert.match(
  appSource,
  /<div className="app">\s*<WorkbenchToolbar/s,
  "the shared visibility menu should render in both webview hosts",
);
assert.doesNotMatch(appSource, /workbenchViews\/(?:toggle|visibility)/);
assert.match(webviewHtml, /data-gitmin-host="\$\{host\}"/);
assert.ok(
  viewProvider.indexOf('onDidReceiveMessage') < viewProvider.indexOf('view.webview.html ='),
  'the extension must listen before the webview posts its initial ready message',
);
assert.match(viewProvider, /type:\s*"workbenchViews\/menuToggle"/);
assert.doesNotMatch(viewProvider, /workbenchViews\/(?:toggle|visibility)/);

console.log("editor navigation manifest checks passed");
