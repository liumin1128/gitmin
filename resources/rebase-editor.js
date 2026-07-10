#!/usr/bin/env node
/**
 * git rebase -i 交互编辑器替代脚本
 * 通过环境变量控制对 pick 行的改写：
 *   GITMGR_REBASE_ACTION: 'fixup' | 'drop'
 *   GITMGR_TARGET_HASHES: 逗号分隔的目标 commit hash（长/短均可）
 *
 * fixup：将目标中"最老"的保留 pick，其余目标改为 fixup（合并入前一个 pick）
 * drop： 将所有目标改为 drop
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('rebase-editor: 缺少 todo 文件路径');
  process.exit(1);
}

const action = process.env.GITMGR_REBASE_ACTION;
const targets = (process.env.GITMGR_TARGET_HASHES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!action || targets.length === 0) {
  process.exit(0);
}

function isTarget(hash) {
  return targets.some((t) => hash.startsWith(t) || t.startsWith(hash));
}

const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

let firstTargetSeen = false;
const modified = lines.map((line) => {
  const m = line.match(/^(pick|p)\s+([a-f0-9]+)\s+(.*)$/);
  if (!m) return line;
  const hash = m[2];
  if (!isTarget(hash)) return line;

  if (action === 'drop') {
    return line.replace(/^(pick|p)\s+/, 'drop ');
  }
  if (action === 'fixup') {
    if (!firstTargetSeen) {
      firstTargetSeen = true;
      return line;
    }
    return line.replace(/^(pick|p)\s+/, 'fixup ');
  }
  return line;
});

fs.writeFileSync(file, modified.join('\n'));
