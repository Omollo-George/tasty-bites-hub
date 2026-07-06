const fs = require('fs');
function check(path){
  const s = fs.readFileSync(path,'utf8');
  let braces=0, parens=0, angles=0;
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(ch==='{' ) braces++;
    if(ch==='}') braces--;
    if(ch==='(' ) parens++;
    if(ch===')') parens--;
    // very rough JSX tag count: count '<' before identifier vs '</'
    if(ch==='<' && /<[A-Za-z]/.test(s.slice(i,i+2))) angles++;
    if(ch==='<' && s.slice(i,i+2)==='</') angles--;
  }
  console.log(path, 'braces=', braces, 'parens=', parens, 'angles=', angles);
}
check('frontend/src/pages/Admin/Stock.tsx');
check('frontend/src/pages/Admin/Reports.tsx');
