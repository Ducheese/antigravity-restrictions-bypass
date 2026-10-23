/**
 * scan-patch-sites.js
 * 
 * 通用动态特征扫描工具：在 agy.exe 的 .text 代码段中扫描 24,000 (0x5DC0) 与 20,000 (0x4E20)
 * 的 12 处修改点特征机器码，用于新版本发布后的快速标定。
 * 
 * 用法：
 *   node scripts/scan-patch-sites.js [exePath]
 */

const fs = require('fs');
const path = require('path');

const targetPath = process.argv[2] || 'C:\\Users\\alord\\AppData\\Local\\agy\\bin\\agy.exe.1.4.6.orig';

if (!fs.existsSync(targetPath)) {
  console.error(`Target file not found: ${targetPath}`);
  process.exit(1);
}

console.log(`Scanning target binary: ${targetPath}`);
const buf = fs.readFileSync(targetPath);
console.log(`Total file size: ${buf.length} bytes`);

// 扫描 .text 代码段范围（通常为 0x600 开始，跨度约 50MB~70MB）
const textRawStart = 0x600;
const textRawEnd = Math.min(buf.length, textRawStart + 0x4000000);

const b_24k = Buffer.from([0xc0, 0x5d, 0x00, 0x00]); // 24,000
const b_20k = Buffer.from([0x20, 0x4e, 0x00, 0x00]); // 20,000

console.log('\n========================================');
console.log('Tier 1: 24,000 (0x5DC0) Byte Limit Hits');
console.log('========================================');
let idx = textRawStart;
let count24k = 0;
while (true) {
  idx = buf.indexOf(b_24k, idx);
  if (idx === -1 || idx >= textRawEnd) break;
  const pre = buf.subarray(idx - 6, idx).toString('hex');
  const post = buf.subarray(idx + 4, idx + 10).toString('hex');
  
  // 识别典型特征
  let desc = 'Unknown';
  if (pre.endsWith('b9')) desc = 'mov ecx, 24000 (Rule Crop Entry)';
  else if (pre.endsWith('483d')) desc = 'cmp rax, 24000 (Body Clamp)';
  
  console.log(`[0x${idx.toString(16).padStart(7, '0')}] pre: ${pre} | 24000 | post: ${post}  <-- ${desc}`);
  count24k++;
  idx += 1;
}
console.log(`Total 24,000 matches: ${count24k}`);

console.log('\n========================================');
console.log('Tier 2: 20,000 (0x4E20) Token Budget Hits');
console.log('========================================');
idx = textRawStart;
let count20k = 0;
while (true) {
  idx = buf.indexOf(b_20k, idx);
  if (idx === -1 || idx >= textRawEnd) break;
  const pre = buf.subarray(idx - 6, idx).toString('hex');
  const post = buf.subarray(idx + 4, idx + 10).toString('hex');
  
  let desc = 'Unknown';
  if (pre.endsWith('41b9')) desc = 'mov r9d, 20000 (User Rules Default)';
  else if (pre.endsWith('ba')) desc = 'mov edx, 20000 (Rules Mov)';
  else if (pre.endsWith('bb')) desc = 'mov ebx, 20000 (Rules Mov)';
  else if (pre.endsWith('4881fb')) desc = 'cmp rbx, 20000 (Rules Clamp Cmp)';

  console.log(`[0x${idx.toString(16).padStart(7, '0')}] pre: ${pre} | 20000 | post: ${post}  <-- ${desc}`);
  count20k++;
  idx += 1;
}
console.log(`Total 20,000 matches: ${count20k}`);
