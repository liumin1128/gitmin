/**
 * Git history modification operations
 * - Checks working tree is clean before all operations (except reset --hard, which has a second confirmation in the UI)
 * - Interactive rebase (squash/drop) uses GIT_SEQUENCE_EDITOR to point to a script that auto-edits the todo list
 * - Conflicts or failures auto-run rebase --abort to avoid leaving the repo in a rebase state
 */
import * as path from "node:path";
import * as vscode from "vscode";
import { simpleGit, type SimpleGit } from "simple-git";
import type { Commit } from "../../shared/domain";
import { t } from "../../shared/i18n";

export type ResetMode = "soft" | "mixed" | "hard";

export class GitOpsService {
  private readonly rootPath: string;
  private readonly git: SimpleGit;
  private readonly editorScript: string;

  constructor(rootPath: string, extensionUri: vscode.Uri) {
    this.rootPath = rootPath;
    this.git = simpleGit(rootPath);
    this.editorScript = path.join(
      extensionUri.fsPath,
      "resources",
      "rebase-editor.js",
    );
  }

  async copyHash(hashes: string[]): Promise<void> {
    await vscode.env.clipboard.writeText(hashes.join("\n"));
  }

  async revert(hashes: string[], allCommits: Commit[]): Promise<void> {
    await this.assertClean();
    const sorted = this.sortByAge(hashes, allCommits, "newestFirst");
    for (const h of sorted) {
      try {
        await this.git.raw(["revert", "--no-edit", h]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(t("error.revertFailed", { hash: h.slice(0, 7), message: msg }));
      }
    }
  }

  async squash(
    hashes: string[],
    allCommits: Commit[],
    message: string,
  ): Promise<void> {
    if (hashes.length < 2)
      throw new Error(t("error.squashMinimum"));
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error(t("error.squashRoot"));
    await this.git.raw(["reset", "--soft", base]);
    await this.git.raw(["commit", "-m", message]);
  }

  async drop(hashes: string[], allCommits: Commit[]): Promise<void> {
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error(t("error.dropRoot"));
    await this.runInteractiveRebase(base, "drop", hashes);
  }

  async reset(mode: ResetMode, hash: string): Promise<void> {
    await this.git.raw(["reset", `--${mode}`, hash]);
  }

  // ===== Private helpers =====

  private async assertClean(): Promise<void> {
    const status = await this.git.status();
    if (!status.isClean()) {
      throw new Error(t("error.workingTreeDirty"));
    }
  }

  private findOldestNewest(hashes: string[], allCommits: Commit[]) {
    const indexMap = new Map(allCommits.map((c, i) => [c.hash, i]));
    const indices = hashes
      .map((h) => indexMap.get(h))
      .filter((v): v is number => v !== undefined);
    if (indices.length === 0) throw new Error(t("error.commitsNotFound"));
    const minIdx = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    return { newest: allCommits[minIdx]!, oldest: allCommits[maxIdx]! };
  }

  private sortByAge(
    hashes: string[],
    allCommits: Commit[],
    order: "newestFirst" | "oldestFirst",
  ): string[] {
    const indexMap = new Map(allCommits.map((c, i) => [c.hash, i]));
    const filtered = hashes.filter((h) => indexMap.has(h));
    return filtered.sort((a, b) => {
      const ia = indexMap.get(a)!;
      const ib = indexMap.get(b)!;
      return order === "newestFirst" ? ia - ib : ib - ia;
    });
  }

  private async runInteractiveRebase(
    base: string,
    action: "fixup" | "drop",
    targetHashes: string[],
  ): Promise<void> {
    // Run the interactive rebase through a dedicated instance with a minimal
    // environment. simple-git treats inherited pager/editor variables as
    // unsafe and rejects them, and env changes made via `git.env()` stick to
    // the instance, which would break every later operation.
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      GIT_SEQUENCE_EDITOR: `node "${this.editorScript}"`,
      GITMIN_REBASE_ACTION: action,
      GITMIN_TARGET_HASHES: targetHashes.join(","),
      GIT_PAGER: "cat",
    };
    const rebaseGit = simpleGit(this.rootPath, {
      unsafe: {
        allowUnsafeEditor: true,
        allowUnsafePager: true,
      },
    });
    try {
      await rebaseGit.env(env).raw(["rebase", "-i", base]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await this.git.raw(["rebase", "--abort"]);
      } catch {
        // Ignore abort errors
      }
      throw new Error(t("error.rebaseFailed", { message: msg }));
    }
  }
}
