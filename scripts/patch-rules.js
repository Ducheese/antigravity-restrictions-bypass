/**
 * patch-rules.js (Universal Dynamic Rules Patcher)
 * 
 * Antigravity CLI 全版本通用自适应双层规则门禁放宽补丁脚本。
 * 
 * 核心原理：
 *   利用 12 处修改点在 Go 编译器指令层坚固的上下文特征签名（Signatures），
 *   在任意 1.4.x+ 版本的 .text 代码段中动态定位物理偏移，无需按版本硬编码偏移量。
 * 
 * 门禁放宽目标：
 *   - 第一层：单文件规则字节上限 24,000 (0x5DC0) -> 500,000 字节 (0x7A120) [4 处]
 *   - 第二层：规则集全局 Token 预算 20,000 (0x4E20) -> 200,000 Tokens (0x30D40) [8 处]
 * 
 * 安全机制：
 *   1. 必须 12 处修改点全部 100% 唯一命中才允许执行，杜绝误伤未知代码；
 *   2. 纯数值等长立即数机器码替换，零控制流破坏；
 *   3. 自动归档官方出厂原版备份（.orig）；
 *   4. Windows 原子重命名落地，防文件锁冲突。
 * 
 * 用法：
 *   node scripts/patch-rules.js              # 自动检测并修补当前系统 agy.exe
 *   node scripts/patch-rules.js status       # 查看当前修补状态与 12 处点位解析
 *   node scripts/patch-rules.js verify       # 校验当前磁盘文件是否 100% 正确修补
 *   node scripts/patch-rules.js [path_to_exe] # 指定目标二进制路径
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_BIN = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe';

const V_24K_ORIG = Buffer.from([0xc0, 0x5d, 0x00, 0x00]); // 24,000
const V_24K_NEW  = Buffer.from([0x20, 0xa1, 0x07, 0x00]); // 500,000
const V_20K_ORIG = Buffer.from([0x20, 0x4e, 0x00, 0x00]); // 20,000
const V_20K_NEW  = Buffer.from([0x40, 0x0d, 0x03, 0x00]); // 200,000

// 动态解析二进制中的 12 处修改点
function resolveSites(buf, targetMode /* 'orig' | 'patched' */) {
  const v_24k = targetMode === 'patched' ? V_24K_NEW : V_24K_ORIG;
  const v_20k = targetMode === 'patched' ? V_20K_NEW : V_20K_ORIG;

  // B1: b9 [24k] 48 8d bc 24 38 01 00 00
  const b1_hits = [];
  let idx = 0;
  const b1Lead = Buffer.concat([Buffer.from([0xb9]), v_24k, Buffer.from('488dbc2438010000', 'hex')]);
  while ((idx = buf.indexOf(b1Lead, idx)) !== -1) { b1_hits.push(idx); idx++; }

  // B2: 48 8b 42 30 48 8b 5a 38 b9 [24k] 48 8d bc 24 50 01 00 00
  const b2_hits = [];
  idx = 0;
  const b2Lead = Buffer.concat([Buffer.from([0xb9]), v_24k, Buffer.from('488dbc2450010000', 'hex')]);
  while ((idx = buf.indexOf(b2Lead, idx)) !== -1) { b2_hits.push(idx); idx++; }

  // B3: 48 8b 41 78 48 8b 99 80 00 00 00 b9 [24k] 48 8d bc 24 c8 01 00 00
  const b3_hits = [];
  idx = 0;
  const b3Lead = Buffer.concat([Buffer.from([0xb9]), v_24k, Buffer.from('488dbc24c8010000', 'hex')]);
  while ((idx = buf.indexOf(b3Lead, idx)) !== -1) { b3_hits.push(idx); idx++; }

  // B4: 48 3d [24k] 0f 8e
  const b4_hits = [];
  idx = 0;
  const b4Lead = Buffer.concat([Buffer.from('483d', 'hex'), v_24k, Buffer.from('0f8e', 'hex')]);
  while ((idx = buf.indexOf(b4Lead, idx)) !== -1) { b4_hits.push(idx); idx++; }

  // T1: 41 b9 [20k] 74 08
  const t1_hits = [];
  idx = 0;
  const t1Lead = Buffer.concat([Buffer.from('41b9', 'hex'), v_20k, Buffer.from('7408', 'hex')]);
  while ((idx = buf.indexOf(t1Lead, idx)) !== -1) { t1_hits.push(idx); idx++; }

  // T2: 31 d2 eb 05 ba [20k]
  const t2_hits = [];
  idx = 0;
  const t2Lead = Buffer.concat([Buffer.from('31d2eb05ba', 'hex'), v_20k]);
  while ((idx = buf.indexOf(t2Lead, idx)) !== -1) { t2_hits.push(idx + 4); idx++; }

  // T3 & T4 (User Clamp) & T5 & T6 (Workspace Clamp)
  // 48 81 fb [20k] 0f 8e [4 bytes] ba [20k]
  const clamp_hits = [];
  idx = 0;
  const clampLead = Buffer.concat([Buffer.from('4881fb', 'hex'), v_20k, Buffer.from('0f8e', 'hex')]);
  while ((idx = buf.indexOf(clampLead, idx)) !== -1) {
    if (buf[idx + 13] === 0xba && buf.subarray(idx + 14, idx + 18).equals(v_20k)) {
      clamp_hits.push({ cmp: idx, mov: idx + 13 });
    }
    idx++;
  }

  // T7: 48 85 c0 ba [20k] 74 06
  const t7_hits = [];
  idx = 0;
  const t7Lead = Buffer.concat([Buffer.from('4885c0ba', 'hex'), v_20k, Buffer.from('7406', 'hex')]);
  while ((idx = buf.indexOf(t7Lead, idx)) !== -1) { t7_hits.push(idx + 3); idx++; }

  // T8: 31 db eb 05 bb [20k]
  const t8_hits = [];
  idx = 0;
  const t8Lead = Buffer.concat([Buffer.from('31dbeb05bb', 'hex'), v_20k]);
  while ((idx = buf.indexOf(t8Lead, idx)) !== -1) { t8_hits.push(idx + 4); idx++; }

  const ok = (
    b1_hits.length === 1 && b2_hits.length === 1 && b3_hits.length === 1 && b4_hits.length === 1 &&
    t1_hits.length === 1 && t2_hits.length === 1 && clamp_hits.length === 2 &&
    t7_hits.length === 1 && t8_hits.length === 1
  );

  if (!ok) return null;

  return [
    { id: 'B1', name: 'Rule Crop 1', raw: b1_hits[0], valOffset: b1_hits[0] + 1, type: 'byte' },
    { id: 'B2', name: 'Rule Crop 2', raw: b2_hits[0], valOffset: b2_hits[0] + 1, type: 'byte' },
    { id: 'B3', name: 'Rule Crop 3', raw: b3_hits[0], valOffset: b3_hits[0] + 1, type: 'byte' },
    { id: 'B4', name: 'Body Byte Clamp', raw: b4_hits[0], valOffset: b4_hits[0] + 2, type: 'byte' },
    { id: 'T1', name: 'User Rules Default', raw: t1_hits[0], valOffset: t1_hits[0] + 2, type: 'token' },
    { id: 'T2', name: 'Workspace Rules Default', raw: t2_hits[0], valOffset: t2_hits[0] + 1, type: 'token' },
    { id: 'T3', name: 'User Rules Clamp Cmp', raw: clamp_hits[0].cmp, valOffset: clamp_hits[0].cmp + 3, type: 'token' },
    { id: 'T4', name: 'User Rules Clamp Mov', raw: clamp_hits[0].mov, valOffset: clamp_hits[0].mov + 1, type: 'token' },
    { id: 'T5', name: 'Workspace Rules Clamp Cmp', raw: clamp_hits[1].cmp, valOffset: clamp_hits[1].cmp + 3, type: 'token' },
    { id: 'T6', name: 'Workspace Rules Clamp Mov', raw: clamp_hits[1].mov, valOffset: clamp_hits[1].mov + 1, type: 'token' },
    { id: 'T7', name: 'Fallback User Default', raw: t7_hits[0], valOffset: t7_hits[0] + 1, type: 'token' },
    { id: 'T8', name: 'Fallback Workspace Default', raw: t8_hits[0], valOffset: t8_hits[0] + 1, type: 'token' }
  ];
}

function main() {
  const args = process.argv.slice(2);
  let cmd = 'patch';
  let binPath = DEFAULT_BIN;

  for (const a of args) {
    if (a === 'status' || a === '--status') cmd = 'status';
    else if (a === 'verify' || a === '--verify') cmd = 'verify';
    else if (a === 'patch' || a === '--patch') cmd = 'patch';
    else if (!a.startsWith('-')) binPath = a;
  }

  if (!fs.existsSync(binPath)) {
    console.error(`Target executable not found: ${binPath}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(binPath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();

  console.log('=== Antigravity Universal Patcher ===');
  console.log(`Target: ${binPath}`);
  console.log(`Size:   ${buf.length} bytes`);
  console.log(`SHA256: ${hash}\n`);

  // 检测目标状态
  const sitesPatched = resolveSites(buf, 'patched');
  const sitesOrig = resolveSites(buf, 'orig');

  if (cmd === 'status' || cmd === 'verify') {
    if (sitesPatched) {
      console.log('[STATUS: PATCHED] All 12 patch sites are ACTIVE (500K bytes & 200K tokens):');
      sitesPatched.forEach(s => {
        console.log(`  [${s.id.padEnd(2)}] Raw: 0x${s.raw.toString(16).padEnd(7)} | ValOffset: 0x${s.valOffset.toString(16).padEnd(7)} | ${s.name}`);
      });
      console.log('\nVerification Result: 100% PASS');
      process.exit(0);
    } else if (sitesOrig) {
      console.log('[STATUS: UNPATCHED] Target is in OFFICIAL ORIGINAL state (24K bytes & 20K tokens):');
      sitesOrig.forEach(s => {
        console.log(`  [${s.id.padEnd(2)}] Raw: 0x${s.raw.toString(16).padEnd(7)} | ValOffset: 0x${s.valOffset.toString(16).padEnd(7)} | ${s.name}`);
      });
      if (cmd === 'verify') {
        console.error('\nVerification Result: FAILED (Binary is not patched)');
        process.exit(1);
      }
      process.exit(0);
    } else {
      console.error('[STATUS: UNKNOWN] Failed to resolve 12 sites cleanly. Binary may be corrupted or significantly restructured.');
      process.exit(1);
    }
  }

  // cmd === 'patch'
  if (sitesPatched) {
    console.log('[ALREADY PATCHED] Target binary already has all 12 patch sites active. No action needed.');
    process.exit(0);
  }

  if (!sitesOrig) {
    console.error('[ERROR] Failed to locate all 12 signature sites uniquely in original binary. Aborting for safety.');
    process.exit(1);
  }

  console.log('[RESOLVED] All 12 patch sites dynamically identified:');
  sitesOrig.forEach(s => {
    console.log(`  [${s.id.padEnd(2)}] Raw: 0x${s.raw.toString(16).padEnd(7)} | ValOffset: 0x${s.valOffset.toString(16).padEnd(7)} | ${s.name}`);
  });

  // 创建出厂原版备份（如果尚未备份）
  const origBackupPath = binPath + '.' + hash.substring(0, 8) + '.orig';
  if (!fs.existsSync(origBackupPath)) {
    fs.writeFileSync(origBackupPath, buf);
    console.log(`\n[BACKUP] Saved pristine original backup to: ${origBackupPath}`);
  }

  // 内存中打补丁
  const patchedBuf = Buffer.from(buf);
  for (const s of sitesOrig) {
    const newVal = s.type === 'byte' ? V_24K_NEW : V_20K_NEW;
    newVal.copy(patchedBuf, s.valOffset);
  }

  // 写入临时文件并通过原子重命名落地
  const patchedTmp = binPath + '.patched';
  fs.writeFileSync(patchedTmp, patchedBuf);

  // 尝试清理已解锁的历史 .old 文件
  try {
    const dir = path.dirname(binPath);
    const base = path.basename(binPath);
    fs.readdirSync(dir).forEach(f => {
      if (f.startsWith(base) && (f.endsWith('.old') || f.endsWith('.old_replace'))) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      }
    });
  } catch (_) {}

  const oldReplace = `${binPath}.${Date.now()}.old`;
  try {
    fs.renameSync(binPath, oldReplace);
    fs.renameSync(patchedTmp, binPath);
    console.log('\n[SUCCESS] Atomically replaced agy.exe with patched binary!');
  } catch (e) {
    console.error('Rename failed:', e.message);
    process.exit(1);
  }

  // 二次读盘校验
  const diskBuf = fs.readFileSync(binPath);
  const verifyResult = resolveSites(diskBuf, 'patched');
  if (verifyResult) {
    const newHash = crypto.createHash('sha256').update(diskBuf).digest('hex').toUpperCase();
    console.log('[VERIFIED] Disk verification 100% PASS!');
    console.log(`New Patched SHA256: ${newHash}`);
  } else {
    console.error('[FAIL] Post-patch verification failed on disk!');
    process.exit(1);
  }
}

main();
