const fs = require('fs');
const swc = require('@swc/core');
const code = fs.readFileSync('frontend/src/pages/Admin/Stock.tsx', 'utf8');
try {
  const res = swc.parseSync(code, {
    syntax: 'typescript',
    tsx: true,
    comments: false,
  });
  console.log('parsed ok');
} catch (err) {
  console.error(err);
  process.exit(1);
}
