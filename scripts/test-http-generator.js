const fs = require('fs');
const path = require('path');

const filePath = path.resolve('..','felizviajeapi','src','reportes-generales','controllers','global-report.controller.ts');
const controllerCode = fs.readFileSync(filePath,'utf8');

const endpointRegex = /@(Get|Post|Patch|Put|Delete|Options|Head)\(\s*(['"`])?([^'"\)]*)\2?\s*\)\s*(?:@ApiOperation\(\s*{[^}]*summary:\s*["']([^"']+)["'][^}]*}\)\s*)?[\s\S]*?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)/gi;

const matches = Array.from(controllerCode.matchAll(endpointRegex));
console.log('Matches found:', matches.length);
for(const m of matches){
  const method = m[1];
  const pathSeg = m[3];
  const summary = m[4];
  const fn = m[5];
  const params = m[6];
  console.log({method, pathSeg, summary, fn, params});
}
