/* Immagine in evidenza dello store (1024×500) nelle altre 12 lingue: node tools/feature-graphic.js [lingue…]
   Stesso disegno di store/feature-graphic-it.png / -en.png (fatte a mano): fondo del colore dell'app, icona, nome
   "SIMPLE <APP>." e sotto la descrizione breve dello store di quella lingua (presa da store/lingue/<codice>.txt).
   Salva store/feature-graphic-<codice>.png (codici come in store/lingue/). Italiano e inglese non vengono toccati.
   Il colore di fondo è letto da feature-graphic-en.png; il nome dell'app dal titolo di index.html. */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');
const G = require('./store-grafica.js');
const ROOT = path.join(__dirname, '..'), WWW = path.join(ROOT, 'www'), STORE = path.join(ROOT, 'store');
const data = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(WWW, 'fonts', f)).toString('base64');
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
const EXT = 'U+0100-02AF,U+1E00-1EFF,U+20A0-20C0';

/* descrizione breve: la riga dopo "DESCRIZIONE BREVE" nel file della lingua */
function shortDesc(code) {
  const lines = fs.readFileSync(path.join(STORE, 'lingue', code + '.txt'), 'utf8').split('\n');
  const i = lines.findIndex(l => /^DESCRIZIONE BREVE/.test(l));
  return lines[i + 1].trim();
}
const appName = () => (fs.readFileSync(path.join(WWW, 'index.html'), 'utf8').match(/<title>\s*Simple ([^<:–-]+)/i) || [, 'App'])[1].trim();

/* misure prese dalle immagini it/en fatte a mano: dimensione del nome e dell'icona per app */
const SIZE = {Deadlines: {t: 97, ic: 410}, Score: {t: 104, ic: 410}, Fuel: {t: 104, ic: 415}, Shifts: {t: 116, ic: 350}};
function html(lang, bg) {
  const Z = SIZE[appName()] || {t: 104, ic: 410};
  const L = G.LINGUE[lang], cjk = G.CJK[lang], text = shortDesc(L.dir);
  const icon = fs.readFileSync(path.join(ROOT, 'assets', 'icon-foreground.png')).toString('base64');
  const pf = `BAR,${cjk ? '"' + cjk + '",' : ''}Roboto,"Noto Naskh Arabic","Noto Sans Devanagari",sans-serif`;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BS;font-weight:900;src:url(${data('big-shoulders-display-latin-900-normal.woff2')});unicode-range:${LATIN}}
@font-face{font-family:BAR;font-weight:600;src:url(${data('barlow-latin-600-normal.woff2')});unicode-range:${LATIN}}
@font-face{font-family:BAR;font-weight:600;src:url(${data('barlow-latin-ext-600-normal.woff2')});unicode-range:${EXT}}
html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:${bg}}
img{position:absolute;left:${230 - Z.ic / 2}px;top:${250 - Z.ic / 2}px;width:${Z.ic}px;height:${Z.ic}px}
.box{position:absolute;left:440px;top:0;width:520px;height:500px;display:flex;flex-direction:column;justify-content:center}
h1{margin:0;font:900 ${Z.t}px/.86 BS,sans-serif;color:#fff}
h1 i{font-style:normal;color:#F2B544}
p{margin:20px 0 0;font:600 29px/1.35 ${pf};color:rgba(255,255,255,.9)${lang === 'ko' ? ';word-break:keep-all' : ''}}
</style><img src="data:image/png;base64,${icon}"><div class="box"><h1>SIMPLE<br>${G.esc(appName().toUpperCase())}<i>.</i></h1><p id="p" dir="${L.rtl ? 'rtl' : 'auto'}">${G.esc(text)}</p></div>`;
}

(async () => {
  const want = process.argv.slice(2), langs = Object.keys(G.LINGUE).filter(l => !want.length || want.includes(l));
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1024, height: 500}});
  /* colore di fondo dall'immagine inglese (pixel in alto a sinistra) */
  await page.setContent(`<canvas id="c" width="1" height="1"></canvas>`);
  const bg = await page.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.getElementById('c').getContext('2d'); c.drawImage(i, -5, -5);
    const d = c.getImageData(0, 0, 1, 1).data; return '#' + [d[0], d[1], d[2]].map(x => x.toString(16).padStart(2, '0')).join(''); },
    'data:image/png;base64,' + fs.readFileSync(path.join(STORE, 'feature-graphic-en.png')).toString('base64'));
  for (const lang of langs) {
    await page.setContent(html(lang, bg)); await page.evaluate(() => document.fonts.ready);
    // la descrizione deve stare in 3 righe al massimo
    await page.evaluate(() => { const p = document.getElementById('p'); let s = 29; while (p.offsetHeight > s * 1.35 * 3 + 2 && s > 18) { s -= 1; p.style.fontSize = s + 'px'; } });
    const out = path.join(STORE, `feature-graphic-${G.LINGUE[lang].dir}.png`);
    await page.screenshot({path: out}); console.log('✓', path.relative(ROOT, out));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
