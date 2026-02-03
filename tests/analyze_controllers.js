const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readFile(p){ try { return fs.readFileSync(path.join(root,p), 'utf8'); } catch(e){ return ''; } }

// 1) Extract constant string values from js/constants.js
const constTxt = readFile('js/constants.js');
const constValues = new Set();
let m;
// Match quoted message types like 'SISTEMA.PADRE_DATOS' but avoid numeric-only literals like versions
const reQuotedType = /['"]([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)['"]/g;
while ((m = reQuotedType.exec(constTxt)) !== null){ constValues.add(m[1]); }

// 2) Find registrations: registrarControladorSeguro(TIPOS_MENSAJE.SOMETHING
const allFiles = (function walk(dir){
    const abs = path.join(root, dir);
    let res = [];
    const items = fs.readdirSync(abs);
    for (const it of items){
        const p = path.join(abs,it);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) res = res.concat(walk(path.join(dir,it)));
        else res.push(path.join(dir,it));
    }
    return res;
})('');

const regTypes = [];
const usedTipos = new Set();
const literalTypesUsed = new Set();
const perFileRegs = {};

const regRe = /registrarControladorSeguro\s*\(\s*(?:TIPOS_MENSAJE\.|TIPOS_MENSAJE_S1\.|TIPOS_MENSAJE_S2\.)?([A-Z0-9_.]+)\s*,/g;
const tiposUsoRe = /TIPOS_MENSAJE(?:_S1|_S2)?\.[A-Z0-9_.]+/g;
// Only capture quoted tokens that look like TYPE.SEGMENT (first segment must start with a letter)
const literalRe = /['"]([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)['"]/g;
// Detect direct registrarControlador usages (not the 'Seguro' wrapper)
const directRegRe = /(?:[^A-Za-z0-9_]|^)registrarControlador\s*\(\s*(?:TIPOS_MENSAJE(?:_S1|_S2)?\.)?([A-Z0-9_.]+)/g;

for (const f of allFiles){
    if (!f.endsWith('.js') && !f.endsWith('.html') && !f.endsWith('.ts')) continue;
    const txt = readFile(f);
    if (!txt) continue;
    let mm;
    const fileRegs = [];
    while ((mm = regRe.exec(txt)) !== null){
        regTypes.push(mm[1]);
        fileRegs.push(mm[1]);
    }
    if (fileRegs.length) perFileRegs[f] = fileRegs;
    // detect direct registrarControlador(...) registrations
    let mm2;
    const directList = [];
    while ((mm2 = directRegRe.exec(txt)) !== null){
        directList.push(mm2[1]);
    }
    if (directList.length) perFileRegs[f] = (perFileRegs[f]||[]).concat(directList.map(d=>`(DIRECT) ${d}`));
    const usos = txt.match(tiposUsoRe);
    if (usos) usos.forEach(u=>usedTipos.add(u.replace(/^TIPOS_MENSAJE(?:_S1|_S2)?\./,'')));
    while ((mm = literalRe.exec(txt)) !== null){
        literalTypesUsed.add(mm[1]);
    }
}

// Normalize: registered names may be like SISTEMA.PADRE_DATOS or NAVEGACION.GPS.ERROR
const registeredSet = new Map();
for (const r of regTypes){
    registeredSet.set(r, (registeredSet.get(r)||0)+1);
}

// Build report
const duplicated = [...registeredSet.entries()].filter(([k,v])=>v>1).map(([k,v])=>({tipo:k,count:v}));

// Registered but not in constants values
const registeredNotDefined = [...registeredSet.keys()].filter(k=>!constValues.has(k));
// Defined but apparently not referenced (neither in usedTipos nor as registration)
// Check which constants are not referenced anywhere. Use full-type normalization consistently.
const definedNotReferenced = [...constValues].filter(k => {
    // k is like 'SISTEMA.PADRE_DATOS'
    return !usedTipos.has(k) && !registeredSet.has(k) && !literalTypesUsed.has(k);
});

// Also find literals used that are not defined in constants
const literalsNotDefined = [...literalTypesUsed].filter(l=>!constValues.has(l));

const report = {
    totalConstants: constValues.size,
    totalRegistered: registeredSet.size,
    duplicates: duplicated,
    registeredNotDefined,
    literalsNotDefined,
    definedNotReferenced: definedNotReferenced.slice(0,200),
    perFileDuplicates: {},
    directRegistrations: {}
};

// compute per-file duplicates
for (const [file, arr] of Object.entries(perFileRegs)){
    const map = new Map();
    for (const a of arr) map.set(a,(map.get(a)||0)+1);
    const dups = [...map.entries()].filter(([k,v])=>v>1).map(([k,v])=>({tipo:k,count:v}));
    if (dups.length) report.perFileDuplicates[file] = dups;
}

// Populate directRegistrations: any entry in perFileRegs marked with (DIRECT)
for (const [file, arr] of Object.entries(perFileRegs)){
    const direct = arr.filter(a=>typeof a === 'string' && a.startsWith('(DIRECT) ')).map(a=>a.replace(/^\(DIRECT\)\s*/,''));
    if (direct.length) report.directRegistrations[file] = direct;
}

console.log(JSON.stringify(report,null,2));

// Save report
fs.writeFileSync(path.join(root,'tests','analyze_controllers_report.json'), JSON.stringify(report,null,2),'utf8');
console.log('Report written to tests/analyze_controllers_report.json');
