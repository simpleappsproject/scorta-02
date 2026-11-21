(function(){
const VERSION = '1.2.9';
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Identificativi e colori letti da un file: solo valori come quelli che crea l'app (un file modificato a mano non deve poter inserire codice nella pagina) */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/, SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;
const N = window.Native;

const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};

/* ---------- Dati ----------
   Chiavi di salvataggio: sc.current (partita in corso), sc.games (storico), sc.players (nomi recenti),
   sc.settings, sc.pro — NON cambiarle mai (si perderebbero i dati).
   Partita: {id, type, players:[{name,color}], target, opts:{...}, firstDealer, hands:[{v:[punti per giocatore], d:{dettaglio}}], started, ended} */
const FREE_PLAYERS = 6, MAX_PLAYERS = 12, FREE_HISTORY = 5;
const COLORS = ['#17804f','#2457c5','#c8321f','#c98a00','#6a44c9','#bf2f74','#137a72','#c2500f','#3a6c9b','#8a5a2b','#0f8fb3','#5a6a61'];
let current = store.get('sc.current', null);
let games = store.get('sc.games', []); if(!Array.isArray(games)) games=[];
let recent = store.get('sc.players', []); if(!Array.isArray(recent)) recent=[];
recent = recent.filter(x=>typeof x==='string');
let settings = Object.assign({lang:'auto',theme:'auto',accent:'green',awake:true}, store.get('sc.settings', {}));
let pro = !!store.get('sc.pro', false);
const saveCurrent = () => store.set('sc.current', current);
const saveGames = () => store.set('sc.games', games);
const saveSettings = () => store.set('sc.settings', settings);

/* ---------- Giochi ----------
   low: vince chi ha meno punti. min/max: quanti giocatori o squadre. pro: solo con Pro. */
const GAMES = {
  free:    {min:1, max:MAX_PLAYERS, def:2, targets:[0,50,100,200,500,1000], target:0},
  scopa:   {min:2, max:4, def:2, team:true, targets:[11,16,21], target:11},
  /* Briscola: target = mani vinte che servono (2 = al meglio di 3, 3 = al meglio di 5, 0 = senza limite).
     In 2 o in 3 ognuno per sé, in 4 a coppie (2 squadre). */
  briscola:{min:2, max:3, def:2, team:true, targets:[1,2,3,0], target:2},
  burraco: {min:2, max:2, def:2, team:true, targets:[505,1005,2005], target:2005, pro:true},
  scala40: {min:2, max:6, def:3, low:true, targets:[101,151,201], target:101, pro:true}
};
const GAME_ORDER = ['free','scopa','briscola','burraco','scala40'];
/* Briscola: 120 punti in tutto nel mazzo; vince la mano chi fa più punti degli altri (in due: più di 60). 60 a 60 = pari (-1) */
const BRI_TOTAL = 120;
function briWinner(v){
  const p=v.map(x=>+x||0), best=Math.max(...p), w=p.map((x,i)=>i).filter(i=>p[i]===best);
  return w.length===1 ? w[0] : -1;
}
const isLow = g => g.type==='scala40' || (g.type==='free' && g.opts.low);

/* Controllo di una partita (salvata, o letta da un backup): se è rovinata non deve bloccare l'app.
   normGame completa i campi mancanti senza cambiare i punti. */
function validGame(g){
  return !!(g && typeof g==='object' && Object.prototype.hasOwnProperty.call(GAMES,g.type) &&   /* "constructor", "toString"… non sono giochi */
    Array.isArray(g.players) && g.players.length>=1 && g.players.length<=MAX_PLAYERS
    && g.players.every(p=>p && typeof p.name==='string') && Array.isArray(g.hands) && g.hands.every(h=>h && Array.isArray(h.v)));
}
function normGame(g){
  if(typeof g.id!=='string' || !SAFE_ID.test(g.id)) g.id=uid();
  if(!g.opts || typeof g.opts!=='object') g.opts={};
  if(typeof g.target!=='number') g.target=GAMES[g.type].target;
  g.players.forEach((p,i)=>{ if(typeof p.color!=='string' || !SAFE_COLOR.test(p.color)) p.color=COLORS[i%COLORS.length]; });
  if(typeof g.started!=='string') g.started=g.ended||new Date().toISOString();
  /* vincitori e mazziere: solo posizioni di giocatori che esistono (un file modificato a mano non deve bloccare lo Storico) */
  const okIdx = x => Number.isInteger(x) && x>=0 && x<g.players.length;
  if('winners' in g){ const w=Array.isArray(g.winners) ? [...new Set(g.winners.filter(okIdx))] : []; if(w.length) g.winners=w; else delete g.winners; }
  if(!okIdx(g.firstDealer)) g.firstDealer=0;
  return g;
}
current = validGame(current) ? normGame(current) : null;
games = games.filter(validGame).map(normGame);

/* ---------- Lingua ---------- */
const LANGS = Object.keys(I18N);
let lang = 'it', PLURAL = null;
function pickLang(){
  if(LANGS.includes(settings.lang)) return settings.lang;
  const l=((navigator.languages&&navigator.languages[0])||navigator.language||'en').toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(l) ? l : 'en';
}
function t(key, vars){
  if(vars && typeof vars.n==='number' && PLURAL){ try{ const k=key+'.'+PLURAL.select(vars.n); if(I18N[lang] && I18N[lang][k]!=null) key=k; }catch(e){} }
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? I18N.it[key] ?? key;
  if(vars) s = s.replace(/\{(\w+)\}/g,(m,k)=> vars[k]!==undefined ? vars[k] : m);
  return s;
}
function locale(){
  const l=(navigator.languages&&navigator.languages[0])||navigator.language||'';
  const m=(I18N[lang]&&I18N[lang]._)||{};
  return l.toLowerCase().split(/[-_]/)[0]===lang ? l : (m.locale||'en-GB');
}
let NF=null, DF=null;
const num = n => NF ? NF.format(n) : String(n);
function applyLang(){
  lang = pickLang();
  const loc=locale();
  try{ PLURAL=new Intl.PluralRules(loc); }catch(e){ PLURAL=null; }
  try{ NF=new Intl.NumberFormat(loc); DF=new Intl.DateTimeFormat(loc,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }catch(e){ NF=DF=null; }
  document.documentElement.lang = lang;
  document.documentElement.dir = (I18N[lang]._&&I18N[lang]._.dir)||'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('#tabs').setAttribute('aria-label', t('tab.aria'));
}
const fmtWhen = iso => { try{ return DF ? DF.format(new Date(iso)) : iso.slice(0,10); }catch(e){ return ''; } };
const gameName = g => t('game.'+g.type);

/* ---------- Tema e colore ---------- */
const ACCENTS = {green:['#17804f','#3fcf8a'],blue:['#2457c5','#6b9bff'],red:['#c8321f','#ff7a63'],violet:['#6a44c9','#a68bff'],orange:['#c2500f','#ff9a5c'],graphite:['#2b332e','#d5ddd8']};
const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const isDark = () => settings.theme==='dark' || (settings.theme==='auto' && darkMQ && darkMQ.matches);
function applyTheme(){
  const r=document.documentElement;
  if(settings.theme==='auto') delete r.dataset.theme; else r.dataset.theme=settings.theme;
  const acc = pro && Object.prototype.hasOwnProperty.call(ACCENTS,settings.accent) ? settings.accent : 'green';
  if(acc==='green') delete r.dataset.accent; else r.dataset.accent=acc;
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=ACCENTS[acc][isDark()?1:0];
  N.setBars(isDark());
}
if(darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change',()=>{ applyTheme(); if(view==='settings') renderSettings(); });

/* ---------- Calcolo dei punteggi ---------- */
/* Punti di una mano a partire dal dettaglio inserito */
function handValues(g, d){
  const n=g.players.length;
  if(g.type==='scopa'){
    return g.players.map((p,i)=> (d.carte===i?1:0)+(d.denari===i?1:0)+(d.sette===i?1:0)+(d.primiera===i?1:0)+((d.scope&&+d.scope[i])||0));
  }
  if(g.type==='burraco'){
    /* pulito 200, sporco 100, carte in tavola +, carte in mano −, chiusura +100, pozzetto non preso −100 */
    return g.players.map((p,i)=> 200*(+d.cl[i]||0) + 100*(+d.sp[i]||0) + (+d.tav[i]||0) - (+d.man[i]||0) + (d.chiusura===i?100:0) - (d.pozz[i]?0:100));
  }
  if(g.type==='briscola'){
    /* si scrivono i punti di tutti tranne uno (d.auto): a lui va quello che manca per arrivare a 120 */
    const a = briAuto(g, d);
    const v = g.players.map((p,i)=> i===a ? 0 : (+d.v[i]||0));
    v[a] = BRI_TOTAL - v.reduce((s,x)=>s+x,0);
    return v;
  }
  if(g.type==='scala40'){
    const out = standings(g, d._upto).out;
    /* raddoppio solo se è attivo nelle regole e qualcuno ha chiuso */
    const k = g.opts.dbl && d.dbl && d.closed>=0 ? 2 : 1;
    return g.players.map((p,i)=> out[i] || d.closed===i ? 0 : (+d.v[i]||0)*k);
  }
  return Array.from({length:n},(x,i)=>+d.v[i]||0);
}
const briAuto = (g, d) => (Number.isInteger(d.auto) && d.auto>=0 && d.auto<g.players.length) ? d.auto : g.players.length-1;
/* Totali, eliminati, rientri e andamento mano per mano. upto = considera solo le prime "upto" mani.
   outAt[i] = numero della mano (da 0) in cui il giocatore è stato eliminato, -1 se è in gioco.
   outHist[k] = chi era eliminato dopo k mani (serve per far girare il mazziere). */
function standings(g, upto){
  const n=g.players.length, hands=g.hands.slice(0, upto==null ? g.hands.length : upto);
  const tot=Array(n).fill(0), out=Array(n).fill(false), re=Array(n).fill(0), outAt=Array(n).fill(-1), hist=[tot.slice()], outHist=[out.slice()];
  /* Briscola: tot = mani vinte (60 a 60 non conta per nessuno); pts = somma dei punti delle carte, ptsHist = andamento dei punti */
  const bri = g.type==='briscola', pts=Array(n).fill(0), ptsHist=[pts.slice()];
  hands.forEach((h,k)=>{
    if(bri){
      const w=briWinner(h.v); if(w>=0) tot[w]++;
      for(let i=0;i<n;i++) pts[i]+= (+h.v[i]||0);
      ptsHist.push(pts.slice());
    }
    else for(let i=0;i<n;i++) if(!out[i]) tot[i]+= (+h.v[i]||0);
    if(g.type==='scala40'){
      const lim=g.target;
      const over=[...Array(n).keys()].filter(i=>!out[i] && tot[i]>=lim);
      const still=[...Array(n).keys()].filter(i=>!out[i] && tot[i]<lim);
      over.forEach(i=>{
        /* Rientro (se scelto): una volta sola, con il punteggio più alto tra chi è ancora in gioco, se restano almeno 2 giocatori */
        if(g.opts.reentry && re[i]<1 && still.length>=2){ re[i]++; tot[i]=Math.max(...still.map(j=>tot[j])); }
        else { out[i]=true; outAt[i]=k; }
      });
    }
    hist.push(tot.slice()); outHist.push(out.slice());
  });
  const r={tot, out, re, outAt, hist, outHist};
  if(bri){ r.pts=pts; r.ptsHist=ptsHist; }
  return r;
}
/* Classifica: indici dei giocatori dal primo all'ultimo */
function ranking(g, st){
  st = st || standings(g);
  const low=isLow(g);
  /* chi è eliminato va in fondo; tra gli eliminati è più in alto chi è uscito più tardi */
  /* Briscola: a pari mani vinte si mostra prima chi ha più punti (ma la posizione resta la stessa, vedi positions) */
  return [...g.players.keys()].sort((a,b)=> (st.out[a]-st.out[b]) || (st.out[a] ? st.outAt[b]-st.outAt[a] : 0) || (low ? st.tot[a]-st.tot[b] : st.tot[b]-st.tot[a]) || (st.pts ? st.pts[b]-st.pts[a] : 0));
}
/* Posizione in classifica (1 = primo); a pari punti stessa posizione */
function positions(g, st, rk){
  const pos=Array(g.players.length).fill(0);
  rk.forEach((i,k)=>{ const prev=rk[k-1]; pos[i] = k>0 && st.out[prev]===st.out[i] && st.outAt[prev]===st.outAt[i] && st.tot[prev]===st.tot[i] ? pos[prev] : k+1; });
  return pos;
}
/* La partita è finita? Restituisce gli indici dei vincitori, oppure null */
function winners(g){
  if(!g.hands.length) return null;
  const st=standings(g), r=ranking(g,st);
  if(g.type==='scala40'){
    const alive=r.filter(i=>!st.out[i]);
    if(alive.length===1) return alive;
    if(alive.length===0){
      /* tutti fuori nella stessa mano: vince chi ha meno punti tra gli ultimi eliminati (non chi era uscito prima) */
      const last=Math.max(...st.outAt), cand=r.filter(i=>st.outAt[i]===last), best=Math.min(...cand.map(i=>st.tot[i]));
      return cand.filter(i=>st.tot[i]===best);
    }
    return null;
  }
  if(!g.target) return null;
  if(!g.players.some((p,i)=>st.tot[i]>=g.target)) return null;
  if(isLow(g)){
    /* "vince chi ha meno": quando qualcuno arriva all'obiettivo, vince il più basso (a pari punti si continua) */
    const best=Math.min(...st.tot), w=r.filter(i=>st.tot[i]===best);
    return w.length===1 ? w : null;
  }
  const best=Math.max(...st.tot), w=r.filter(i=>st.tot[i]===best);
  return w.length===1 ? w : null;     // pari punti in testa: si gioca un'altra mano
}
/* Mazziere della prossima mano: a ogni mano passa al giocatore successivo che in quel momento è ancora in gioco
   (chi viene eliminato più tardi ha fatto il mazziere nelle mani precedenti) */
function dealerOf(g){
  const n=g.players.length, oh=standings(g).outHist;
  let d=((g.firstDealer||0)%n+n)%n;
  for(let k=1;k<=g.hands.length;k++){
    const out=oh[k]; if(out.every(Boolean)) break;
    let guard=0; do{ d=(d+1)%n; }while(out[d] && guard++<n);
  }
  return d;
}
/* Scala 40: i punti di ogni mano dipendono da chi era già eliminato, quindi dopo ogni modifica si ricalcolano tutte in ordine */
function recompute(g){
  if(g.type!=='scala40') return;
  g.hands.forEach((h,k)=>{ if(!h.d || !Array.isArray(h.d.v)) return; h.d._upto=k; h.v=handValues(g,h.d); delete h.d._upto; });
}
/* "Impronta" delle mani: serve a capire se dopo un Annulla la partita è rimasta uguale */
const handsSig = g => JSON.stringify(g.hands.map(h=>h.v));

/* ---------- Pro ---------- */
function setPro(v){
  v=!!v; if(v===pro) return;
  pro=v; store.set('sc.pro', pro);
  applyTheme(); renderAll();
}
let proFrom=null;
function openPro(reason){
  proFrom = document.activeElement;
  const leads={game:t('pro.lead.game'), players:t('pro.lead.players',{max:FREE_PLAYERS}), history:t('pro.lead.history'), dice:t('pro.lead.dice'), style:t('pro.lead.style'), export:t('pro.lead.export')};
  $('#proLead').textContent = leads[reason] || t('pro.lead');
  $('#proMsg').textContent = N.billing.available ? '' : t('pro.web');
  renderProBuy(false);
  $('#pro').hidden=false; $('#proBuy').focus();
}
function renderProBuy(busy){
  const b=$('#proBuy');
  b.disabled = busy || !N.billing.available;
  b.textContent = busy ? t('pro.wait') : (N.billing.price ? t('pro.buy',{price:N.billing.price}) : t('pro.buyNoPrice'));
  $('#proRestore').disabled = busy || !N.billing.available;
}
function closePro(){ $('#pro').hidden=true; if(proFrom && proFrom.focus) try{ proFrom.focus(); }catch(e){} }
$('#proClose').addEventListener('click',closePro);
$('#pro').addEventListener('click',e=>{ if(e.target.id==='pro') closePro(); });
$('#proBuy').addEventListener('click',async()=>{
  renderProBuy(true); $('#proMsg').textContent='';
  const r = await N.billing.buy();
  renderProBuy(false);
  if(r==='ok'){ setPro(true); $('#proMsg').textContent=t('pro.thanks'); setTimeout(closePro,1200); }
  else $('#proMsg').textContent = t(r==='pending'?'pro.pending':r==='cancelled'?'pro.cancelled':'pro.error');
});
$('#proRestore').addEventListener('click',async()=>{
  renderProBuy(true); $('#proMsg').textContent='';
  const r = await N.billing.restore();
  renderProBuy(false);
  if(r==='ok'){ setPro(true); $('#proMsg').textContent=t('pro.restored'); setTimeout(closePro,1200); }
  else $('#proMsg').textContent = t(r==='none'?'pro.notFound':'pro.error');
});

/* ---------- Avviso in basso con "Annulla" ---------- */
let toastT=null, toastUndo=null;
function toast(text, undo){
  clearTimeout(toastT);
  $('#toastText').textContent=text; toastUndo=undo||null; $('#toastUndo').hidden=!undo; $('#toast').hidden=false;
  toastT=setTimeout(hideToast, undo?6000:3000);
}
function hideToast(){ $('#toast').hidden=true; toastUndo=null; }
$('#toastUndo').addEventListener('click',()=>{ const u=toastUndo; hideToast(); if(u) u(); });
function arm(btn,text,fn){
  if(btn.classList.contains('armed')){ clearTimeout(btn._t); btn.classList.remove('armed'); if(btn._orig) btn.textContent=btn._orig; fn(); return; }
  btn._orig=btn.textContent; btn.textContent=text; btn.classList.add('armed');
  btn._t=setTimeout(()=>disarm(btn),3500);
}
function disarm(btn){ clearTimeout(btn._t); btn.classList.remove('armed'); if(btn._orig) btn.textContent=btn._orig; }

/* ---------- Navigazione ---------- */
const VIEWS=['home','setup','board','end','history','settings'];
let view='home';
function show(v){
  view=v;
  hideToast();   // l'avviso con "Annulla" riguarda la schermata che si lascia: non deve coprire i pulsanti di quella nuova
  VIEWS.forEach(k=>{ $('#v-'+k).hidden = k!==v; });
  $('#topSub').textContent = t('sub.'+v);
  const tab = (v==='setup'||v==='board') ? 'home' : (v==='end' ? (endFromHistory?'history':'home') : v);
  document.querySelectorAll('.tab').forEach(b=>{ if(b.dataset.tab===tab) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  N.keepAwake(v==='board' && settings.awake);
  if(v==='home') renderHome();
  if(v==='board') renderBoard();
  if(v==='history') renderHistory();
  if(v==='settings') renderSettings();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.tab==='home' && current && view!=='board' && view!=='home') { show('home'); return; }
  show(b.dataset.tab);
}));

/* ---------- Home ---------- */
const ICON = {
  free:'<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 15v6M15 18h6"/></svg>',
  scopa:'<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M12 7.5c1.8 1.6 3 2.8 3 4.3a3 3 0 0 1-6 0c0-1.5 1.2-2.7 3-4.3zM12 15v2.5"/></svg>',
  briscola:'<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M12 6.5v8.5M9.5 15h5M12 15v2.5"/></svg>',
  burraco:'<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="6" width="10" height="14" rx="2" transform="rotate(-12 7.5 13)"/><rect x="7" y="4.5" width="10" height="14" rx="2"/><rect x="11.5" y="6" width="10" height="14" rx="2" transform="rotate(12 16.5 13)"/></svg>',
  scala40:'<svg class="gi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="12" width="5" height="8" rx="1.2"/><rect x="9.5" y="8" width="5" height="12" rx="1.2"/><rect x="16" y="4" width="5" height="16" rx="1.2"/></svg>'
};
const lockSVG = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const cardsSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="4" y="5" width="11" height="15" rx="2"/><path d="M9 3.5h8.5a2 2 0 0 1 2 2V17"/></svg>';
function renderHome(){
  $('#proTag').hidden=!pro;
  const r=$('#resume');
  if(current){
    const st=standings(current), rk=ranking(current,st);
    r.hidden=false;
    /* Briscola: al posto dei punti si mostrano le mani vinte, es. 2–1 */
    const lp = current.type==='briscola' ? rk.map(i=>num(st.tot[i])).join('–') : num(st.tot[rk[0]]);
    r.innerHTML=`<div><b>${esc(t('home.resume',{game:gameName(current)}))}</b><small>${esc(t('home.resumeInfo',{n:current.hands.length, lead:current.players[rk[0]].name, pts:lp}))}</small></div><span class="go">${esc(t('home.go'))} →</span>`;
  } else r.hidden=true;
  $('#games').innerHTML = GAME_ORDER.map(k=>`<button class="game" data-game="${k}">${ICON[k]}${GAMES[k].pro&&!pro?lockSVG:''}<b>${esc(t('game.'+k))}</b><small>${esc(t('game.'+k+'.h'))}</small></button>`).join('');
}
$('#resume').addEventListener('click',()=>show('board'));
$('#games').addEventListener('click',e=>{
  const b=e.target.closest('[data-game]'); if(!b) return;
  const k=b.dataset.game;
  if(GAMES[k].pro && !pro){ openPro('game'); return; }
  openSetup(k);
});

/* ---------- Preparazione ---------- */
let draft=null;
function defaultNames(k){
  const G=GAMES[k];
  if(G.team) return [t('su.us'), t('su.them')];
  return Array.from({length:G.def},(x,i)=>t('su.player',{n:i+1}));
}
function openSetup(k, from){
  const G=GAMES[k];
  if(from){
    /* Rivincita: i nomi messi dall'app ("Noi", "Voi", "Giocatore 2"…) restano predefiniti, così non finiscono tra i nomi recenti */
    const n=from.players.length, def=i=>[t('su.player',{n:i+1}), t('su.team',{n:i+1})].concat(G.team && n===2 ? [t(i===0?'su.us':'su.them')] : []);
    draft={type:k, players:from.players.map((p,i)=>{ const q={...p}; delete q.auto; if(def(i).includes(String(p.name))) q.auto=true; return q; }), target:from.target, opts:{...from.opts}, firstDealer:((from.firstDealer||0)+1)%n};
  }
  else draft={type:k, players:defaultNames(k).map((name,i)=>({name, color:COLORS[i%COLORS.length], auto:true})), target:G.target, opts:{low:false, reentry:false, dbl:false}, firstDealer:0};
  renderSetup(); show('setup');
}
/* Scopa e Briscola: "Noi/Voi" solo con 2 squadre; con 3 o 4 ognuno gioca per sé, quindi "Giocatore 1, 2, 3…".
   Si cambiano solo i nomi messi dall'app (auto), mai quelli scritti dall'utente. */
function autoNames(){
  if(!GAMES[draft.type].team) return;
  const n=draft.players.length;
  draft.players.forEach((p,i)=>{ if(p.auto) p.name = n===2 ? t(i===0?'su.us':'su.them') : t('su.player',{n:i+1}); });
}
function renderSetup(){
  const G=GAMES[draft.type];
  autoNames();
  $('#suTitle').textContent = t('game.'+draft.type);
  $('#suSub').textContent = current ? t('su.replace') : '';
  $('#suPlayersLbl').textContent = G.team ? t('su.teams') : t('su.players');
  $('#suPlayers').innerHTML = draft.players.map((p,i)=>`<div class="prow"><button class="pdot" style="--c:${p.color}" data-color="${i}" aria-label="${esc(t('su.color'))}"></button>
    <input class="in" data-pname="${i}" maxlength="24" value="${esc(p.name)}" aria-label="${esc(t('su.name',{n:i+1}))}" autocomplete="off">
    ${draft.players.length>G.min?`<button class="x" data-prem="${i}" aria-label="${esc(t('su.remove'))}">×</button>`:''}</div>`).join('');
  const canMore = draft.players.length < G.max;
  $('#suAdd').hidden = !canMore;
  $('#suAdd').innerHTML = esc(t('su.add'))   // nei giochi a squadre chi si aggiunge gioca per sé (Scopa e Briscola a 3 o 4)
     + (!pro && draft.players.length>=FREE_PLAYERS ? lockSVG : '');
  const used=new Set(draft.players.map(p=>p.name.trim().toLowerCase()));
  const rec=recent.filter(n=>!used.has(n.toLowerCase())).slice(0,10);
  $('#suRecent').innerHTML = rec.map(n=>`<button data-recent="${esc(n)}">+ ${esc(n)}</button>`).join('');
  // Opzioni
  const tLabel = v => !v ? esc(t('su.noTarget')) : draft.type!=='briscola' ? num(v) : esc(briLabel(v));
  const tg = G.targets.map(v=>`<button data-target="${v}" aria-pressed="${draft.target===v}">${tLabel(v)}</button>`).join('');
  let o = `<div class="opt-row" style="flex-direction:column;align-items:stretch"><div><b>${esc(t('su.target.'+draft.type))}</b><small>${esc(t('su.target.'+draft.type+'.h'))}</small></div><div class="seg" role="group" aria-label="${esc(t('su.target.'+draft.type))}">${tg}</div></div>`;
  if(draft.type==='briscola') o += `<p class="hint" style="text-align:start;margin:10px 0 2px">${esc(t('bri.setup'))}</p>`;
  if(draft.type==='free') o += switchRow('low', t('su.low'), t('su.low.h'));
  if(draft.type==='scala40'){ o += switchRow('reentry', t('su.reentry'), t('su.reentry.h')) + switchRow('dbl', t('su.dbl'), t('su.dbl.h')); }
  $('#suOptions').innerHTML = o;
}
/* Briscola: 1 = "Secca", 2 = "2 su 3", 3 = "3 su 5" */
const briLabel = v => v===1 ? t('bri.t1') : t('bri.tN',{a:num(v), b:num(2*v-1)});
const switchRow = (k,label,help) => `<div class="opt-row"><label for="opt-${k}"><b>${esc(label)}</b><small>${esc(help)}</small></label><span class="switch"><input type="checkbox" id="opt-${k}" data-opt="${k}" ${draft.opts[k]?'checked':''}><span></span></span></div>`;
$('#suPlayers').addEventListener('input',e=>{ const i=e.target.dataset.pname; if(i!=null){ draft.players[i].name=e.target.value; draft.players[i].auto=false; } });
$('#suPlayers').addEventListener('click',e=>{
  const r=e.target.closest('[data-prem]'), c=e.target.closest('[data-color]');
  if(r){ draft.players.splice(+r.dataset.prem,1); renderSetup(); }
  if(c){ const p=draft.players[+c.dataset.color]; const used=draft.players.map(x=>x.color); let k=(COLORS.indexOf(p.color)+1)%COLORS.length, g=0; while(used.includes(COLORS[k]) && g++<COLORS.length) k=(k+1)%COLORS.length; p.color=COLORS[k]; renderSetup(); }
});
function addPlayer(name){
  const G=GAMES[draft.type];
  if(draft.players.length>=G.max) return false;
  if(!pro && draft.players.length>=FREE_PLAYERS){ openPro('players'); return false; }
  const used=draft.players.map(p=>p.color);
  const color=COLORS.find(c=>!used.includes(c))||COLORS[draft.players.length%COLORS.length];
  draft.players.push({name: name || (G.team ? t('su.team',{n:draft.players.length+1}) : t('su.player',{n:draft.players.length+1})), color, auto:!name});
  return true;
}
$('#suAdd').addEventListener('click',()=>{ if(addPlayer()){ renderSetup(); const ins=document.querySelectorAll('[data-pname]'); const l=ins[ins.length-1]; if(l){ l.focus(); l.select(); } } });
$('#suRecent').addEventListener('click',e=>{
  const b=e.target.closest('[data-recent]'); if(!b) return;
  const name=b.dataset.recent, slot=draft.players.find(p=>p.auto);
  if(slot){ slot.name=name; slot.auto=false; } else if(!addPlayer(name)) return;
  renderSetup();
});
$('#suOptions').addEventListener('click',e=>{ const b=e.target.closest('[data-target]'); if(b){ draft.target=+b.dataset.target; renderSetup(); } });
$('#suOptions').addEventListener('change',e=>{ const k=e.target.dataset.opt; if(k) draft.opts[k]=e.target.checked; });
$('#suBack').addEventListener('click',()=>show('home'));
$('#suGo').addEventListener('click',()=>{
  const clean = x => String(x||'').trim().replace(/\s+/g,' ');
  const names=draft.players.filter(p=>!p.auto && clean(p.name)).map(p=>clean(p.name));
  /* nome vuoto → nome predefinito; due giocatori con lo stesso nome → al secondo si aggiunge un numero (Marco, Marco 2) */
  const seen=new Set();
  draft.players.forEach((p,i)=>{
    let nm = clean(p.name) || (GAMES[draft.type].team ? t('su.team',{n:i+1}) : t('su.player',{n:i+1}));
    const base=nm; let k=2; while(seen.has(nm.toLowerCase())) nm=base+' '+(k++);
    seen.add(nm.toLowerCase()); p.name=nm; delete p.auto;
  });
  const lower=new Set(names.map(n=>n.toLowerCase()));
  recent = names.concat(recent.filter(n=>!lower.has(n.toLowerCase()))).slice(0,20);
  store.set('sc.players', recent);
  const prev=current;
  current = {id:uid(), type:draft.type, players:draft.players, target:draft.target, opts:draft.opts, firstDealer:draft.firstDealer||0, hands:[], started:new Date().toISOString()};
  saveCurrent(); draft=null; show('board');
  if(prev && prev.hands.length) toast(t('toast.replaced'),()=>{ current=prev; saveCurrent(); show('board'); });
});

/* ---------- Tabellone ---------- */
/* Larghezza di un totale nel carattere dei numeri (Big Shoulders Display 900), in em, misurata segno per segno e arrotondata per eccesso;
   segni non previsti (cifre arabe…) 0,6. Serve al CSS per rimpicciolire solo i numeri che non ci stanno (--w nella casella). */
const NUM_W = {'0':.51,'1':.28,'2':.495,'3':.51,'4':.515,'5':.52,'6':.505,'7':.49,'8':.505,'9':.505,'-':.45,'\u2212':.52,'.':.255,',':.255,"'":.21,' ':.225,'\u00a0':.225,'\u202f':.115,'\u066b':.33,'\u066c':.33,'\u200e':0,'\u200f':0,'\u061c':0};
const numWidth = s => (1.005*[...s].reduce((a,c)=> a + (NUM_W[c] ?? .6), 0)).toFixed(3);
function renderBoard(){
  const g=current; if(!g){ show('home'); return; }
  const st=standings(g), rk=ranking(g,st), pos=positions(g,st,rk), n=g.players.length, dealer=dealerOf(g), w=winners(g);
  /* dopo "Annulla" sulla fine partita non la si richiude subito: si aspetta una correzione o il tasto Fine */
  const held = !!w && g.hold===handsSig(g);
  if(w && !held){ finishGame(w); return; }
  $('#bName').textContent = gameName(g);
  $('#bInfo').textContent = g.type==='briscola' ? t(g.target>1 ? 'b.info.briscola' : 'b.info.briscola'+g.target, {t:num(2*g.target-1)})
    : t(g.type!=='free' ? 'b.info.'+g.type : !g.target ? 'b.info.free0' : g.opts.low ? 'b.info.freeLow' : 'b.info.free', {t:num(g.target), n:g.hands.length});
  const cols = n<=2 ? 2 : n<=4 ? 2 : 3;
  const tiles=$('#tiles'); tiles.style.setProperty('--cols',cols); tiles.classList.toggle('many', n>4);
  const lead = g.hands.length ? rk[0] : -1;   // in testa (a pari punti anche gli altri primi)
  const ref = g.target || Math.max(1,...st.tot.map(Math.abs));
  tiles.innerHTML = g.players.map((p,i)=>{
    const out=st.out[i], first = lead>=0 && !out && pos[i]===pos[lead];
    const info = out ? t('b.out') : (st.re[i] ? t('b.reentered') : (g.hands.length ? t('b.pos',{n:pos[i]}) : ''));
    const pct = Math.max(0,Math.min(100, st.tot[i]/ref*100));
    return `<div class="tile${first?' lead':''}${out?' out':''}" style="--c:${p.color}">
      <div class="tn"><span>${esc(p.name)}</span></div>
      <div class="tt" style="--w:${numWidth(num(st.tot[i]))}">${num(st.tot[i])}</div>
      ${st.pts?`<div class="tp">${esc(t('bri.pts',{p:num(st.pts[i])}))}</div>`:''}
      <div class="tm"><span class="pos">${esc(info)}</span>${i===dealer&&!out?`<button class="dealer" data-dealer="${i}" aria-label="${esc(t('b.dealer'))}: ${esc(p.name)}" title="${esc(t('b.dealer'))}">${cardsSVG}<span class="dl">${esc(t('b.dealer'))}</span></button>`:''}</div>
      ${g.target?`<div class="bar"><i style="--w:${pct}%"></i></div>`:''}
    </div>`;
  }).join('');
  $('#bAdd').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>${esc(t('b.add',{n:g.hands.length+1}))}`;
  $('#bHint').textContent = held ? t('b.overHint') : g.hands.length ? t('b.hint') : t('b.dealerHint');
  // Tabella delle mani
  $('#handsHead').hidden = !g.hands.length; $('#handsWrap').hidden = !g.hands.length;
  $('#hands').innerHTML = `<thead><tr><th>#</th>${g.players.map(p=>`<th title="${esc(p.name)}"><i style="--c:${p.color}"></i>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>`+
    g.hands.map((h,k)=>{
      /* Briscola: i punti delle carte senza "+", in evidenza chi ha vinto la mano */
      const bw = g.type==='briscola' ? briWinner(h.v) : -2;
      return `<tr data-hand="${k}"><td>${k+1}</td>${g.players.map((p,i)=>{ const v=+h.v[i]||0; return `<td class="${v<0?'neg':''}${bw===i?' won':''}">${v>0&&g.type!=='scala40'&&bw===-2?'+':''}${num(v)}</td>`; }).join('')}</tr>`;
    }).reverse().join('')+'</tbody>';
  disarm($('#bEnd')); disarm($('#bUndo'));
}
$('#tiles').addEventListener('click',e=>{
  const d=e.target.closest('[data-dealer]');
  if(d){ toast(t('b.dealerTap')); return; }
  const tile=e.target.closest('.tile'); if(!tile || current.hands.length) return;
  /* Prima della prima mano: tocca un giocatore per farlo mazziere */
  const i=[...tile.parentNode.children].indexOf(tile);
  current.firstDealer=i; saveCurrent(); renderBoard();
});
$('#bAdd').addEventListener('click',()=>openHand(null));
$('#hands').addEventListener('click',e=>{ const r=e.target.closest('[data-hand]'); if(r) openHand(+r.dataset.hand); });
$('#bUndo').addEventListener('click',e=>arm(e.currentTarget,t('b.undoConfirm'),()=>{
  const g=current; if(!g || !g.hands.length) return;
  const h=g.hands.pop(); recompute(g); saveCurrent(); renderBoard();
  toast(t('toast.handRemoved'),()=>{ if(current!==g) return; g.hands.push(h); recompute(g); saveCurrent(); show('board'); });
}));
$('#bEnd').addEventListener('click',e=>arm(e.currentTarget,t('b.endConfirm'),()=>{
  if(!current.hands.length){ const g=current; current=null; saveCurrent(); show('home'); toast(t('toast.discarded'),()=>{ current=g; saveCurrent(); show('board'); }); return; }
  const w=winners(current); if(w){ finishGame(w); return; }
  const st=standings(current), rk=ranking(current,st), best=st.tot[rk[0]];
  finishGame(rk.filter(i=>st.out[i]===st.out[rk[0]] && st.tot[i]===best));
}));

/* ---------- Inserimento di una mano ---------- */
let hd=null, hk=null;   // dettaglio in modifica, indice della mano (null = nuova)
function openHand(k){
  const g=current; hk=k;
  const n=g.players.length;
  if(k!=null){
    hd=JSON.parse(JSON.stringify(g.hands[k].d||{v:g.hands[k].v}));
    /* mano senza dettaglio (file di backup modificato o dati di esempio): si riparte dai punti salvati, senza bloccare l'app */
    const vv=(g.hands[k].v||[]).map(x=>+x||0), arr=a=>Array.isArray(a)&&a.length===n;
    if(g.type==='burraco' && !['cl','sp','tav','man','pozz'].every(x=>arr(hd[x])))
      hd={cl:[0,0], sp:[0,0], tav:vv.map(x=>x>0?x:''), man:vv.map(x=>x<0?-x:''), chiusura:-1, pozz:[true,true]};
    else if(g.type==='scopa' && !arr(hd.scope))
      hd={carte:-1, denari:-1, sette:-1, primiera:-1, scope:vv.map(x=>Math.max(0,x))};
    else if(!arr(hd.v)) hd.v=Array.from({length:n},(x,i)=>vv[i]!=null?String(vv[i]):'');
  }
  else if(g.type==='scopa') hd={carte:-1, denari:-1, sette:-1, primiera:-1, scope:Array(n).fill(0)};
  else if(g.type==='burraco') hd={cl:[0,0], sp:[0,0], tav:['',''], man:['',''], chiusura:-1, pozz:[true,true]};
  else if(g.type==='scala40') hd={v:Array(n).fill(''), closed:-1, dbl:false};
  else if(g.type==='briscola') hd={v:Array(n).fill(''), auto:n-1};
  else hd={v:Array(n).fill(''), neg:Array(n).fill(false)};
  if(g.type==='free' && !hd.neg) hd.neg = hd.v.map(x=>+x<0);
  if(g.type==='briscola'){ hd.auto=briAuto(g,hd); hd.ord=[]; }   // ord = campi scritti, dall'ultimo toccato
  hd._upto = k==null ? g.hands.length : k;
  $('#handTitle').textContent = k==null ? t('hand.title',{n:g.hands.length+1}) : t('hand.edit',{n:k+1});
  $('#handDel').hidden = k==null; disarm($('#handDel'));
  hideToast();   // l'avviso in basso coprirebbe l'anteprima della mano
  renderHand(); $('#hand').hidden=false;
  const f=$('#handBody input'); if(f && g.type!=='burraco') setTimeout(()=>{ try{ f.focus(); }catch(e){} },60);
}
/* Nome per TalkBack: "Burraco puliti – Noi" (con 2 squadre la stessa voce compare per ognuna) */
const who = (label,i) => { const n=current&&current.players[i]&&current.players[i].name; return !label ? (n||'') : (n&&n!==label ? label+' – '+n : label); };
const numIn = (key,i,val,opts) => `<span class="num">${opts&&opts.sign?`<button class="sign" data-sign="${i}" aria-pressed="${!!(hd.neg&&hd.neg[i])}" aria-label="${esc(who(t('hand.minus'),i))}">−</button>`:''}<input inputmode="numeric" pattern="[0-9]*" data-in="${key}" data-i="${i}" value="${esc(val===''||val==null?'':Math.abs(val))}" placeholder="0" ${opts&&opts.disabled?'disabled':''} aria-label="${esc(who(opts&&opts.label,i))}"></span>`;
const stepper = (key,i,val,label) => `<span class="stepper"><button data-step="${key}" data-i="${i}" data-d="-1" aria-label="${esc(who(t('hand.less',{x:label}),i))}">−</button><output>${val}</output><button data-step="${key}" data-i="${i}" data-d="1" aria-label="${esc(who(t('hand.more',{x:label}),i))}">+</button></span>`;
const pickSeg = (key, val, allowNone, noneLabel, label) => `<div class="seg" role="group"${label?` aria-label="${esc(label)}"`:''}>${current.players.map((p,i)=>`<button data-pick="${key}" data-v="${i}" aria-pressed="${val===i}">${esc(p.name)}</button>`).join('')}${allowNone?`<button data-pick="${key}" data-v="-1" aria-pressed="${val===-1}">${esc(noneLabel||t('hand.none'))}</button>`:''}</div>`;
function renderHand(){
  const g=current, P=g.players;
  let h='';
  if(g.type==='scopa'){
    h += ['carte','denari','sette','primiera'].map(k=>`<div class="pickrow"><b>${esc(t('scopa.'+k))}</b>${pickSeg(k, hd[k], k!=='sette', null, t('scopa.'+k))}</div>`).join('');
    h += `<div class="pickrow"><b>${esc(t('scopa.scope'))}</b>${P.map((p,i)=>`<div class="hrow" style="border-top:0;padding:4px 0"><span class="who" style="--c:${p.color}"><i></i><span>${esc(p.name)}</span></span>${stepper('scope',i,hd.scope[i]||0,t('scopa.scope'))}</div>`).join('')}</div>`;
  } else if(g.type==='burraco'){
    h += `<div class="teamcols">${P.map((p,i)=>`<div class="teamcol" style="--c:${p.color}"><h4><i></i><span>${esc(p.name)}</span></h4>
      <div class="field st"><span>${esc(t('bur.cl'))}<small>+200</small></span>${stepper('cl',i,hd.cl[i],t('bur.cl'))}</div>
      <div class="field st"><span>${esc(t('bur.sp'))}<small>+100</small></span>${stepper('sp',i,hd.sp[i],t('bur.sp'))}</div>
      <div class="field"><span>${esc(t('bur.tav'))}<small>+</small></span>${numIn('tav',i,hd.tav[i],{label:t('bur.tav')})}</div>
      <div class="field"><span>${esc(t('bur.man'))}<small>−</small></span>${numIn('man',i,hd.man[i],{label:t('bur.man')})}</div>
      <div class="field"><span>${esc(t('bur.pozz'))}<small>${esc(t('bur.pozz.h'))}</small></span><span class="switch"><input type="checkbox" data-pozz="${i}" ${hd.pozz[i]?'checked':''} aria-label="${esc(who(t('bur.pozz'),i))}"><span></span></span></div>
    </div>`).join('')}</div>
    <div class="pickrow" style="border-top:0;margin-top:8px"><b>${esc(t('bur.close'))} <small style="color:var(--muted);font-weight:500">+100</small></b>${pickSeg('chiusura',hd.chiusura,true,t('hand.nobody'),t('bur.close'))}</div>
    <p class="hint" style="text-align:start">${esc(t('bur.values'))}</p>`;
  } else if(g.type==='scala40'){
    const out=standings(g,hd._upto).out;
    h += P.map((p,i)=>`<div class="hrow"><span class="who" style="--c:${p.color}"><i></i><span>${esc(p.name)}</span></span>${out[i]?`<small style="color:var(--muted)">${esc(t('b.out'))}</small>`:numIn('v',i,hd.closed===i?'':hd.v[i],{disabled:hd.closed===i, label:p.name})}</div>`).join('');
    h += `<div class="pickrow"><b>${esc(t('s40.closed'))}</b>${pickSeg('closed',hd.closed,true,t('hand.nobody'),t('s40.closed'))}</div>`;
    if(g.opts.dbl) h += `<div class="opt-row" style="padding:10px 0"><label for="s40dbl"><b>${esc(t('s40.dbl'))}</b><small>${esc(t('s40.dbl.h'))}</small></label><span class="switch"><input type="checkbox" id="s40dbl" data-dbl ${hd.dbl?'checked':''}><span></span></span></div>`;
    h += `<p class="hint" style="text-align:start">${esc(t('s40.values'))}</p>`;
  } else if(g.type==='briscola'){
    h += P.map((p,i)=>`<div class="hrow"><span class="who" style="--c:${p.color}"><i></i><span>${esc(p.name)}</span></span>${numIn('v',i,hd.v[i],{label:p.name})}</div>`).join('');
    h += `<p class="hint" style="text-align:start">${esc(t('bri.auto'))} ${esc(t('bri.values'))}</p>`;
  } else {
    h += P.map((p,i)=>`<div class="hrow"><span class="who" style="--c:${p.color}"><i></i><span>${esc(p.name)}</span></span>${numIn('v',i,hd.v[i],{sign:true, label:p.name})}</div>`).join('');
  }
  $('#handBody').innerHTML=h;
  if(g.type==='briscola') briSync();
  if(g.type==='scala40') $('#handBody').querySelectorAll('[data-pick="closed"]').forEach(b=>b.disabled=standings(g,hd._upto).out[+b.dataset.v]);
  renderPreview();
}
function readFree(){ if(current.type==='free') hd.v = hd.v.map((x,i)=> x===''?'':(hd.neg[i]?-Math.abs(+x):Math.abs(+x))); }
/* Briscola: il campo "auto" (in grigio) mostra da solo quello che manca per arrivare a 120 */
const briTyped = () => hd.v.some((x,i)=> i!==hd.auto && x!=='');
function briSync(){
  const v=handValues(current, hd), typed=briTyped();
  $('#handBody').querySelectorAll('[data-in="v"]').forEach(el=>{
    const i=+el.dataset.i, a=i===hd.auto;
    el.classList.toggle('auto', a);
    if(a) el.value = typed && v[i]>=0 && v[i]<=BRI_TOTAL ? String(v[i]) : '';
    el.placeholder = a ? String(BRI_TOTAL) : '0';
  });
}
function renderPreview(){
  const g=current; readFree();
  const v=handValues(g, hd);
  if(g.type==='briscola'){
    if(!briTyped()){ $('#handPreview').innerHTML=''; return; }
    const bad=v.some(x=>x<0||x>BRI_TOTAL), w=briWinner(v);
    $('#handPreview').innerHTML = g.players.map((p,i)=>`<span style="--c:${p.color}"><i></i>${esc(p.name)}: ${num(v[i])}</span>`).join('')
      + `<span class="${bad?'warn':'res'}">${esc(bad ? t('bri.over') : w>=0 ? t('bri.handWin',{name:g.players[w].name}) : t('bri.handTie'))}</span>`;
    return;
  }
  $('#handPreview').innerHTML = g.players.map((p,i)=>`<span style="--c:${p.color}"><i></i>${esc(p.name)}: ${v[i]>0&&g.type!=='scala40'?'+':''}${num(v[i])}</span>`).join('');
}
/* cifre arabe, persiane, hindi e giapponesi (tastiere di quei paesi) → 0-9: prima venivano tolte e il campo restava vuoto */
const latinDigits = v => String(v).replace(/[٠-٩۰-۹०-९０-９]/g, c => { const x=c.charCodeAt(0); return String(x>=0xff10?x-0xff10:x>=0x966?x-0x966:x>=0x6f0?x-0x6f0:x-0x660); });
$('#handBody').addEventListener('input',e=>{
  const k=e.target.dataset.in; if(!k) return;
  const i=+e.target.dataset.i; let clean=latinDigits(e.target.value).replace(/[^\d]/g,'').slice(0,5);
  if(k==='v' && current.type==='free'){
    /* Libera: "-7" accende il tasto del segno meno; "12,5" vale 12 (la virgola e i decimali restano nel campo finché non si esce, poi spariscono) */
    const raw=latinDigits(e.target.value), m=raw.search(/[.,\u066b]/), sign=e.target.parentNode.querySelector('[data-sign]');
    if(/[-\u2212]/.test(raw) && !hd.neg[i]){ hd.neg[i]=true; if(sign) sign.setAttribute('aria-pressed','true'); }
    if(m>=0){
      const int=raw.slice(0,m).replace(/[^\d]/g,'').slice(0,5);
      if(!/[.,\u066b]/.test(e.target._shown||'')) toast(t('hand.intOnly'));
      clean=int; e.target.value=int+raw[m]+raw.slice(m+1).replace(/[^\d]/g,'').slice(0,3);
    } else if(clean!==e.target.value) e.target.value=clean;
    e.target._shown=e.target.value;
  }
  else if(clean!==e.target.value) e.target.value=clean;
  if(k==='v' && current.type==='briscola'){
    /* si scrive in un campo qualsiasi: si calcola da solo quello non toccato da più tempo */
    const n=current.players.length, c=clean.slice(0,3);
    if(c!==e.target.value) e.target.value=c;
    hd.v[i] = c==='' ? '' : +c;
    hd.ord = (hd.ord||[]).filter(x=>x!==i).concat(i);
    const keep = hd.ord.slice(-(n-1));
    if(keep.includes(hd.auto)){ const cand=[...Array(n).keys()].filter(x=>!keep.includes(x)); hd.auto=cand[cand.length-1]; hd.v[hd.auto]=''; }
    briSync(); renderPreview(); return;
  }
  if(k==='v' && current.type==='free'){ hd.v[i]= clean===''?'':(hd.neg[i]?-+clean:+clean); }
  else hd[k][i]= clean===''?'':+clean;
  renderPreview();
});
$('#handBody').addEventListener('change',e=>{
  if(e.target.dataset.in==='v' && /[.,\u066b]/.test(e.target.value)){ e.target.value=e.target.value.split(/[.,\u066b]/)[0]; e.target._shown=e.target.value; }   // Libera: via i decimali scritti
  if(e.target.dataset.pozz!=null){ hd.pozz[+e.target.dataset.pozz]=e.target.checked; renderPreview(); }
  if(e.target.dataset.dbl!=null){ hd.dbl=e.target.checked; renderPreview(); }
});
$('#handBody').addEventListener('click',e=>{
  const s=e.target.closest('[data-step]'), p=e.target.closest('[data-pick]'), sg=e.target.closest('[data-sign]');
  if(s){ const k=s.dataset.step, i=+s.dataset.i; hd[k][i]=Math.max(0,Math.min(20,(+hd[k][i]||0)+(+s.dataset.d))); s.parentNode.querySelector('output').textContent=hd[k][i]; N.vibrate([8]); renderPreview(); }
  if(p){ const k=p.dataset.pick, v=+p.dataset.v; hd[k] = (hd[k]===v && k!=='sette') ? -1 : v;
    if(k==='closed' && hd.closed>=0) hd.v[hd.closed]='';
    if(k==='chiusura' && hd.chiusura>=0) hd.pozz[hd.chiusura]=true;   // per chiudere bisogna aver preso il pozzetto
    renderHand(); }
  if(sg){ const i=+sg.dataset.sign; hd.neg[i]=!hd.neg[i]; if(hd.v[i]!=='') hd.v[i]=-hd.v[i]; sg.setAttribute('aria-pressed',hd.neg[i]); renderPreview(); }
});
function closeHand(){ $('#hand').hidden=true; hd=null; hk=null; }
$('#handCancel').addEventListener('click',closeHand);
$('#hand').addEventListener('click',e=>{ if(e.target.id==='hand') closeHand(); });
$('#handSave').addEventListener('click',()=>{
  const g=current; readFree();
  if(g.type==='scopa' && hd.sette<0){ toast(t('scopa.needSette')); return; }
  if(g.type==='burraco' && hd.chiusura>=0 && (+hd.cl[hd.chiusura]||0)+(+hd.sp[hd.chiusura]||0)<1){ toast(t('bur.needBurraco')); return; }
  if(g.type==='briscola'){
    if(!briTyped()){ toast(t('bri.needPts')); return; }
    if(handValues(g, hd).some(x=>x<0||x>BRI_TOTAL)){ toast(t('bri.over')); return; }
  }
  const v=handValues(g, hd);
  const d=JSON.parse(JSON.stringify(hd)); delete d._upto;
  if(g.type==='briscola'){ d.v=v.slice(); delete d.ord; }
  const entry={v, d};
  if(hk==null) g.hands.push(entry); else g.hands[hk]=entry;
  recompute(g);   // Scala 40: le mani successive dipendono da chi era eliminato
  saveCurrent(); closeHand(); N.vibrate([15]); renderBoard();
});
$('#handDel').addEventListener('click',e=>arm(e.currentTarget,t('hand.delConfirm'),()=>{
  const g=current, k=hk, h=g.hands[k]; g.hands.splice(k,1); recompute(g); saveCurrent(); closeHand(); renderBoard();
  toast(t('toast.handRemoved'),()=>{ if(current!==g) return; g.hands.splice(k,0,h); recompute(g); saveCurrent(); show('board'); });
}));

/* ---------- Fine partita ---------- */
let endGame=null, endFromHistory=false;
function finishGame(w){
  const g=current; if(!g) return;
  g.ended=new Date().toISOString(); g.winners=w; delete g.hold;
  games.unshift(g); saveGames();
  current=null; saveCurrent();
  N.vibrate([30,60,30]);
  openEnd(g,false);
  /* Annulla: la partita torna sul tabellone così si può correggere l'ultima mano (se nel frattempo è iniziata un'altra partita, non la tocca) */
  toast(t('toast.finished'),()=>{ if(current && current.hands.length) return; games=games.filter(x=>x.id!==g.id); saveGames(); delete g.ended; delete g.winners; g.hold=handsSig(g); current=g; saveCurrent(); show('board'); });
}
function openEnd(g, fromHistory){
  endGame=g; endFromHistory=fromHistory;
  const st=standings(g), rk=ranking(g,st), w=g.winners||[rk[0]];
  $('#eLabel').textContent = gameName(g)+' · '+fmtWhen(g.ended||g.started);
  $('#eWinner').textContent = w.length>1 ? t('end.tie') : g.players[w[0]].name;
  $('#eDetail').textContent = w.length>1 ? w.map(i=>g.players[i].name).join(' · ') : t('end.wins',{n:g.hands.length});
  const pos=positions(g,st,rk);   // a pari punti stessa posizione, come sul tabellone
  $('#eRank').innerHTML = rk.map(i=>`<li style="--c:${g.players[i].color}"><span class="p">${pos[i]}</span><i></i><span class="nm">${esc(g.players[i].name)}${st.out[i]?' · '+esc(t('b.out')):''}${st.pts?`<small> · ${esc(t('bri.pts',{p:num(st.pts[i])}))}</small>`:''}</span><b>${num(st.tot[i])}</b></li>`).join('');
  $('#eChart').innerHTML = chartSVG(g, st);
  $('#eAgain').textContent = t(fromHistory?'end.playAgain':'end.again');
  $('#eDelWrap').hidden = !fromHistory;   // si toglie dallo storico solo aprendo una partita vecchia (subito dopo la fine c'è già "Annulla")
  disarm($('#eDel'));
  show('end');
}
function chartSVG(g, st){
  const W=320, H=150, P=6, hist=st.hist, n=hist.length;
  if(n<2) return '';
  const all=hist.flat(), lo=Math.min(0,...all), hi=Math.max(1,...all, g.type==='scala40'?g.target:0);
  const x=k=>P+(W-2*P)*k/(n-1), y=v=>H-P-(H-2*P)*(v-lo)/(hi-lo||1);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('end.chart'))}">`;
  if(lo<0) s+=`<line x1="${P}" x2="${W-P}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-width="1"/>`;
  if(g.target) s+=`<line x1="${P}" x2="${W-P}" y1="${y(g.target)}" y2="${y(g.target)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>`;
  g.players.forEach((p,i)=>{
    s+=`<polyline fill="none" stroke="${p.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${hist.map((h,k)=>x(k).toFixed(1)+','+y(h[i]).toFixed(1)).join(' ')}"/>`;
  });
  return s+'</svg>';
}
$('#eClose').addEventListener('click',()=>show(endFromHistory?'history':'home'));
$('#eAgain').addEventListener('click',()=>{
  const g=endGame;
  if(GAMES[g.type].pro && !pro){ openPro('game'); return; }
  openSetup(g.type, g);
});

/* Togliere una partita dallo storico: doppio tocco ("Tocca di nuovo") e poi "Annulla" per qualche secondo */
$('#eDel').addEventListener('click',e=>arm(e.currentTarget,t('b.undoConfirm'),()=>{
  const g=endGame, k=games.indexOf(g); if(k<0) return;
  games.splice(k,1); saveGames(); show('history');
  toast(t('toast.gameDeleted'),()=>{ if(games.some(x=>x.id===g.id)) return; const w=x=>x.ended||x.started||''; let j=games.findIndex(x=>w(x)<w(g)); if(j<0) j=games.length; games.splice(j,0,g); saveGames(); if(view==='history') renderHistory(); });
}));

/* ---------- Storico ---------- */
function renderHistory(){
  const shown = pro ? games : games.slice(0,FREE_HISTORY), hidden=games.length-shown.length;
  $('#hList').innerHTML = !games.length ? `<li class="empty">${esc(t('h.empty'))}</li>` :
    shown.map(g=>{ const w=(g.winners||[]).map(i=>g.players[i]&&g.players[i].name).join(', ');
      return `<li><button class="hg" data-game-id="${g.id}"><span><span class="h-name">${esc(gameName(g))}</span><small>${esc(fmtWhen(g.ended||g.started))} · ${esc(g.players.map(p=>p.name).join(', '))}</small></span><span class="h-win">${esc(w)}<small>${esc(t('h.won'))}</small></span></button></li>`; }).join('')
    + (hidden>0 ? `<li class="older"><small>${esc(t('h.older',{n:hidden}))}</small><br><button class="link" data-pro-history>${lockSVG}${esc(t('h.olderBtn'))}</button></li>` : '');
  // Statistiche per giocatore (Pro)
  const sw=$('#statsWrap');
  if(!games.length){ sw.innerHTML=''; return; }
  if(!pro){ sw.innerHTML=`<div class="section-head"><h2>${esc(t('h.stats'))}</h2></div><div class="panel empty">${lockSVG} ${esc(t('h.statsPro'))} <button class="link" data-pro-history>${esc(t('set.pro.btn'))}</button></div>`; return; }
  const m=new Map();
  games.forEach(g=>g.players.forEach((p,i)=>{ const k=p.name.trim().toLowerCase(); const r=m.get(k)||{name:p.name,played:0,won:0}; r.played++; if((g.winners||[]).includes(i)) r.won++; m.set(k,r); }));
  const rows=[...m.values()].sort((a,b)=>b.won-a.won||b.played-a.played).slice(0,30);
  sw.innerHTML=`<div class="section-head"><h2>${esc(t('h.stats'))}</h2></div><div class="panel"><table class="stats"><thead><tr><th>${esc(t('h.player'))}</th><th>${esc(t('h.played'))}</th><th>${esc(t('h.wins'))}</th><th>%</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.played}</td><td>${r.won}</td><td>${Math.round(r.won/r.played*100)}</td></tr>`).join('')}</tbody></table></div>`;
}
document.addEventListener('click',e=>{ if(e.target.closest('[data-pro-history]')) openPro('history'); });
$('#hList').addEventListener('click',e=>{ const b=e.target.closest('[data-game-id]'); if(b){ const g=games.find(x=>x.id===b.dataset.gameId); if(g) openEnd(g,true); } });

/* ---------- Dado e "chi inizia" ---------- */
let diceN=2;
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function dieHTML(v){ return `<div class="die roll">${[...Array(9).keys()].map(k=>`<i class="${PIPS[v].includes(k)?'on':''}"></i>`).join('')}</div>`; }
function renderDice(vals){
  $('#diceN').innerHTML=[1,2].map(n=>`<button data-dn="${n}" aria-pressed="${diceN===n}">${esc(t(n===1?'dice.one':'dice.two'))}</button>`).join('');
  if(vals){ $('#dice').innerHTML=vals.map(dieHTML).join(''); $('#diceSum').textContent = vals.length>1 ? '= '+vals.reduce((a,b)=>a+b,0) : ''; }
}
$('#bDice').addEventListener('click',()=>{ $('#diceMsg').textContent=''; renderDice(Array(diceN).fill(6)); $('#dice').querySelectorAll('.die').forEach(d=>d.classList.remove('roll')); $('#diceSum').textContent=''; $('#diceRoll').innerHTML=esc(t('dice.roll'))+(pro?'':lockSVG); $('#diceSheet').hidden=false; });
$('#diceN').addEventListener('click',e=>{ const b=e.target.closest('[data-dn]'); if(b){ diceN=+b.dataset.dn; renderDice(Array(diceN).fill(6)); } });
$('#diceRoll').addEventListener('click',()=>{
  if(!pro){ $('#diceSheet').hidden=true; openPro('dice'); return; }
  const r=()=>1+Math.floor((crypto.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]/4294967296:Math.random())*6);
  renderDice(Array.from({length:diceN},r)); N.vibrate([20]);
});
$('#diceFirst').addEventListener('click',()=>{
  if(!current) return;
  const st=standings(current), alive=current.players.map((p,i)=>i).filter(i=>!st.out[i]);
  const i=alive[Math.floor(Math.random()*alive.length)];
  $('#diceMsg').textContent=t('dice.firstIs',{name:current.players[i].name});
  if(!current.hands.length){ current.firstDealer=i; saveCurrent(); renderBoard(); }
  N.vibrate([20]);
});
const closeDice=()=>{ $('#diceSheet').hidden=true; };
$('#diceClose').addEventListener('click',closeDice);
$('#diceSheet').addEventListener('click',e=>{ if(e.target.id==='diceSheet') closeDice(); });

/* ---------- Impostazioni ---------- */
const seg = (key, opts, val, label) => `<div class="seg" role="group"${label?` aria-label="${esc(label)}"`:''}>${opts.map(([v,label])=>`<button data-seg="${key}" data-v="${v}" aria-pressed="${v===val}">${esc(label)}</button>`).join('')}</div>`;
function renderSettings(){
  const proRow = pro
    ? `<div class="pro-row"><div><b>${esc(t('set.pro.on'))}</b><small>${esc(t('set.pro.on.h'))}</small></div></div>`
    : `<div class="pro-row"><div><b>${esc(t('set.pro.off'))}</b><small>${esc(t('set.pro.off.h'))}</small></div><button class="btn primary" id="setPro">${esc(t('set.pro.btn'))}</button></div>`;
  const acc = pro ? settings.accent : 'green';
  $('#settingsPanel').innerHTML =
    `<div class="toggle"><b>${esc(t('set.lang'))}</b><select class="sel" data-sel="lang" aria-label="${esc(t('set.lang'))}">${['auto'].concat(LANGS).map(l=>`<option value="${l}"${l===(LANGS.includes(settings.lang)?settings.lang:'auto')?' selected':''}${l==='auto'?'':` lang="${l}"`}>${esc(l==='auto'?t('opt.auto'):I18N[l]._.name)}</option>`).join('')}</select></div>`
    + `<div class="toggle"><b>${esc(t('set.theme'))}</b>${seg('theme',[['auto',t('opt.auto')],['light',t('opt.light')],['dark',t('opt.dark')]],settings.theme,t('set.theme'))}</div>`
    + `<div class="toggle"><label for="set-awake"><b>${esc(t('set.awake'))}</b><small>${esc(t('set.awake.h'))}</small></label><span class="switch"><input type="checkbox" id="set-awake" data-set="awake" ${settings.awake?'checked':''}><span></span></span></div>`
    + `<div class="toggle col"><b>${esc(t('set.accent'))}</b><div class="chips" role="group" aria-label="${esc(t('set.accent'))}">${Object.entries(ACCENTS).map(([k,c])=>
        `<button class="chip" data-accent="${k}" aria-pressed="${k===acc}" aria-label="${esc(t('accent.'+k))}${!pro&&k!=='green'?' – '+esc(t('set.locked')):''}" style="--c:${isDark()?c[1]:c[0]}"><i></i>${!pro&&k!=='green'?lockSVG:''}</button>`).join('')}</div></div>`
    + `<div class="toggle" style="padding:0">${proRow}</div>`;
  const pb=$('#setPro'); if(pb) pb.addEventListener('click',()=>openPro());
  $('#dataPanel').innerHTML =
    `<button class="rowbtn" data-act="csv"><span>${esc(t('data.csv'))}${pro?'':lockSVG}<small>${esc(t('data.csv.h'))}</small></span><span class="arr">›</span></button>`
    + `<button class="rowbtn" data-act="export"><span>${esc(t('data.export'))}<small>${esc(t('data.export.h'))}</small></span><span class="arr">›</span></button>`
    + `<button class="rowbtn" data-act="import"><span>${esc(t('data.import'))}<small>${esc(t('data.import.h'))}</small></span><span class="arr">›</span></button>`;
  $('#ver').textContent=VERSION;
}
$('#settingsPanel').addEventListener('change',e=>{
  if(e.target.dataset.sel==='lang'){ settings.lang=e.target.value; saveSettings(); renderAll(); }
  if(e.target.dataset.set){ settings[e.target.dataset.set]=e.target.checked; saveSettings(); }
});
$('#settingsPanel').addEventListener('click',e=>{
  const s=e.target.closest('[data-seg]'), a=e.target.closest('[data-accent]');
  if(s){ settings[s.dataset.seg]=s.dataset.v; saveSettings(); applyTheme(); renderSettings(); }
  else if(a){ if(!pro && a.dataset.accent!=='green'){ openPro('style'); return; } settings.accent=a.dataset.accent; saveSettings(); applyTheme(); renderSettings(); }
});

/* ---------- Esportazione dello storico (CSV) e backup ---------- */
const pad2 = n => String(n).padStart(2,'0');
/* data e ora locali scritte come 2026-11-15 21:30: Excel e Fogli le riconoscono come data in ogni lingua */
function localStamp(iso){ const d=new Date(iso); if(isNaN(d)) return ''; return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes()); }
const today = () => localStamp(new Date().toISOString()).slice(0,10);
/* Separatore delle colonne come lo vuole Excel nella lingua scelta: ";" dove i decimali hanno la virgola (italiano, tedesco, francese…), "," altrove */
function csvSep(){ try{ return new Intl.NumberFormat(locale()).format(1.5).includes(',') ? ';' : ','; }catch(e){ return ';'; } }
/* CSV: una riga per mano. Per ogni posto al tavolo tre colonne: nome, punti della mano, totale dopo la mano.
   L'ultima riga di ogni partita ha quindi i totali finali; "Vincitore" è ripetuto su tutte le righe per poter filtrare. */
function buildCSV(list, sep){
  sep = sep || csvSep();
  const cell = x => {
    if(typeof x==='number') return String(x);
    let s=String(x==null?'':x);
    if(/^[=+\-@\t\r]/.test(s)) s="'"+s;           // un nome come "=1+1" non deve diventare una formula
    return (s.includes(sep) || /["\r\n]/.test(s)) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const gs=list.slice().sort((a,b)=> String(a.started||'') < String(b.started||'') ? -1 : 1);   // dalla più vecchia
  const maxP=Math.max(1,...gs.map(g=>g.players.length));
  const head=[t('csv.game'), t('csv.date'), t('csv.type'), t('csv.hand')];
  for(let k=1;k<=maxP;k++) head.push(t('csv.player',{n:k}), t('csv.points',{n:k}), t('csv.total',{n:k}));
  head.push(t('csv.winner'));
  const rows=[head];
  gs.forEach((g,gi)=>{
    const st=standings(g), win=(g.winners||[]).map(i=>g.players[i]&&g.players[i].name).filter(Boolean).join(' / ');
    const name=gameName(g)+(!g.target ? '' : g.type==='briscola' ? ' '+briLabel(g.target) : ' '+g.target), when=localStamp(g.started||g.ended);
    g.hands.forEach((h,k)=>{
      const r=[gi+1, when, name, k+1];
      for(let i=0;i<maxP;i++){
        /* Briscola: "Punti" = punti delle carte nella mano, "Totale" = somma dei punti (le mani vinte si vedono dal vincitore di ogni riga) */
        if(i<g.players.length) r.push(g.players[i].name, +h.v[i]||0, (st.ptsHist||st.hist)[k+1][i]);
        else r.push('','','');
      }
      r.push(win); rows.push(r);
    });
  });
  return '\uFEFF' + rows.map(r=>r.map(cell).join(sep)).join('\r\n') + '\r\n';   // \uFEFF (BOM) = Excel legge bene gli accenti
}
/* Formato del backup: se cambia, alzare BACKUP_VERSION (i backup più nuovi vengono rifiutati con un messaggio) */
const BACKUP_VERSION = 1;
function buildBackup(){
  return {app:'simple-score', version:BACKUP_VERSION, appVersion:VERSION, exported:new Date().toISOString(),
    games, current, players:recent, settings:{lang:settings.lang, theme:settings.theme, accent:settings.accent, awake:settings.awake}};
}
/* Legge un backup e lo controlla. Restituisce i dati puliti, {newer:true} se viene da una versione più nuova, {other:'Simple Fuel'} se è il backup di un'altra app, oppure null se il file non va bene. Il Pro non si ripristina da file (dipende dall'acquisto). */
function parseBackup(text){
  let d=null; try{ d=JSON.parse(String(text).replace(/^\uFEFF/,'')); }catch(e){ return null; }
  if(d && typeof d==='object' && typeof d.app==='string' && /^simple-[a-z]{2,20}$/.test(d.app) && d.app!=='simple-score')
    return {other:'Simple '+d.app[7].toUpperCase()+d.app.slice(8)};   // backup di un'altra app Simple Apps: si dice quale
  if(!d || typeof d!=='object' || d.app!=='simple-score' || !Array.isArray(d.games)) return null;
  if(Number(d.version) > BACKUP_VERSION) return {newer:true};
  const copy = x => JSON.parse(JSON.stringify(x));
  const gs=d.games.filter(validGame).map(g=>normGame(copy(g)));
  if(d.games.length && !gs.length) return null;
  const cur = validGame(d.current) ? normGame(copy(d.current)) : null;
  const pl = Array.isArray(d.players) ? d.players.filter(x=>typeof x==='string').slice(0,20) : [];
  const s0 = (d.settings && typeof d.settings==='object') ? d.settings : {}, se={};
  if(s0.lang==='auto' || LANGS.includes(s0.lang)) se.lang=s0.lang;
  if(['auto','light','dark'].includes(s0.theme)) se.theme=s0.theme;
  if(Object.prototype.hasOwnProperty.call(ACCENTS,s0.accent)) se.accent=s0.accent;
  if(typeof s0.awake==='boolean') se.awake=s0.awake;
  return {games:gs, current:cur, players:pl, settings:se, exported:typeof d.exported==='string'?d.exported:''};
}
function restoreBackup(b){
  const old={games, current, recent, settings:{...settings}};
  const apply = x => {
    games=x.games; current=x.current; recent=x.recent; settings=Object.assign({}, settings, x.settings);
    saveGames(); saveCurrent(); store.set('sc.players', recent); saveSettings();
    applyTheme(); renderAll();
  };
  apply({games:b.games, current:b.current, recent:b.players, settings:b.settings});
  toast(t('data.restored'), ()=>apply(old));
}
/* Finestra di conferma */
let confirmFn=null;
function askConfirm(title, text, warn, okLabel, fn){
  $('#confirmTitle').textContent=title; $('#confirmText').textContent=text; $('#confirmWarn').textContent=warn||''; $('#confirmWarn').hidden=!warn;
  $('#confirmYes').textContent=okLabel; confirmFn=fn; $('#confirm').hidden=false; $('#confirmNo').focus();
}
function closeConfirm(){ $('#confirm').hidden=true; confirmFn=null; }
$('#confirmNo').addEventListener('click',closeConfirm);
$('#confirm').addEventListener('click',e=>{ if(e.target.id==='confirm') closeConfirm(); });
$('#confirmYes').addEventListener('click',()=>{ const f=confirmFn; closeConfirm(); if(f) f(); });

$('#dataPanel').addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]'); if(!b) return;
  const a=b.dataset.act;
  if(a==='csv'){
    if(!pro){ openPro('export'); return; }
    if(!games.length){ toast(t('data.none')); return; }
    const r=await N.saveFile(`simple-score-${today()}.csv`, buildCSV(games), 'text/csv;charset=utf-8');
    if(r==='error') toast(t('data.error'));
  }
  if(a==='export'){
    const r=await N.saveFile(`simple-score-backup-${today()}.json`, JSON.stringify(buildBackup()), 'application/json');
    if(r==='error') toast(t('data.error'));
  }
  if(a==='import'){ $('#importFile').value=''; $('#importFile').click(); }
});
$('#importFile').addEventListener('change',async()=>{
  const f=$('#importFile').files[0]; if(!f) return;
  $('#importFile').value='';   // così si può scegliere di nuovo lo stesso file
  let b=null;
  if(f.size < 20*1024*1024){ try{ b=parseBackup(await f.text()); }catch(e){ b=null; } }
  if(!b){ toast(t('data.bad')); return; }
  if(b.newer){ toast(t('data.newer')); return; }
  if(b.other){ toast(t('data.other',{app:b.other})); return; }
  const when = b.exported ? fmtWhen(b.exported) : '?';
  let text = t('data.confirm.text',{date:when, n:b.games.length});
  if(b.current) text += ' ' + t('data.confirm.current');
  askConfirm(t('data.confirm.title'), text, t('data.confirm.warn'), t('data.confirm.ok'), ()=>restoreBackup(b));
});

/* ---------- Tasto Indietro ---------- */
function goBack(){
  if(!$('#confirm').hidden){ closeConfirm(); return true; }
  if(!$('#pro').hidden){ closePro(); return true; }
  if(!$('#hand').hidden){ closeHand(); return true; }
  if(!$('#diceSheet').hidden){ closeDice(); return true; }
  if(view==='end' && endFromHistory){ show('history'); return true; }
  if(view!=='home'){ show('home'); return true; }
  return false;
}
N.onBack(goBack);
document.addEventListener('keydown',e=>{ if(e.key==='Escape') goBack(); });

/* ---------- Avvio ---------- */
function renderAll(){
  applyLang();
  $('#topSub').textContent=t('sub.'+view);
  if(view==='home') renderHome();
  if(view==='board') renderBoard();
  if(view==='setup' && draft) renderSetup();
  if(view==='history') renderHistory();
  if(view==='settings') renderSettings();
  if(view==='end' && endGame) openEnd(endGame,endFromHistory);
  $('#proTag').hidden=!pro;
}
N.onResume(()=>{ N.billing.refresh(); if(view==='board') N.keepAwake(settings.awake); });
applyLang(); applyTheme();
show(current ? 'board' : 'home');
N.billing.init(setPro);

/* Per le prove automatiche (Playwright) */
window.__score = {handValues, standings, briWinner, ranking, positions, winners, dealerOf, recompute, buildCSV, buildBackup, parseBackup, get current(){ return current; }, get games(){ return games; }};
})();
