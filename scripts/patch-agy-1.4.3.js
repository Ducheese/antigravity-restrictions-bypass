const fs = require('fs');
const crypto = require('crypto');

const binPath = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe';
const origBackup = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe.1.4.3.orig';
const EXPECTED_ORIG_HASH = 'B9EBBC8AE00DEC96263979D2947124136CDAE990811E27EAFEF1E7F021269192';

if (!fs.existsSync(origBackup)) {
  console.error('Backup missing! Please ensure 1.4.3.orig exists.');
  process.exit(1);
}

const origData = fs.readFileSync(origBackup);
const origHash = crypto.createHash('sha256').update(origData).digest('hex').toUpperCase();
if (origHash !== EXPECTED_ORIG_HASH) {
  console.error('Orig backup hash mismatch! Expected ' + EXPECTED_ORIG_HASH + ', got ' + origHash);
  process.exit(1);
}
console.log('[PASS] 1.4.3.orig backup SHA256 verified:', origHash);

const buf = Buffer.from(origData); // clone buffer

const patchSites = [
  // Tier 1: Single rule byte limit (24,000 -> 500,000)
  {
    name: 'B1 (Rule Crop 1)',
    raw: 0x19f68c9,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B2 (Rule Crop 2)',
    raw: 0x19f7845,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B3 (Rule Crop 3)',
    raw: 0x19fbfce,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B4 (Body Byte Clamp)',
    raw: 0x3007d20,
    expectedOld: Buffer.from([0x48, 0x3d, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x3d, 0x20, 0xa1, 0x07, 0x00])
  },

  // Tier 2: Rules Token Budget (20,000 -> 200,000)
  {
    name: 'T1 (User Rules Default)',
    raw: 0x19fd652,
    expectedOld: Buffer.from([0x41, 0xb9, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x41, 0xb9, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T2 (Workspace Rules Default)',
    raw: 0x19fd6ad,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T3 (User Rules Clamp Cmp)',
    raw: 0x203b470,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T4 (User Rules Clamp Mov)',
    raw: 0x203b47d,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T5 (Workspace Rules Clamp Cmp)',
    raw: 0x203b4a0,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T6 (Workspace Rules Clamp Mov)',
    raw: 0x203b4ad,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T7 (Fallback User Rules Default)',
    raw: 0x2be4f6a,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T8 (Fallback Workspace Rules Default)',
    raw: 0x2be4fba,
    expectedOld: Buffer.from([0xbb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xbb, 0x40, 0x0d, 0x03, 0x00])
  }
];

console.log('Verifying all 12 calibrated patch sites in 1.4.3...');
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
  console.log('[SUCCESS] Atomically replaced agy.exe with patched 1.4.3!');
} catch (e) {
  console.error('Rename failed:', e.message);
  process.exit(1);
}

// Secondary verification on new agy.exe
const newBuf = fs.readFileSync(binPath);
console.log('\nVerifying new agy.exe on disk...');
console.log('Size check:', newBuf.length, 'bytes (expected 202003608)');
if (newBuf.length !== 202003608) {
  console.error('Size mismatch!');
  process.exit(1);
}

let verifyOk = true;
for (const p of patchSites) {
  const actual = newBuf.subarray(p.raw, p.raw + p.newBytes.length);
  if (!actual.equals(p.newBytes)) {
    console.error(`[FAIL] ${p.name} not patched properly!`);
    verifyOk = false;
  }
}

if (verifyOk) {
  console.log('\n>>> ALL 12 SITES VERIFIED ON DISK 100% PERFECTLY! <<<');
} else {
  console.error('Post-patch verification failed!');
  process.exit(1);
}
