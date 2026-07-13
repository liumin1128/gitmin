import assert from "node:assert/strict";
import {
  commitFiltersStateKey,
  parsePersistedCommitFilters,
} from "../shared/persistedFilters.ts";

assert.equal(
  commitFiltersStateKey("/workspace/repo"),
  "gitmin.commitFilters:/workspace/repo",
);

assert.deepEqual(parsePersistedCommitFilters(undefined), {});
assert.deepEqual(parsePersistedCommitFilters(null), {});
assert.deepEqual(parsePersistedCommitFilters("invalid"), {});

assert.deepEqual(
  parsePersistedCommitFilters({
    search: "WMP-2973",
    searchRegex: true,
    searchCaseSensitive: false,
    branch: "__all__",
    author: "min_liu",
    dateAfter: "2026-06-01",
    dateBefore: "2026-07-12",
  }),
  {
    search: "WMP-2973",
    searchRegex: true,
    searchCaseSensitive: false,
    branch: "__all__",
    author: "min_liu",
    dateAfter: "2026-06-01",
    dateBefore: "2026-07-12",
  },
);

assert.deepEqual(
  parsePersistedCommitFilters({
    search: 42,
    searchRegex: "true",
    branch: "main",
    author: false,
    dateAfter: null,
  }),
  { branch: "main" },
  "invalid persisted fields should be ignored independently",
);

console.log("persisted filter checks passed");
