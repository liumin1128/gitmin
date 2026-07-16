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
    label: string;
    toggleCommand: string;
    checkedToggleCommand: string;
    visibilityContext: string;
  }
> = {
  repositories: {
    label: 'Repositories',
    toggleCommand: 'gitmin.toggleRepositoriesView',
    checkedToggleCommand: 'gitmin.toggleRepositoriesView.checked',
    visibilityContext: 'gitmin.workbenchView.repositories.visible',
  },
  changes: {
    label: 'Changes',
    toggleCommand: 'gitmin.toggleChangesView',
    checkedToggleCommand: 'gitmin.toggleChangesView.checked',
    visibilityContext: 'gitmin.workbenchView.changes.visible',
  },
  commits: {
    label: 'Commits',
    toggleCommand: 'gitmin.toggleCommitsView',
    checkedToggleCommand: 'gitmin.toggleCommitsView.checked',
    visibilityContext: 'gitmin.workbenchView.commits.visible',
  },
  stashes: {
    label: 'Stashes',
    toggleCommand: 'gitmin.toggleStashesView',
    checkedToggleCommand: 'gitmin.toggleStashesView.checked',
    visibilityContext: 'gitmin.workbenchView.stashes.visible',
  },
  files: {
    label: 'Changed Files',
    toggleCommand: 'gitmin.toggleChangedFilesView',
    checkedToggleCommand: 'gitmin.toggleChangedFilesView.checked',
    visibilityContext: 'gitmin.workbenchView.files.visible',
  },
  details: {
    label: 'Commit Details',
    toggleCommand: 'gitmin.toggleCommitDetailsView',
    checkedToggleCommand: 'gitmin.toggleCommitDetailsView.checked',
    visibilityContext: 'gitmin.workbenchView.details.visible',
  },
};
