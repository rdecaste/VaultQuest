// Builds the Make code-module sources: core.js + each module, with secrets
// substituted from the environment (never committed).
const fs = require('fs');
const path = require('path');
const core = fs.readFileSync(path.join(__dirname, 'src/core.js'), 'utf8');
const subs = {
  __PASSCODE__: process.env.VAULT_PASSCODE || '__PASSCODE__',
  __ACTION_URL__: process.env.VAULT_ACTION_URL || 'https://hook.eu2.make.com/3fqg0aje41n3zr4cmhm22ldoazltpr3p'
};
// Make shows the code in a small editor: drop full-line comments and blank
// lines (the commented source lives in make/src).
const strip = s => s.split('\n').filter(l => !/^\s*\/\//.test(l) && l.trim()).join('\n');
const out = {};
for (const name of ['action', 'monday', 'publish']) {
  let src = fs.readFileSync(path.join(__dirname, 'src', name + '.js'), 'utf8');
  for (const [k, v] of Object.entries(subs)) src = src.split(k).join(v);
  out[name] = strip(core + '\n' + src);
}
module.exports = out;
if (require.main === module) {
  fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(__dirname, 'build', k + '.js'), v);
  console.log('built', Object.keys(out).join(', '));
}
