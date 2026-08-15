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
    checkedToggleCommand: string;
    visibilityContext: string;
  }
> = {
  repositories: {
    labelKey: 'view.repositories',
    toggleCommand: 'gitmin.toggleRepositoriesView',
    checkedToggleCommand: 'gitmin.toggleRepositoriesView.checked',
    visibilityContext: 'gitmin.workbenchView.repositories.visible',
  },
  changes: {
    labelKey: 'view.changes',
    toggleCommand: 'gitmin.toggleChangesView',
    checkedToggleCommand: 'gitmin.toggleChangesView.checked',
    visibilityContext: 'gitmin.workbenchView.changes.visible',
  },
  commits: {
    labelKey: 'view.commits',
    toggleCommand: 'gitmin.toggleCommitsView',
    checkedToggleCommand: 'gitmin.toggleCommitsView.checked',
    visibilityContext: 'gitmin.workbenchView.commits.visible',
  },
  stashes: {
    labelKey: 'view.stashes',
    toggleCommand: 'gitmin.toggleStashesView',
    checkedToggleCommand: 'gitmin.toggleStashesView.checked',
    visibilityContext: 'gitmin.workbenchView.stashes.visible',
  },
  files: {
    labelKey: 'view.changedFiles',
    toggleCommand: 'gitmin.toggleChangedFilesView',
    checkedToggleCommand: 'gitmin.toggleChangedFilesView.checked',
    visibilityContext: 'gitmin.workbenchView.files.visible',
  },
  details: {
    labelKey: 'view.commitDetails',
    toggleCommand: 'gitmin.toggleCommitDetailsView',
    checkedToggleCommand: 'gitmin.toggleCommitDetailsView.checked',
    visibilityContext: 'gitmin.workbenchView.details.visible',
  },
};
