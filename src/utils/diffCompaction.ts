export interface CompactedDiff {
  content: string;
  truncated: boolean;
  hasCompleteFileSummary: boolean;
}

const OMITTED_SECTION = '\n... omitted ...\n';

export function compactUnifiedDiff(
  diff: string,
  maxChars: number
): CompactedDiff {
  const content = diff.trim();
  const limit = Math.max(1, Math.floor(maxChars));
  if (content.length <= limit) {
    return { content, truncated: false, hasCompleteFileSummary: true };
  }

  const sections = splitDiffSections(content);
  if (sections.length === 0) {
    return {
      content: content.slice(0, limit),
      truncated: true,
      hasCompleteFileSummary: false,
    };
  }

  const summary = [
    '<changed_files>',
    ...sections.map(summarizeSection),
    '</changed_files>',
  ].join('\n');
  if (summary.length > limit) {
    return {
      content: content.slice(0, limit),
      truncated: true,
      hasCompleteFileSummary: false,
    };
  }

  const excerptWrapperLength = '\n<diff_excerpts>\n\n</diff_excerpts>'.length;
  const excerptBudget = limit - summary.length - excerptWrapperLength;
  if (excerptBudget <= 0) {
    return {
      content: summary,
      truncated: true,
      hasCompleteFileSummary: true,
    };
  }

  const excerpts = buildBalancedExcerpts(sections, excerptBudget);
  return {
    content: `${summary}\n<diff_excerpts>\n${excerpts}\n</diff_excerpts>`,
    truncated: true,
    hasCompleteFileSummary: true,
  };
}

function splitDiffSections(diff: string): string[] {
  const matches = [...diff.matchAll(/^diff --git .+$/gm)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? diff.length;
    return diff.slice(start, end).trimEnd();
  });
}

function summarizeSection(section: string): string {
  const lines = section.split(/\r?\n/);
  const header = lines[0];
  let additions = 0;
  let deletions = 0;
  let inHunk = false;

  for (const line of lines.slice(1)) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+')) additions += 1;
    else if (line.startsWith('-')) deletions += 1;
  }

  return `${header} (+${additions} -${deletions})`;
}

function buildBalancedExcerpts(
  sections: readonly string[],
  maxChars: number
): string {
  const separatorBudget = Math.min(sections.length - 1, maxChars);
  const allocations = distributeBudget(
    sections.map((section) => section.length),
    maxChars - separatorBudget
  );
  return sections
    .map((section, index) => excerpt(section, allocations[index]))
    .filter(Boolean)
    .join('\n')
    .slice(0, maxChars);
}

function distributeBudget(capacities: readonly number[], budget: number): number[] {
  const allocations = capacities.map(() => 0);
  let remaining = Math.max(0, budget);
  let active = capacities.map((_, index) => index);

  while (remaining > 0 && active.length > 0) {
    const share = Math.max(1, Math.floor(remaining / active.length));
    const nextActive: number[] = [];

    for (const index of active) {
      if (remaining === 0) break;
      const available = capacities[index] - allocations[index];
      const granted = Math.min(available, share, remaining);
      allocations[index] += granted;
      remaining -= granted;
      if (allocations[index] < capacities[index]) nextActive.push(index);
    }

    active = nextActive;
  }

  return allocations;
}

function excerpt(section: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (section.length <= maxChars) return section;
  if (maxChars <= OMITTED_SECTION.length + 2) return section.slice(0, maxChars);

  const available = maxChars - OMITTED_SECTION.length;
  const tailLength = Math.max(1, Math.floor(available * 0.3));
  const headLength = available - tailLength;
  return `${section.slice(0, headLength)}${OMITTED_SECTION}${section.slice(-tailLength)}`;
}
