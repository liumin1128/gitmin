import type { TranslationKey } from './i18n';

export const WORKBENCH_VIEW_IDS = [
  'repositories',
  'changes',
  'commits',
  'stashes',
  'files',
  'details',
] as const;

export type WorkbenchViewId = (typeof WORKBENCH_VIEW_IDS)[number];

export const WORKBENCH_VIEW_METADATA: Record<
  WorkbenchViewId,
  { labelKey: TranslationKey }
> = {
  repositories: {
    labelKey: 'view.repositories',
  },
  changes: {
    labelKey: 'view.changes',
  },
  commits: {
    labelKey: 'view.commits',
  },
  stashes: {
    labelKey: 'view.stashes',
  },
  files: {
    labelKey: 'view.changedFiles',
  },
  details: {
    labelKey: 'view.commitDetails',
  },
};
