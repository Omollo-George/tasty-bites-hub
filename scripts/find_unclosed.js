const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../frontend/src/pages/Admin/Stock.tsx');
const s = fs.readFileSync(file,'utf8');
let inS=false,inD=false,inB=false,esc=false;
for(let i=0;i<s.length;i++){
  const ch=s[i];
  if(!esc){
    if(ch==="'"){
      if(!inD && !inB) inS=!inS;
    } else if(ch==='"'){
      if(!inS && !inB) inD=!inD;
    } else if(ch==='`'){
      if(!inS && !inD) inB=!inB;
    }
  }
  esc = !esc && ch==='\\';
  if((i+1)%200==0){
    console.log('pos',i,'inS',inS,'inD',inD,'inB',inB);
  }
}
console.log('END inS',inS,'inD',inD,'inB',inB);
