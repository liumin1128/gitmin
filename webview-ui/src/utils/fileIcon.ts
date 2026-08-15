const CODE_FILE_NAMES = new Set([
  'dockerfile',
  'gemfile',
  'jenkinsfile',
  'makefile',
  'rakefile',
]);

const CODE_EXTENSIONS = new Set([
  'bash', 'c', 'cc', 'cpp', 'cs', 'css', 'go', 'graphql', 'h', 'hpp', 'html',
  'java', 'js', 'jsx', 'kt', 'kts', 'less', 'mjs', 'php', 'proto', 'py', 'rb',
  'rs', 'sass', 'scss', 'sh', 'sql', 'svelte', 'swift', 'toml', 'ts', 'tsx',
  'vue', 'xml', 'yaml', 'yml', 'zsh',
]);

const MEDIA_EXTENSIONS = new Set([
  'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'mov', 'mp3', 'mp4', 'ogg',
  'png', 'svg', 'wav', 'webm', 'webp',
]);

const ARCHIVE_EXTENSIONS = new Set([
  '7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'zip',
]);

const BINARY_EXTENSIONS = new Set([
  'bin', 'dll', 'dylib', 'exe', 'so', 'wasm',
]);

export function getFileCodicon(path: string): string {
  const name = path.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  if (['md', 'markdown', 'mdx'].includes(extension)) return 'markdown';
  if (['json', 'jsonc'].includes(extension)) return 'json';
  if (extension === 'pdf') return 'file-pdf';
  if (MEDIA_EXTENSIONS.has(extension)) return 'file-media';
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'file-zip';
  if (BINARY_EXTENSIONS.has(extension)) return 'file-binary';
  if (CODE_FILE_NAMES.has(name) || CODE_EXTENSIONS.has(extension)) return 'file-code';
  if (['csv', 'log', 'sum', 'txt'].includes(extension)) return 'file-text';
  return 'file';
}
