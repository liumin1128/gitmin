/**
 * git 输出解析纯函数集合
 * 全部为无副作用纯函数，便于单测
 */
import type { Commit, FileChange, FileStatus } from '../../shared/domain';

/** git log --pretty=format 分隔符使用 \x00（NUL），避免 message 中的字符冲突 */
export const LOG_FORMAT = '%H%x00%h%x00%s%x00%an%x00%ae%x00%aI%x00%P%x00%D';

export function parseLogLine(line: string): Commit {
  const [hash, shortHash, message, author, email, date, parentsRaw, refsRaw] = line.split('\x00');
  return {
    hash: hash ?? '',
    shortHash: shortHash ?? '',
    message: message ?? '',
    author: author ?? '',
    email: email ?? '',
    date: date ?? '',
    parents: parentsRaw ? parentsRaw.split(' ').filter(Boolean) : [],
    refs: parseCommitRefs(refsRaw ?? ''),
  };
}

export function parseCommitRefs(raw: string): string[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

export function parseLogOutput(output: string): Commit[] {
  return output
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map(parseLogLine);
}

/**
 * 解析 git diff --name-status 输出
 * 格式:
 *   A\tpath
 *   M\tpath
 *   D\tpath
 *   R100\toldpath\tnewpath
 *   C75\toldpath\tnewpath
 */
export interface StatusEntry {
  status: FileStatus;
  oldPath?: string;
}

export function parseNameStatus(output: string): Map<string, StatusEntry> {
  const map = new Map<string, StatusEntry>();
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const raw = parts[0]!;
    const first = raw[0];
    if (first === 'R') {
      map.set(parts[2]!, { status: 'R', oldPath: parts[1] });
    } else if (first === 'C') {
      map.set(parts[2]!, { status: 'C', oldPath: parts[1] });
    } else if (first === 'A' || first === 'M' || first === 'D' || first === 'U') {
      map.set(parts[1]!, { status: first as FileStatus });
    } else {
      map.set(parts[1] ?? '?', { status: '?' });
    }
  }
  return map;
}

/**
 * 解析 git diff --numstat 输出
 * 格式: insertions\tdeletions\tpath
 * 二进制文件 insertions/deletions 都为 "-"
 */
export interface NumstatEntry {
  insertions: number;
  deletions: number;
  binary: boolean;
}

export function parseNumstat(output: string): Map<string, NumstatEntry> {
  const map = new Map<string, NumstatEntry>();
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const [insStr, delStr, ...pathParts] = parts;
    const path = pathParts.join('\t');
    if (!path) continue;
    const binary = insStr === '-' && delStr === '-';
    map.set(path, {
      insertions: binary ? 0 : parseInt(insStr ?? '0', 10) || 0,
      deletions: binary ? 0 : parseInt(delStr ?? '0', 10) || 0,
      binary,
    });
  }
  return map;
}

/**
 * 合并 name-status 与 numstat 结果为 FileChange 列表
 */
export function mergeFileChanges(
  statusMap: Map<string, StatusEntry>,
  numstatMap: Map<string, NumstatEntry>
): FileChange[] {
  const paths = new Set<string>([...statusMap.keys(), ...numstatMap.keys()]);
  const result: FileChange[] = [];
  for (const path of paths) {
    const s = statusMap.get(path);
    const n = numstatMap.get(path);
    result.push({
      path,
      oldPath: s?.oldPath,
      status: s?.status ?? '?',
      insertions: n?.insertions ?? 0,
      deletions: n?.deletions ?? 0,
      binary: n?.binary ?? false,
    });
  }
  // 按 path 稳定排序
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}
