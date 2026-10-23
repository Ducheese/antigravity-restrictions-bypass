/**
 * patch-agy-1.4.6.js
 * 
 * 针对 Antigravity CLI v1.4.6 (204,022,936 字节) 的双层规则门禁放宽补丁脚本：
 * - 第一层 4 处 24,000 字节 -> 500,000 字节 (0x7A120)
 * - 第二层 8 处 20,000 Tokens -> 200,000 Tokens (0x30D40)
 * 采用纯数值等长机器码替换与 Windows 原子重命名落地。
 */

const fs = require('fs');
const crypto = require('crypto');

const binPath = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe';
const origBackup = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe.1.4.6.orig';
const EXPECTED_ORIG_HASH = 'A6A1A638CBF4874B31B683D728D9343EE71BD30077934D2448EEA881264E1250';
const EXPECTED_FILE_SIZE = 204022936;

if (!fs.existsSync(origBackup)) {
  console.error('Backup missing! Please ensure 1.4.6.orig exists.');
  process.exit(1);
}

const origData = fs.readFileSync(origBackup);
const origHash = crypto.createHash('sha256').update(origData).digest('hex').toUpperCase();
if (origHash !== EXPECTED_ORIG_HASH) {
  console.error('Orig backup hash mismatch! Expected ' + EXPECTED_ORIG_HASH + ', got ' + origHash);
  process.exit(1);
}
console.log('[PASS] 1.4.6.orig backup SHA256 verified:', origHash);

const buf = Buffer.from(origData); // clone buffer

const patchSites = [
  // Tier 1: Single rule byte limit (24,000 -> 500,000)
  {
    name: 'B1 (Rule Crop 1)',
    raw: 0x19ba6a9,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B2 (Rule Crop 2)',
    raw: 0x19bb625,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B3 (Rule Crop 3)',
    raw: 0x19c0207,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B4 (Body Byte Clamp)',
    raw: 0x3096a80,
    expectedOld: Buffer.from([0x48, 0x3d, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x3d, 0x20, 0xa1, 0x07, 0x00])
  },

  // Tier 2: Rules Token Budget (20,000 -> 200,000)
  {
    name: 'T1 (User Rules Default)',
    raw: 0x19c1a52,
    expectedOld: Buffer.from([0x41, 0xb9, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x41, 0xb9, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T2 (Workspace Rules Default)',
    raw: 0x19c1aad,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T3 (User Rules Clamp Cmp)',
    raw: 0x2031cf0,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T4 (User Rules Clamp Mov)',
    raw: 0x2031cfd,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T5 (Workspace Rules Clamp Cmp)',
    raw: 0x2031d20,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T6 (Workspace Rules Clamp Mov)',
    raw: 0x2031d2d,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T7 (Fallback User Rules Default)',
    raw: 0x2c606ea,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T8 (Fallback Workspace Rules Default)',
    raw: 0x2c6073a,
    expectedOld: Buffer.from([0xbb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xbb, 0x40, 0x0d, 0x03, 0x00])
  }
];

console.log('Verifying all 12 calibrated patch sites in 1.4.6.orig...');
let allMatch = true;
for (const p of patchSites) {
  const actual = buf.subarray(p.raw, p.raw + p.expectedOld.length);
  if (!actual.equals(p.expectedOld)) {
    console.error(`[FAIL] Mismatch at ${p.name} (raw 0x${p.raw.toString(16)}):`);
    console.error(`  Expected: ${p.expectedOld.toString('hex')}`);
    console.error(`  Actual:   ${actual.toString('hex')}`);
    allMatch = false;
  } else {
    console.log(`[PASS] ${p.name} at raw 0x${p.raw.toString(16)}: ${actual.toString('hex')}`);
  }
}

if (!allMatch) {
  console.error('Pre-patch verification failed! Aborting.');
  process.exit(1);
}

console.log('\nAll 12 sites verified 100%! Applying patch to memory buffer...');
for (const p of patchSites) {
  p.newBytes.copy(buf, p.raw);
  console.log(`[PATCHED] ${p.name} -> ${p.newBytes.toString('hex')}`);
}

// Write to patched temporary file
const patchedTmp = binPath + '.patched';
fs.writeFileSync(patchedTmp, buf);
console.log('\nPatched file written to:', patchedTmp);

// Atomic replace
const oldReplace = binPath + '.old_replace';
try {
  if (fs.existsSync(oldReplace)) fs.unlinkSync(oldReplace);
} catch (e) {}

try {
  fs.renameSync(binPath, oldReplace);
  fs.renameSync(patchedTmp, binPath);
  console.log('[SUCCESS] Atomically replaced agy.exe with patched 1.4.6!');
} catch (e) {
  console.error('Rename failed:', e.message);
  process.exit(1);
}

// Secondary verification on new agy.exe
const newBuf = fs.readFileSync(binPath);
console.log('\nVerifying new agy.exe on disk...');
console.log('Size check:', newBuf.length, 'bytes (expected ' + EXPECTED_FILE_SIZE + ')');
if (newBuf.length !== EXPECTED_FILE_SIZE) {
  console.error('[FAIL] Size mismatch!');
  process.exit(1);
}

let diskMatch = true;
for (const p of patchSites) {
  const actual = newBuf.subarray(p.raw, p.raw + p.newBytes.length);
  if (!actual.equals(p.newBytes)) {
    console.error(`[FAIL] Disk verify failed at ${p.name}!`);
    diskMatch = false;
  }
}

if (diskMatch) {
  const newHash = crypto.createHash('sha256').update(newBuf).digest('hex').toUpperCase();
  console.log('[ALL VERIFIED] All 12 patch sites 100% verified on disk!');
  console.log('Patched 1.4.6 SHA256:', newHash);
} else {
  console.error('[FAIL] Post-patch disk verification failed!');
  process.exit(1);
}
