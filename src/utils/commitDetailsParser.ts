import type { CommitDetails } from '../../shared/domain';

export const COMMIT_DETAILS_FORMAT = [
  '%H',
  '%h',
  '%T',
  '%P',
  '%D',
  '%s',
  '%b',
  '%an',
  '%ae',
  '%aI',
  '%cn',
  '%ce',
  '%cI',
  '%e',
  '%G?',
  '%GS',
  '%GK',
].join('%x00') + '%x1e';

export function parseCommitDetailsOutput(output: string): CommitDetails[] {
  return output
    .split('\x1e')
    .map((record) => record.replace(/^[\r\n]+/, ''))
    .filter((record) => record.length > 0)
    .map(parseCommitDetailsRecord);
}

function parseCommitRefs(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split(',').map((ref) => ref.trim()).filter(Boolean);
}

function parseCommitDetailsRecord(record: string): CommitDetails {
  const [
    hash,
    shortHash,
    treeHash,
    parentsRaw,
    refsRaw,
    subject,
    body,
    authorName,
    authorEmail,
    authorDate,
    committerName,
    committerEmail,
    committerDate,
    encoding,
    signatureStatus,
    signatureSigner,
    signatureKey,
  ] = record.split('\x00');

  return {
    hash: hash ?? '',
    shortHash: shortHash ?? '',
    treeHash: treeHash ?? '',
    parents: parentsRaw ? parentsRaw.split(' ').filter(Boolean) : [],
    refs: parseCommitRefs(refsRaw ?? ''),
    subject: subject ?? '',
    body: body ?? '',
    author: {
      name: authorName ?? '',
      email: authorEmail ?? '',
      date: authorDate ?? '',
    },
    committer: {
      name: committerName ?? '',
      email: committerEmail ?? '',
      date: committerDate ?? '',
    },
    encoding: encoding || 'UTF-8',
    signature: {
      status: signatureStatus ?? '',
      signer: signatureSigner ?? '',
      key: signatureKey ?? '',
    },
  };
}
