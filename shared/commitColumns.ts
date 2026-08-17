export interface CommitColumnFlags {
  graph: boolean;
  hash: boolean;
  author: boolean;
  time: boolean;
  tags: boolean;
}

export const DEFAULT_COMMIT_COLUMNS: CommitColumnFlags = {
  graph: true,
  hash: false,
  author: true,
  time: true,
  tags: false,
};

export const COMMIT_COLUMNS_STATE_KEY = "gitmin.commitColumns";

const COLUMN_KEYS = ["graph", "hash", "author", "time", "tags"] as const;

export function parsePersistedCommitColumns(value: unknown): CommitColumnFlags {
  const columns = { ...DEFAULT_COMMIT_COLUMNS };
  if (!isRecord(value)) return columns;

  for (const key of COLUMN_KEYS) {
    if (typeof value[key] === "boolean") columns[key] = value[key];
  }
  return columns;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
