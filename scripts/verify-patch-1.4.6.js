/**
 * verify-patch-1.4.6.js
 * 
 * 对当前磁盘上的 C:\Users\alord\AppData\Local\agy\bin\agy.exe (v1.4.6)
 * 执行 12 处修改点的 100% 逐字节严格校验。
 */

const fs = require('fs');

const binPath = 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe';
if (!fs.existsSync(binPath)) {
  console.error(`Binary not found: ${binPath}`);
  process.exit(1);
}

const b = fs.readFileSync(binPath);
const EXPECTED_FILE_SIZE = 204022936;

console.log('=== Antigravity 1.4.6 Patch Verification (All 12 Sites) ===\n');
console.log('File size check:', b.length, 'bytes', b.length === EXPECTED_FILE_SIZE ? '[PASS]' : '[FAIL]');

const sites = [
  { id: 'B1', name: 'Rule Crop 1 (mov ecx, 500000)', raw: 0x19ba6a9, expected: 'b920a10700' },
  { id: 'B2', name: 'Rule Crop 2 (mov ecx, 500000)', raw: 0x19bb625, expected: 'b920a10700' },
  { id: 'B3', name: 'Rule Crop 3 (mov ecx, 500000)', raw: 0x19c0207, expected: 'b920a10700' },
  { id: 'B4', name: 'Body Byte Clamp (cmp rax, 500000)', raw: 0x3096a80, expected: '483d20a10700' },
  { id: 'T1', name: 'User Rules Default (mov r9d, 200000)', raw: 0x19c1a52, expected: '41b9400d0300' },
  { id: 'T2', name: 'Workspace Rules Default (mov edx, 200000)', raw: 0x19c1aad, expected: 'ba400d0300' },
  { id: 'T3', name: 'User Rules Clamp Cmp (cmp rbx, 200000)', raw: 0x2031cf0, expected: '4881fb400d0300' },
  { id: 'T4', name: 'User Rules Clamp Mov (mov edx, 200000)', raw: 0x2031cfd, expected: 'ba400d0300' },
  { id: 'T5', name: 'Workspace Rules Clamp Cmp (cmp rbx, 200000)', raw: 0x2031d20, expected: '4881fb400d0300' },
  { id: 'T6', name: 'Workspace Rules Clamp Mov (mov edx, 200000)', raw: 0x2031d2d, expected: 'ba400d0300' },
  { id: 'T7', name: 'Fallback User Default (mov edx, 200000)', raw: 0x2c606ea, expected: 'ba400d0300' },
  { id: 'T8', name: 'Fallback Workspace Default (mov ebx, 200000)', raw: 0x2c6073a, expected: 'bb400d0300' }
];

let allPassed = (b.length === EXPECTED_FILE_SIZE);
for (const s of sites) {
  const actual = b.subarray(s.raw, s.raw + Buffer.from(s.expected, 'hex').length).toString('hex');
  const pass = actual === s.expected;
  if (!pass) allPassed = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${s.id.padEnd(2)} | Offset: 0x${s.raw.toString(16).padEnd(7)} | Expected: ${s.expected} | Actual: ${actual} | ${s.name}`);
}

console.log('\nFinal Verdict:', allPassed ? 'ALL 12 SITES VERIFIED 100% PASS' : 'SOME SITES FAILED');
if (!allPassed) process.exit(1);
