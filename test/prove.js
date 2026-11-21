/* Prove automatiche di Simple Score (20/11/2026): regole dei giochi, fine partita, mazziere, backup, CSV e un flusso dall'interfaccia.
   Avvio: node test/prove.js   (serve Playwright; avvia da solo un piccolo server su www/).
   I casi delle regole sono calcolati a mano dalle regole scritte in claude/idea-score.md (fonti lì). */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, {recursive: true});
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
});
let fails = 0, count = 0;
const eq = (name, got, want) => { count++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'OK     ' : 'ERRORE ') + name + (ok ? '' : `  → ottenuto ${JSON.stringify(got)}, atteso ${JSON.stringify(want)}`)); };
const P = n => Array.from({length: n}, (x, i) => ({name: 'G' + (i + 1), color: '#17804f'}));
const G = (type, n, hands, extra) => Object.assign({id: 'g', type, players: P(n), hands: hands.map(v => Array.isArray(v) ? {v} : v), target: 0, opts: {}, firstDealer: 0}, extra || {});

(async () => {
  await new Promise(r => srv.listen(0, r));
  const URL0 = `http://localhost:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, locale: 'it-IT', acceptDownloads: true});
  await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1); localStorage.clear(); localStorage.setItem('sc.settings', JSON.stringify({lang: 'it'})); });
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(URL0); await p.waitForFunction(() => window.__score);
  const S = (fn, ...a) => p.evaluate(([fn, a]) => { const r = window.__score[fn](...a); return r === undefined ? null : JSON.parse(JSON.stringify(r)); }, [fn, a]);

  console.log('\nScopa');
  eq('carte, denari, settebello, primiera e scope', await S('handValues', G('scopa', 2, []), {carte: 0, denari: 1, sette: 0, primiera: 0, scope: [2, 1]}), [5, 2]);
  eq('carte pari (nessuno) e primiera pari', await S('handValues', G('scopa', 2, []), {carte: -1, denari: 0, sette: 1, primiera: -1, scope: [0, 0]}), [1, 1]);
  eq('a 11 vince chi ha di più', await S('winners', G('scopa', 2, [[6, 3], [5, 4]], {target: 11})), [0]);
  eq('a pari punti sopra 11 si continua', await S('winners', G('scopa', 2, [[6, 5], [6, 7]], {target: 11})), null);

  console.log('\nBurraco');
  eq('puliti 200, sporchi 100, tavola, mano, chiusura +100, pozzetto non preso −100',
    await S('handValues', G('burraco', 2, []), {cl: [1, 0], sp: [2, 1], tav: [150, 80], man: [0, 35], chiusura: 0, pozz: [true, false]}), [650, 45]);
  eq('fine a 2005', await S('winners', G('burraco', 2, [[1200, 300], [900, 500]], {target: 2005})), [0]);

  console.log('\nBriscola');
  eq('si scrive una squadra, l\'altra = 120 − i suoi', await S('handValues', G('briscola', 2, []), {v: [70, ''], auto: 1}), [70, 50]);
  eq('in 3: il campo calcolato è quello scelto', await S('handValues', G('briscola', 3, []), {v: [40, '', 30], auto: 1}), [40, 50, 30]);
  eq('60 a 60 = pari', await S('briWinner', [60, 60]), -1);
  eq('61 a 59 vince il primo', await S('briWinner', [61, 59]), 0);
  const bri = G('briscola', 2, [[70, 50], [60, 60], [40, 80]], {target: 2});
  const bst = await S('standings', bri);
  eq('mani vinte e punti delle carte', [bst.tot, bst.pts], [[1, 1], [170, 190]]);
  eq('al meglio di 3: 1 a 1 non è finita', await S('winners', bri), null);
  eq('al meglio di 3: 2 a 1 finita', await S('winners', G('briscola', 2, [[70, 50], [60, 60], [40, 80], [61, 59]], {target: 2})), [0]);

  console.log('\nScala 40 (a 101)');
  const s40 = G('scala40', 3, [[50, 10, 0], [60, 20, 5]], {target: 101});
  const st40 = await S('standings', s40);
  eq('chi supera 101 è fuori, dalla mano in cui è uscito', [st40.tot, st40.out, st40.outAt], [[110, 30, 5], [true, false, false], [1, -1, -1]]);
  eq('ancora in 2: non è finita', await S('winners', s40), null);
  eq('resta uno solo: ha vinto', await S('winners', G('scala40', 3, [[50, 10, 0], [60, 20, 5], [0, 90, 0]], {target: 101})), [2]);
  eq('tutti fuori nella stessa mano: vince chi ha meno tra gli ultimi', await S('winners', G('scala40', 2, [[60, 70], [50, 45]], {target: 101})), [0]);
  eq('tutti fuori nella stessa mano a pari punti: vincono entrambi', await S('winners', G('scala40', 2, [[60, 70], [50, 40]], {target: 101})), [0, 1]);
  const re = await S('standings', G('scala40', 3, [[50, 10, 0], [60, 20, 5]], {target: 101, opts: {reentry: true}}));
  eq('rientro: una volta, con il punteggio più alto tra chi è in gioco', [re.tot, re.out, re.re], [[30, 30, 5], [false, false, false], [1, 0, 0]]);
  const hv = await p.evaluate(() => { const g = {id: 'g', type: 'scala40', players: [{name: 'A'}, {name: 'B'}, {name: 'C'}], target: 101, opts: {dbl: true}, hands: [{v: [120, 0, 0], d: {v: [120, 0, 0], closed: 1}}], firstDealer: 0};
    return [window.__score.handValues(g, {v: [30, 90, 10], closed: 2, _upto: 1}), window.__score.handValues(g, {v: [30, 40, 10], closed: 0, dbl: true, _upto: 1})]; });
  eq('chi è fuori o ha chiuso fa 0', hv[0], [0, 90, 0]);
  eq('raddoppio quando si chiude in mano (regola attiva)', hv[1], [0, 80, 20]);
  const rc = await p.evaluate(() => { const g = {id: 'g', type: 'scala40', players: [{name: 'A'}, {name: 'B'}, {name: 'C'}], target: 101, opts: {}, firstDealer: 0,
    hands: [{v: [0, 0, 0], d: {v: [80, 10, 0], closed: 2}}, {v: [0, 0, 0], d: {v: [30, 20, 0], closed: 2}}, {v: [0, 0, 0], d: {v: [40, 20, 0], closed: 2}}]};
    window.__score.recompute(g); return g.hands.map(h => h.v); });
  eq('ricalcolo di tutte le mani dopo una correzione (chi è già fuori non prende punti)', rc, [[80, 10, 0], [30, 20, 0], [0, 20, 0]]);

  console.log('\nLibero, classifica, mazziere');
  eq('a pari punti stessa posizione', await p.evaluate(() => { const g = {type: 'free', players: [{}, {}, {}], hands: [{v: [10, 10, 5]}], opts: {}}; const st = window.__score.standings(g); return window.__score.positions(g, st, window.__score.ranking(g, st)); }), [1, 1, 3]);
  eq('"vince chi ha meno": arrivato all\'obiettivo vince il più basso', await S('winners', G('free', 2, [[55, 20]], {target: 50, opts: {low: true}})), [1]);
  eq('"vince chi ha meno": pari in testa si continua', await S('winners', G('free', 3, [[55, 20, 20]], {target: 50, opts: {low: true}})), null);
  eq('senza obiettivo non finisce mai', await S('winners', G('free', 2, [[500, 0]])), null);
  eq('mazziere che gira (3 giocatori, 2 mani)', await S('dealerOf', G('free', 3, [[1, 2, 3], [1, 2, 3]])), 2);
  eq('mazziere: salta chi è eliminato', await S('dealerOf', G('scala40', 3, [[0, 120, 0]], {target: 101})), 2);
  eq('mazziere: la mano dopo torna al primo', await S('dealerOf', G('scala40', 3, [[0, 120, 0], [5, 0, 5]], {target: 101})), 0);

  console.log('\nBackup e CSV');
  eq('backup di un\'altra app riconosciuto', await S('parseBackup', JSON.stringify({app: 'simple-fuel', version: 1})), {other: 'Simple Fuel'});
  eq('backup più nuovo rifiutato', await S('parseBackup', JSON.stringify({app: 'simple-score', version: 2, games: []})), {newer: true});
  eq('file qualsiasi rifiutato', await S('parseBackup', '{"a":1}'), null);
  const bk = await S('parseBackup', JSON.stringify({app: 'simple-score', version: 1, games: [{id: 'x"><b>', type: 'scopa', target: 11, players: [{name: '<i>Anna</i>', color: 'red;background:url(x)'}, {name: 'Ben', color: '#2457c5'}], hands: [{v: [3, 1]}]}], players: ['Anna', 5]}));
  eq('identificativo e colore strani sostituiti, nomi tenuti', [/^[A-Za-z0-9_-]+$/.test(bk.games[0].id), bk.games[0].players.map(x => x.color), bk.games[0].players[0].name, bk.players], [true, ['#17804f', '#2457c5'], '<i>Anna</i>', ['Anna']]);
  const pk = await S('parseBackup', JSON.stringify({app: 'simple-score', version: 1, games: ['constructor', 'toString', 'scopa'].map((type, i) => ({id: 'g' + i, type, target: 11, players: [{name: 'A', color: '#17804f'}, {name: 'B', color: '#2457c5'}], hands: [{v: [1, 0]}]}))}));
  eq('partite con tipo "constructor"/"toString" (nomi interni di JavaScript) scartate', pk && pk.games.map(g => g.type), ['scopa']);
  const csv = await p.evaluate(() => window.__score.buildCSV([{type: 'free', players: [{name: '=1+1'}, {name: 'Ben; e "Co"'}], hands: [{v: [3, 4]}, {v: [5, -1]}], target: 0, opts: {}, started: '2026-11-15T10:00:00Z', winners: [0]}], ';'));
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  eq('CSV: una riga per mano, totali progressivi, formule e separatori protetti', [lines.length, lines[2].split(';').slice(4).join(';')], [3, "'=1+1;5;8;\"Ben; e \"\"Co\"\"\";-1;3;'=1+1"]);

  console.log('\nInterfaccia: partita Libera da 2 mani, Annulla, fine partita');
  await p.click('[data-game="free"]');
  await p.locator('#suPlayers input').nth(0).fill('Anna'); await p.locator('#suPlayers input').nth(1).fill('Ben');
  await p.click('#suOptions [data-target="50"]');
  await p.click('#suGo');
  const hand = async (a, b) => { await p.click('#bAdd'); await p.locator('#handBody input[data-in="v"]').nth(0).fill(String(a)); await p.locator('#handBody input[data-in="v"]').nth(1).fill(String(b)); await p.click('#handSave'); await p.waitForTimeout(150); };
  await hand(20, 10); await hand('١٥', '۲۵');   // seconda mano scritta con cifre arabe e persiane (tastiere di quei paesi)
  eq('totali sul tabellone (anche con cifre arabe/persiane: 15 e 25)', await p.evaluate(() => window.__score.current && window.__score.standings(window.__score.current).tot), [35, 35]);
  await hand(20, 5);
  eq('arrivata a 50: partita finita e nello storico', await p.evaluate(() => [window.__score.current, window.__score.games.length, window.__score.games[0].winners]), [null, 1, [0]]);
  await p.click('#toastUndo');
  eq('"Annulla" riporta la partita sul tabellone', await p.evaluate(() => [!!window.__score.current, window.__score.games.length]), [true, 0]);
  await p.screenshot({path: path.join(OUT, 'tabellone.png')});
  console.log('\nMano senza dettaglio (file di backup modificato a mano o dati vecchi)');
  await p.evaluate(() => { localStorage.setItem('sc.current', JSON.stringify({id: 'gb', type: 'burraco', players: [{name: 'Noi', color: '#17804f'}, {name: 'Loro', color: '#2457c5'}], hands: [{v: [540, -35]}], target: 2005, opts: {}, firstDealer: 0, started: '2026-11-15T10:00:00Z'})); });
  await p.reload(); await p.waitForFunction(() => window.__score);
  if (await p.isVisible('#resume')) await p.click('#resume');
  await p.click('#hands [data-hand="0"]');
  eq('Burraco: si apre con i punti salvati in tavola/in mano, stesso totale salvando', await p.evaluate(() => [...document.querySelectorAll('#handBody input[data-in]')].map(i => i.dataset.in + '=' + i.value)), ['tav=540', 'man=', 'tav=', 'man=35']);
  await p.click('#handSave');
  eq('Burraco: totale invariato dopo il salvataggio', await p.evaluate(() => window.__score.current.hands[0].v), [540, -35]);
  const load = async (cur, games) => {   // nuova situazione: partita in corso e storico scritti direttamente nei dati salvati
    await p.evaluate(([c, g]) => { localStorage.setItem('sc.current', JSON.stringify(c)); localStorage.setItem('sc.games', JSON.stringify(g || [])); localStorage.setItem('sc.players', '[]'); }, [cur, games]);
    await p.reload(); await p.waitForFunction(() => window.__score); await p.evaluate(() => document.fonts.ready);
    if (cur && await p.isVisible('#resume')) await p.click('#resume');
  };
  const pl = names => names.map((name, i) => ({name, color: ['#17804f', '#2457c5', '#c8321f', '#c98a00', '#6a44c9', '#c2500f'][i % 6]}));

  console.log('\nTabellone: totali grandi sempre leggibili (1.2.10)');
  await p.setViewportSize({width: 320, height: 844});
  await load({id: 'gt', type: 'free', players: pl(['A', 'B', 'C', 'D', 'E', 'F']), hands: [{v: [-12345, 99999, 10500, -2005, 1250, 0]}], target: 0, opts: {}, firstDealer: 0, started: '2026-11-15T10:00:00Z'});
  const cut = () => p.evaluate(() => [...document.querySelectorAll('.tile .tt')].filter(el => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(), t = el.getBoundingClientRect(); return b.left < t.left - 0.5 || b.right > t.right + 0.5; }).map(el => el.textContent));
  eq('6 giocatori a 320 punti: nessun totale tagliato (-12.345, 99.999, 10.500…)', await cut(), []);
  eq('6 giocatori: "Mazziere" solo come icona, con il nome per TalkBack', await p.evaluate(() => { const d = document.querySelector('.tile .dealer'), t = d.closest('.tile').getBoundingClientRect(), r = d.getBoundingClientRect(); return [r.right <= t.right && r.left >= t.left, d.querySelector('.dl').getBoundingClientRect().width, d.getAttribute('aria-label')]; }), [true, 0, 'Mazziere: B']);   // dopo una mano tocca al secondo
  await p.setViewportSize({width: 390, height: 844});
  await load({id: 'gt', type: 'free', players: pl(['A', 'B']), hands: [{v: [999, -1250]}], target: 0, opts: {}, firstDealer: 0, started: '2026-11-15T10:00:00Z'});
  eq('2 giocatori, numeri normali: dimensione di sempre (13% della larghezza)', await p.evaluate(() => [...document.querySelectorAll('.tile .tt')].map(el => getComputedStyle(el).fontSize)), ['50.7px', '50.7px']);
  await load({id: 'gt', type: 'free', players: pl(['A', 'B']), hands: [{v: [-99999, 1234567]}], target: 0, opts: {}, firstDealer: 0, started: '2026-11-15T10:00:00Z'});
  eq('2 giocatori, numeri enormi: rimpiccioliti ma interi', await cut(), []);

  console.log('\nAvviso in basso: centrato anche mentre compare');
  await p.click('.tile .dealer');
  eq('all\'inizio dell\'animazione l\'avviso è già centrato', await p.evaluate(() => { const el = document.querySelector('#toast'); el.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2) === Math.round(innerWidth / 2); }), true);

  console.log('\nLibera: segno meno e virgola scritti nel campo');
  await p.click('#bAdd');
  const fin = i => p.locator('#handBody input[data-in="v"]').nth(i);
  await fin(0).pressSequentially('12,5'); await fin(1).pressSequentially('-7');
  eq('"12,5" → 12 con l\'avviso "Solo numeri interi"; "-7" accende il tasto meno', [await fin(0).inputValue(), await p.textContent('#toastText'), await p.getAttribute('[data-sign="1"]', 'aria-pressed')], ['12', 'Solo numeri interi', 'true']);
  await p.click('#handSave');
  eq('mano salvata: 12 e −7', await p.evaluate(() => window.__score.current.hands[1].v), [12, -7]);
  await p.click('#bAdd'); await fin(0).pressSequentially('٣٫٥'); await p.click('#handSave');
  eq('cifre arabe con la virgola araba "٣٫٥" → 3', await p.evaluate(() => window.__score.current.hands[2].v), [3, 0]);

  eq('nessun errore in console', errors, []);

  await browser.close(); srv.close();
  console.log(fails ? `\n${fails} PROVE NON RIUSCITE su ${count}` : `\nTutte le ${count} prove riuscite`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
