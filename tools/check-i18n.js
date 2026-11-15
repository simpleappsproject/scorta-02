/* Controllo delle traduzioni: node tools/check-i18n.js  (oppure: npm run check)
   - ogni lingua deve avere tutte le chiavi dell'italiano, e nessuna in più;
   - i segnaposto {n}, {name}… devono essere gli stessi dell'italiano;
   - per le frasi con i plurali (chiave.one, .few…) ogni lingua deve avere le forme che usa davvero per i numeri da 0 a 1000;
   - se la forma "one" vale anche per altri numeri (francese: 0 e 1; russo: 21, 31…) deve contenere {n} e non un "1" scritto a mano.
   Esce con errore se trova problemi. */
const fs = require('fs'), path = require('path');
const window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'i18n.js'), 'utf8'));
const I = window.I18N, base = I.it;
const CATS = /\.(zero|one|two|few|many)$/;
const keys = Object.keys(base).filter(k => k !== '_' && !(CATS.test(k) && base[k.replace(CATS, '')] !== undefined));
const plural = Object.keys(base).filter(k => k !== '_' && !keys.includes(k)).map(k => k.replace(CATS, '')).filter((k, i, a) => a.indexOf(k) === i);
const vars = s => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');
let bad = 0;
for (const [l, d] of Object.entries(I)) {
  const errs = [];
  if (!d._ || !d._.name || !d._.locale) errs.push('manca _: {name, locale, dir}');
  const pr = new Intl.PluralRules(d._.locale), used = {};
  for (let n = 0; n <= 1000; n++) (used[pr.select(n)] = used[pr.select(n)] || []).push(n);
  keys.forEach(k => { if (!(k in d)) errs.push('manca ' + k); else if (vars(d[k]) !== vars(base[k])) errs.push('segnaposto diversi in ' + k); });
  Object.keys(d).forEach(k => { if (k !== '_' && !keys.includes(k) && !(CATS.test(k) && plural.includes(k.replace(CATS, '')))) errs.push('chiave in più ' + k); });
  plural.forEach(b => {
    Object.keys(used).forEach(c => {
      if (c === 'other') return;
      const k = b + '.' + c, nums = used[c];
      const needed = !(nums.length === 1 && nums[0] === 0) && (c !== 'one' || nums.some(n => n !== 1) || l === 'it' || l === 'en');
      if (!(k in d)) { if (needed && !['zh', 'ja', 'ko', 'id', 'tr', 'hi'].includes(l)) errs.push('manca il plurale ' + k + ' (numeri ' + nums.slice(0, 4).join(',') + '…)'); return; }
      if (nums.some(n => n !== 1) && !d[k].includes('{n}') && !(c === 'zero' || c === 'two')) errs.push(k + ' scrive il numero a mano ma vale anche per ' + nums.filter(n => n !== 1).slice(0, 3).join(','));
    });
  });
  if (errs.length) bad++;
  console.log((errs.length ? '✗ ' : '✓ ') + l.padEnd(4) + d._.name + "  " + (errs.length ? errs.join('\n      ') : Object.keys(d).length - 1 + ' testi'));
}
process.exit(bad ? 1 : 0);
