const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.resolve(__dirname, '..', 'codigo-padre.html');
const raw = fs.readFileSync(file, 'utf8');

const scriptRegex = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 0;
const errors = [];

while ((match = scriptRegex.exec(raw)) !== null) {
  scriptIndex++;
  const attrs = match[0].match(/<script([^>]*)>/i)?.[1] || '';
  const isModule = attrs.includes('type="module"');
  const code = match[1];
  
  // Skip validation for modules as they support top-level await and imports
  if (isModule) {
    continue;
  }
  
  // compute line offset
  const before = raw.slice(0, match.index);
  const lineOffset = (before.match(/\n/g) || []).length + 1;
  try {
    new vm.Script(code, { filename: `codigo-padre.html (script #${scriptIndex})` });
  } catch (e) {
    // Enhance error location with line offset
    const msg = String(e.message || e);
    const m = msg.match(/<anonymous>:(\d+):(\d+)/) || msg.match(/^(.*):(\d+):(\d+)/);
    let errLine = null;
    if (m) {
      errLine = parseInt(m[2], 10) + lineOffset - 1;
    }
    errors.push({ scriptIndex, error: msg, line: errLine });
  }
}

if (errors.length === 0) {
  console.log('OK: No syntax errors found in <script> blocks');
  process.exit(0);
} else {
  console.log(`Found ${errors.length} syntax error(s) in ${scriptIndex} <script> blocks:`);
  for (const e of errors) {
    console.log(`- Script #${e.scriptIndex}: ${e.error}${e.line ? ` (approx line ${e.line})` : ''}`);
  }
  process.exit(2);
}
