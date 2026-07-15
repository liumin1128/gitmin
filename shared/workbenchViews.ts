export const WORKBENCH_VIEW_IDS = [
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
  { label: string; toggleCommand: string; visibilityContext: string }
> = {
  changes: {
    label: 'Changes',
    toggleCommand: 'gitmin.toggleChangesView',
    visibilityContext: 'gitmin.workbenchView.changes.visible',
  },
  commits: {
    label: 'Commits',
    toggleCommand: 'gitmin.toggleCommitsView',
    visibilityContext: 'gitmin.workbenchView.commits.visible',
  },
  stashes: {
    label: 'Stashes',
    toggleCommand: 'gitmin.toggleStashesView',
    visibilityContext: 'gitmin.workbenchView.stashes.visible',
  },
  files: {
    label: 'Changed Files',
    toggleCommand: 'gitmin.toggleChangedFilesView',
    visibilityContext: 'gitmin.workbenchView.files.visible',
  },
  details: {
    label: 'Commit Details',
    toggleCommand: 'gitmin.toggleCommitDetailsView',
    visibilityContext: 'gitmin.workbenchView.details.visible',
  },
};
