const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const replacements = [
  {
    placeholder: '__SARCA_MAPBOX_TOKEN__',
    value: process.env.SARCA_MAPBOX_TOKEN,
    files: ['passageiro/main.dart.js', 'motorista/main.dart.js', 'passageiro/sarca-enhancements.js'],
  },
  {
    placeholder: '__OPENWEATHER_API_KEY__',
    value: process.env.OPENWEATHER_API_KEY,
    files: ['passageiro/sarca-enhancements.js'],
  },
];

for (const replacement of replacements) {
  if (!replacement.value) {
    continue;
  }
  for (const relativeFile of replacement.files) {
    const file = path.join(root, relativeFile);
    const contents = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, contents.split(replacement.placeholder).join(replacement.value));
  }
}

console.log('SARCA web assets prepared for /passageiro and /motorista.');
