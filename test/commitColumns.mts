import assert from "node:assert/strict";
import {
  COMMIT_COLUMNS_STATE_KEY,
  DEFAULT_COMMIT_COLUMNS,
  parsePersistedCommitColumns,
} from "../shared/commitColumns.ts";

assert.equal(COMMIT_COLUMNS_STATE_KEY, "gitmin.commitColumns");
assert.deepEqual(parsePersistedCommitColumns(undefined), DEFAULT_COMMIT_COLUMNS);
assert.deepEqual(parsePersistedCommitColumns(null), DEFAULT_COMMIT_COLUMNS);

assert.deepEqual(
  parsePersistedCommitColumns({
    graph: false,
    hash: true,
    author: false,
    time: false,
    tags: true,
  }),
  {
    graph: false,
    hash: true,
    author: false,
    time: false,
    tags: true,
  },
);

assert.deepEqual(
  parsePersistedCommitColumns({ graph: "false", hash: true }),
  { ...DEFAULT_COMMIT_COLUMNS, hash: true },
  "invalid fields should fall back to their defaults independently",
);

console.log("persisted commit column checks passed");
