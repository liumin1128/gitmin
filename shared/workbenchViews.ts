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

export type WorkbenchViewVisibility = Record<WorkbenchViewId, boolean>;

export const WORKBENCH_VIEW_METADATA: Record<
  WorkbenchViewId,
  {
    labelKey: TranslationKey;
    toggleCommand: string;
    visibilityContext: string;
  }
> = {
  repositories: {
    labelKey: 'view.repositories',
    toggleCommand: 'gitmin.toggleRepositoriesView',
    visibilityContext: 'gitmin.workbenchView.repositories.visible',
  },
  changes: {
    labelKey: 'view.changes',
    toggleCommand: 'gitmin.toggleChangesView',
    visibilityContext: 'gitmin.workbenchView.changes.visible',
  },
  commits: {
    labelKey: 'view.commits',
    toggleCommand: 'gitmin.toggleCommitsView',
    visibilityContext: 'gitmin.workbenchView.commits.visible',
  },
  stashes: {
    labelKey: 'view.stashes',
    toggleCommand: 'gitmin.toggleStashesView',
    visibilityContext: 'gitmin.workbenchView.stashes.visible',
  },
  files: {
    labelKey: 'view.changedFiles',
    toggleCommand: 'gitmin.toggleChangedFilesView',
    visibilityContext: 'gitmin.workbenchView.files.visible',
  },
  details: {
    labelKey: 'view.commitDetails',
    toggleCommand: 'gitmin.toggleCommitDetailsView',
    visibilityContext: 'gitmin.workbenchView.details.visible',
  },
};
