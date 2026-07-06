const fs = require('fs');
const path = require('path'); const s = fs.readFileSync(path.resolve(__dirname, '../frontend/src/pages/Admin/Stock.tsx'),'utf8');
const counts = { backtick: 0, sq: 0, dq: 0, slash: 0 };
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === '`') counts.backtick++;
  if (ch === "'") counts.sq++;
  if (ch === '"') counts.dq++;
  if (ch === '/') counts.slash++;
}
console.log(counts);
