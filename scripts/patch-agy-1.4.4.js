const fs = require('fs');
const crypto = require('crypto');

const binPath = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe';
const origBackup = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe.1.4.4.orig';
const EXPECTED_ORIG_HASH = 'D4354765881F384E9229978AF37F89D26AF9E13A2BD81DEF4B2892B42B8BE38C';

if (!fs.existsSync(origBackup)) {
  console.error('Backup missing! Please ensure 1.4.4.orig exists.');
  process.exit(1);
}

const origData = fs.readFileSync(origBackup);
const origHash = crypto.createHash('sha256').update(origData).digest('hex').toUpperCase();
if (origHash !== EXPECTED_ORIG_HASH) {
  console.error('Orig backup hash mismatch! Expected ' + EXPECTED_ORIG_HASH + ', got ' + origHash);
  process.exit(1);
}
console.log('[PASS] 1.4.4.orig backup SHA256 verified:', origHash);

const buf = Buffer.from(origData); // clone buffer

const patchSites = [
  // Tier 1: Single rule byte limit (24,000 -> 500,000)
  {
    name: 'B1 (Rule Crop 1)',
    raw: 0x1a14729,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B2 (Rule Crop 2)',
    raw: 0x1a156a5,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B3 (Rule Crop 3)',
    raw: 0x1a19e2e,
    expectedOld: Buffer.from([0xb9, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0xb9, 0x20, 0xa1, 0x07, 0x00])
  },
  {
    name: 'B4 (Body Byte Clamp)',
    raw: 0x305bd40,
    expectedOld: Buffer.from([0x48, 0x3d, 0xc0, 0x5d, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x3d, 0x20, 0xa1, 0x07, 0x00])
  },

  // Tier 2: Rules Token Budget (20,000 -> 200,000)
  {
    name: 'T1 (User Rules Default)',
    raw: 0x1a1b652,
    expectedOld: Buffer.from([0x41, 0xb9, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x41, 0xb9, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T2 (Workspace Rules Default)',
    raw: 0x1a1b6ad,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T3 (User Rules Clamp Cmp)',
    raw: 0x2060930,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T4 (User Rules Clamp Mov)',
    raw: 0x206093d,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T5 (Workspace Rules Clamp Cmp)',
    raw: 0x2060960,
    expectedOld: Buffer.from([0x48, 0x81, 0xfb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0x48, 0x81, 0xfb, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T6 (Workspace Rules Clamp Mov)',
    raw: 0x206096d,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T7 (Fallback User Rules Default)',
    raw: 0x2c63caa,
    expectedOld: Buffer.from([0xba, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xba, 0x40, 0x0d, 0x03, 0x00])
  },
  {
    name: 'T8 (Fallback Workspace Rules Default)',
    raw: 0x2c63cfa,
    expectedOld: Buffer.from([0xbb, 0x20, 0x4e, 0x00, 0x00]),
    newBytes:    Buffer.from([0xbb, 0x40, 0x0d, 0x03, 0x00])
  }
];

console.log('Verifying all 12 calibrated patch sites in 1.4.4...');
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
  console.log('[SUCCESS] Atomically replaced agy.exe with patched 1.4.4!');
} catch (e) {
  console.error('Rename failed:', e.message);
  process.exit(1);
}

// Secondary verification on new agy.exe
const newBuf = fs.readFileSync(binPath);
console.log('\nVerifying new agy.exe on disk...');
console.log('Size check:', newBuf.length, 'bytes (expected 202906776)');
if (newBuf.length !== 202906776) {
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
