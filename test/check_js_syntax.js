const fs = require('fs');
const path = 'retos-hijo4.html';
let s = fs.readFileSync(path,'utf8');
let start = s.indexOf('<script type="module">');
let end = s.indexOf('</script>', start);
if (start===-1 || end===-1) { console.log('SCRIPT_BLOCK_NOT_FOUND'); process.exit(1); }
let block = s.slice(start,end);
let stack = [];
const pairs = {'(':')','{':'}','[':']'};
const openers = new Set(Object.keys(pairs));
const closers = new Set(Object.values(pairs));
let line=1; let col=0; let errors=[];
for (let i=0;i<block.length;i++){
  const ch = block[i];
  if (ch==='\n'){ line++; col=0; continue; }
  col++;
  if (openers.has(ch)) stack.push({ch,line,col,i});
  if (closers.has(ch)){
    if (stack.length===0) errors.push({line,col,ch,msg:'UNEXPECTED_CLOSER'});
    else{
      const last = stack.pop();
      if (pairs[last.ch] !== ch) errors.push({line,col,ch,msg:`EXPECTED ${pairs[last.ch]} AFTER ${last.ch} AT ${last.line}:${last.col}`});
    }
  }
}
if (stack.length) stack.forEach(it=>errors.push({line:it.line,col:it.col,ch:it.ch,msg:'UNMATCHED_OPENER'}));
if (errors.length){ console.log('SYNTAX_ERRORS'); console.log(errors.slice(0,20)); process.exit(2);} else { console.log('BRACES_OK'); process.exit(0); }
