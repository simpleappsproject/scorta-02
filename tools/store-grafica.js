/* Parti comuni per gli screenshot dello store nelle 14 lingue (uguale in tutte le app Simple Apps che lo usano).
   - LINGUE: per ogni lingua oltre it/en la cartella in store/ (stessi codici di store/lingue/), le impostazioni del telefono finto
   - headFonts(): caratteri dei titoli — Big Shoulders (latino, anche turco: da www/fonts), Oswald (russo), Teko (hindi),
     Noto Kufi Arabic (arabo) da tools/fonts; cinese/giapponese/coreano: Noto Sans CJK installato sul computer
   - titleHTML(): titolo grande con il puntino colorato ("|" nel titolo = a capo, per cinese e giapponese)
   - fitTitle(page, righe): rimpicciolisce il titolo finché sta nelle righe e nella larghezza
   - phoneCSS(lang, corpo): dentro il telefono le lettere che i caratteri dell'app non hanno si vedono come su Android
     (Roboto, Noto: pacchetti fonts-roboto, fonts-noto-core, fonts-noto-cjk) */
const fs = require('fs'), path = require('path');

const LINGUE = {
  es: {dir: 'es-ES', locale: 'es-ES', tz: 'Europe/Madrid', posix: 'es_ES'},
  fr: {dir: 'fr-FR', locale: 'fr-FR', tz: 'Europe/Paris', posix: 'fr_FR'},
  de: {dir: 'de-DE', locale: 'de-DE', tz: 'Europe/Berlin', posix: 'de_DE'},
  pt: {dir: 'pt-BR', locale: 'pt-BR', tz: 'America/Sao_Paulo', posix: 'pt_BR'},
  id: {dir: 'id', locale: 'id-ID', tz: 'Asia/Jakarta', posix: 'id_ID'},
  tr: {dir: 'tr-TR', locale: 'tr-TR', tz: 'Europe/Istanbul', posix: 'tr_TR'},
  ru: {dir: 'ru-RU', locale: 'ru-RU', tz: 'Europe/Moscow', posix: 'ru_RU'},
  hi: {dir: 'hi-IN', locale: 'hi-IN', tz: 'Asia/Kolkata', posix: 'hi_IN'},
  zh: {dir: 'zh-CN', locale: 'zh-CN', tz: 'Asia/Shanghai', posix: 'zh_CN'},
  ja: {dir: 'ja-JP', locale: 'ja-JP', tz: 'Asia/Tokyo', posix: 'ja_JP'},
  ko: {dir: 'ko-KR', locale: 'ko-KR', tz: 'Asia/Seoul', posix: 'ko_KR'},
  ar: {dir: 'ar', locale: 'ar-SA', tz: 'Asia/Riyadh', posix: 'ar_SA', rtl: true}
};
const CJK = {zh: 'Noto Sans CJK SC', ja: 'Noto Sans CJK JP', ko: 'Noto Sans CJK KR'};
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
const EXT = 'U+0100-02AF,U+1E00-1EFF,U+20A0-20C0';
const data = f => 'data:font/woff2;base64,' + fs.readFileSync(f).toString('base64');

function headFonts(www) {
  const T = f => data(path.join(__dirname, 'fonts', f)), W = f => data(path.join(www, 'fonts', f));
  return `@font-face{font-family:BS;font-weight:900;src:url(${W('big-shoulders-display-latin-900-normal.woff2')});unicode-range:${LATIN}}
@font-face{font-family:BS;font-weight:900;src:url(${W('big-shoulders-display-latin-ext-900-normal.woff2')});unicode-range:${EXT}}
@font-face{font-family:OSW;font-weight:900;src:url(${T('oswald-cyrillic-700-normal.woff2')});unicode-range:U+0400-04FF}
@font-face{font-family:TEKO;font-weight:900;src:url(${T('teko-devanagari-700-normal.woff2')});unicode-range:U+0900-097F,U+200C-200D,U+25CC,U+A8E0-A8FF}
@font-face{font-family:KUFI;font-weight:900;src:url(${T('noto-kufi-arabic-arabic-900-normal.woff2')});unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}`;
}
/* caratteri, interlinea e dimensione di partenza dei titoli per lingua */
function headStyle(lang) {
  if (CJK[lang]) return {family: `BS,"${CJK[lang]}"`, lh: 1.18, size: 112};
  if (lang === 'hi') return {family: 'BS,TEKO', lh: 1.02, size: 136};
  if (lang === 'ar') return {family: 'BS,KUFI', lh: 1.38, size: 116};
  if (lang === 'ru') return {family: 'BS,OSW', lh: 1.0, size: 112};
  return {family: 'BS', lh: 0.92, size: 128};
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/* stile del titolo (h1#t) e il suo HTML; per it/en resta tutto come prima */
function titleCSS(lang) {
  const h = headStyle(lang), L = LINGUE[lang];
  return `h1{position:absolute;${L && L.rtl ? 'right' : 'left'}:80px;top:110px;width:930px;margin:0;font:900 ${h.size}px/${h.lh} ${h.family},sans-serif;color:#fff;letter-spacing:.005em${L ? ';text-wrap:balance' : ''}${lang === 'ko' ? ';word-break:keep-all' : ''}${lang === 'zh' || lang === 'ja' ? ';white-space:nowrap' : ''}}`;
}
function titleHTML(title, lang) {
  const h = headStyle(lang), L = LINGUE[lang];
  const text = title.split('|').map(x => esc(x.toLocaleUpperCase(L ? L.locale : 'en'))).join('<br>');
  return `<h1 id="t" data-lh="${h.lh}" data-size="${h.size}">${text}<i>${/[　-鿿가-힯]/.test(title) ? '' : '.'}</i></h1>`;
}
const htmlOpen = lang => `<!doctype html><html dir="${LINGUE[lang] && LINGUE[lang].rtl ? 'rtl' : 'ltr'}"><meta charset="utf-8">`;
/* il titolo deve stare in "righe" righe (e nella larghezza): se serve si rimpicciolisce; restituisce una descrizione */
function fitTitle(page, righe) {
  return page.evaluate(n => { const t = document.getElementById('t'), lh = +t.dataset.lh; let s = +t.dataset.size;
    while ((t.offsetHeight > s * lh * n + 4 || t.offsetHeight > 430 || t.scrollWidth > t.clientWidth + 2) && s > 64) { s -= 4; t.style.fontSize = s + 'px'; }
    return Math.round(t.offsetHeight / (s * lh)) + ' righe, ' + s + ' px'; }, righe);
}
function phoneCSS(lang, body) {
  if (!LINGUE[lang]) return '';
  const fb = `Roboto,"${CJK[lang] || 'Noto Sans CJK SC'}","Noto Naskh Arabic","Noto Sans Devanagari",sans-serif`;
  return `body,button,input,select,textarea{font-family:"${body}",${fb}}`;
}
module.exports = {LINGUE, CJK, headStyle, headFonts, titleCSS, titleHTML, htmlOpen, fitTitle, phoneCSS, esc};
