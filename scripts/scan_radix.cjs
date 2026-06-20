const fs = require('fs');
const path = require('path');
const root = process.cwd();
const srcDir = path.join(root, 'src');
function walk(dir){
  const files = [];
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir,name);
    if(fs.statSync(p).isDirectory()) files.push(...walk(p));
    else if(/\.tsx?$/.test(p)) files.push(p);
  }
  return files;
}
const re = /from\s+['\"](@radix-ui\/react-[^'\"]+)['\"]/g;
const used = new Set();
if(fs.existsSync(srcDir)){
  for(const f of walk(srcDir)){
    const t = fs.readFileSync(f,'utf8');
    let m;
    while((m = re.exec(t))){ used.add(m[1]); }
  }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
const installed = Object.keys(deps).filter(k=>k.startsWith('@radix-ui/'));
const toUninstall = installed.filter(x=>!used.has(x));
console.log(JSON.stringify({used: [...used].sort(), installed: installed.sort(), toUninstall: toUninstall.sort()}));
