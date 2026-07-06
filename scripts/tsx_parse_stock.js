const fs = require('fs');
const ts = require('typescript');
const path = 'frontend/src/pages/Admin/Stock.tsx';
const src = fs.readFileSync(path, 'utf8');
const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diags = sf.parseDiagnostics;
if (diags.length === 0) {
  console.log('no parse diagnostics');
  process.exit(0);
}
for (const d of diags) {
  const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  console.log(`${line+1}:${character+1} ${msg}`);
}
process.exit(1);
