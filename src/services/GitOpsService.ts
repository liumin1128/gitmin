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

export type ResetMode = "soft" | "mixed" | "hard";

export class GitOpsService {
  private readonly git: SimpleGit;
  private readonly editorScript: string;

  constructor(rootPath: string, extensionUri: vscode.Uri) {
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
        throw new Error(
          `revert ${h.slice(0, 7)} failed: ${msg}\nPlease manually resolve conflicts, then git revert --continue or --abort`,
        );
      }
    }
  }

  async squash(
    hashes: string[],
    allCommits: Commit[],
    message: string,
  ): Promise<void> {
    if (hashes.length < 2)
      throw new Error("At least 2 commits required to squash");
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error("Cannot squash root commit");
    await this.git.raw(["reset", "--soft", base]);
    await this.git.raw(["commit", "-m", message]);
  }

  async drop(hashes: string[], allCommits: Commit[]): Promise<void> {
    await this.assertClean();
    const { oldest } = this.findOldestNewest(hashes, allCommits);
    const base = oldest.parents[0];
    if (!base) throw new Error("Cannot drop root commit");
    await this.runInteractiveRebase(base, "drop", hashes);
  }

  async reset(mode: ResetMode, hash: string): Promise<void> {
    await this.git.raw(["reset", `--${mode}`, hash]);
  }

  // ===== Private helpers =====

  private async assertClean(): Promise<void> {
    const status = await this.git.status();
    if (!status.isClean()) {
      throw new Error(
        "Working tree has uncommitted changes. Please commit or stash before proceeding",
      );
    }
  }

  private findOldestNewest(hashes: string[], allCommits: Commit[]) {
    const indexMap = new Map(allCommits.map((c, i) => [c.hash, i]));
    const indices = hashes
      .map((h) => indexMap.get(h))
      .filter((v): v is number => v !== undefined);
    if (indices.length === 0) throw new Error("Specified commits not found");
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
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `node "${this.editorScript}"`,
      GITMIN_REBASE_ACTION: action,
      GITMIN_TARGET_HASHES: targetHashes.join(","),
      GIT_PAGER: "cat",
    };
    try {
      await this.git.env(env).raw(["rebase", "-i", base]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await this.git.raw(["rebase", "--abort"]);
      } catch {
        // Ignore abort errors
      }
      throw new Error(
        `rebase failed: ${msg}\nAbort was attempted, please check repo status`,
      );
    }
  }
}
