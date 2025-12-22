const fs = require('fs');
const path = require('path');

const dtoPath = path.resolve('..','felizviajeapi','src','reportes-generales','dto','financil-filter.dto.ts');
const dto = fs.readFileSync(dtoPath,'utf8');

function getDefaultValue(typeName, propertyName) {
  const type = String(typeName || '').toLowerCase();
  if (propertyName) {
    const propLower = propertyName.toLowerCase();
    if (propLower.includes('email')) return 'user@example.com';
    if (propLower.includes('name')) return 'Example Name';
    if (propLower.includes('id') && !propLower.includes('uuid')) return 1;
    if (propLower.includes('uuid') || propLower.includes('guid')) return '123e4567-e89b-12d3-a456-426614174000';
    if (propLower.includes('phone') || propLower.includes('telefono')) return '+1234567890';
    if (propLower.includes('url') || propLower.includes('link')) return 'https://example.com';
    if (propLower.includes('description') || propLower.includes('descripcion')) return 'Example description';
  }
  if (type.includes('email')) return 'user@example.com';
  if (type.includes('string')) return 'example string';
  if (type.includes('number')) return 123;
  if (type.includes('boolean')) return true;
  if (type.includes('date')) return '2025-12-08T00:00:00Z';
  if (type.includes('array')|| type.includes('[]')) return [];
  if (type.includes('object')) return {};
  return null;
}

function parseDtoProperties(dtoContent) {
  const body = {};
  // Captura todos los decoradores y la declaración de la propiedad
  const propertyBlockRegex = /((?:@\w+(?:\([\s\S]*?\))?\s*)*)\s*(?:public|private|protected)?\s*(\w+)\??\s*:\s*([^;]+)\s*;/g;
  let match;
  while ((match = propertyBlockRegex.exec(dtoContent)) !== null) {
    console.log('MATCH:', match.slice(1,6));
    const [fullMatch, decoratorsBlock, propertyName, propertyTypeRaw] = match;
    const propertyType = propertyTypeRaw.trim();
    let value = null;

    const apiPropertyMatch = /@ApiProperty(?:Optional)?\([\s\S]*?}\s*\)/s.exec(decoratorsBlock || "");
    const apiPropertyDecorator = apiPropertyMatch ? apiPropertyMatch[0] : null;
    if (apiPropertyDecorator) {
      const exampleMatch = apiPropertyDecorator.match(/example:\s*([^,}\n]+)/);
      console.log('API PROP DECORATOR for', propertyName, '=>', !!apiPropertyDecorator, 'raw:', JSON.stringify(apiPropertyDecorator).slice(0,200), 'indexOf example:', apiPropertyDecorator.indexOf('example:'), 'exampleMatch:', exampleMatch && exampleMatch[1]);
      if (exampleMatch) {
        let exampleValue = exampleMatch[1].trim();
        exampleValue = exampleValue.replace(/[\s,]*$/g,"");
        if ((exampleValue.startsWith('"') && exampleValue.endsWith('"')) || (exampleValue.startsWith("'") && exampleValue.endsWith("'"))) {
          value = exampleValue.slice(1,-1);
        } else if (exampleValue === 'true' || exampleValue === 'false') {
          value = exampleValue === 'true';
        } else if (!isNaN(Number(exampleValue))) {
          value = Number(exampleValue);
        } else {
          value = exampleValue;
        }
      }
    }
    if (value === null) {
      const decorators = decoratorsBlock || '';
      let inferredType = propertyType;
      if (/\bIsBoolean\b/.test(decorators)) inferredType = 'boolean';
      else if (/\bIsDateString\b|\bIsDate\b/.test(decorators)) inferredType = 'date';
      else if (/\bIsEmail\b/.test(decorators)) inferredType = 'email';
      else if (/\bIsArray\b/.test(decorators)) inferredType = 'array';
      else if (/\bIsInt\b|\bIsNumber\b|\bIsNumberString\b/.test(decorators)) inferredType = 'number';
      else if (/@Type\s*\(\s*\(\s*\)\s*=>\s*Number\s*\)/.test(decorators)) inferredType = 'number';
      if (/\[\]$/.test(propertyType) || /Array<|\barray\b/i.test(propertyType) || inferredType === 'array') {
        value = [];
      } else {
        value = getDefaultValue(inferredType, propertyName);
      }
    }
    body[propertyName] = value;
  }
  return body;
}

console.log(parseDtoProperties(dto));
