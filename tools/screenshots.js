/* Screenshot dello store di Simple Score (1080×1920, italiano e inglese).
   Uso:  npm run serve   (in un'altra finestra)   poi   node tools/screenshots.js
   Carica partite di esempio inventate, fotografa l'app in un telefono simulato e compone ogni immagine
   con titolo e cornice (stesso stile delle altre app Simple Apps).
   Risultato: store/screenshots-it/1…6.png e store/screenshots-en/1…6.png.
   Dal 23/11/2026 anche nelle altre 12 lingue (store/screenshots-<codice>, codici come in store/lingue/): titoli e nomi in
   tools/store-lingue.js, caratteri e titolo in tools/store-grafica.js. Solo alcune lingue: node tools/screenshots.js de ja
   Per cambiare un titolo: modifica SHOTS qui sotto e rilancia lo script. */
let pw; try{ pw=require('playwright'); }catch(e){ pw=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright'); }
const fs=require('fs'), path=require('path');
const G=require('./store-grafica.js'), LANGS=require('./store-lingue.js');
global.window={}; require('../www/js/i18n.js'); const I18N=window.I18N;
const URL=process.env.URL||'http://localhost:8766/';
const ROOT=path.join(__dirname,'..');
const COLORS=['#17804f','#2457c5','#c8321f','#c98a00'];

/* ---------- Titoli delle immagini ---------- */
const SHOTS={
  it:['Il punteggio, grande e chiaro','Briscola: l’altra squadra si calcola da sola','Burraco: i conti li fa l’app','Scopa in pochi tocchi','Chi vince, anche a notte fonda','Storico e statistiche'],
  en:['Big, clear scores','Briscola: the other side adds up by itself','Burraco: the app does the maths','Scopa in a few taps','Who won, even late at night','History and statistics']
};

/* ---------- Partite di esempio (inventate) ---------- */
function sample(lang){
  const en=lang==='en';
  const X=LANGS[lang];
  const N=X?{a:X.names[0],b:X.names[1],c:X.names[2],d:X.names[3],us:I18N[lang]['su.us'],them:I18N[lang]['su.them']}
    :en?{a:'Anna',b:'Ben',c:'Clara',d:'David',us:'Us',them:'Them'}:{a:'Anna',b:'Bruno',c:'Carla',d:'Dario',us:'Noi',them:'Voi'};
  const pl=names=>names.map((name,i)=>({name, color:COLORS[i]}));
  const when=(daysAgo,h,m)=>{ const d=new Date(); d.setDate(d.getDate()-daysAgo); d.setHours(h,m,0,0); return d.toISOString(); };
  const game=(id,type,names,target,hands,extra)=>Object.assign({id, type, players:pl(names), target, opts:{low:false,reentry:false,dbl:false}, firstDealer:0, hands:hands.map(v=>({v, d:{v}})), started:when(0,21,5)}, extra||{});
  /* Libero a 300 in quattro: Anna 145, Bruno 130, Carla 130, Dario 120 dopo 5 mani */
  const libero=game('lib','free',[N.a,N.b,N.c,N.d],300,[[30,20,40,15],[25,35,10,30],[40,15,30,20],[20,30,25,35],[30,30,25,20]]);
  const briscola=game('bri','briscola',[N.us,N.them],2,[[68,52]]);
  const burraco=game('bur','burraco',[N.us,N.them],2005,[[540,385],[320,610]]);
  const scopa=game('sco','scopa',[N.us,N.them],11,[[3,2],[2,4]]);
  /* Storico: partite finite negli ultimi giorni */
  const done=(id,type,names,target,hands,w,daysAgo,h,m)=>game(id,type,names,target,hands,{started:when(daysAgo,h,m-40), ended:when(daysAgo,h,m), winners:w});
  const games=[
    done('g1','briscola',[N.a,N.b],2,[[71,49],[55,65],[80,40]],[0],1,22,14),
    done('g2','free',[N.a,N.b,N.c,N.d],300,[[90,60,80,70],[120,100,60,90],[95,20,40,90]],[0],2,21,56),
    done('g3','scopa',[N.a,N.b],11,[[4,2],[3,3],[5,1]],[0],3,14,44),
    done('g4','burraco',[N.d,N.b],2005,[[620,410],[700,850],[720,610]],[0],4,23,32),
    done('g5','scala40',[N.a,N.b,N.c,N.d],101,[[0,35,60,20],[25,0,45,15],[10,40,0,70]],[0],6,0,20),
    done('g6','scopa',[N.c,N.b],11,[[2,4],[3,4],[1,4]],[1],8,17,8)
  ];
  return {libero, briscola, burraco, scopa, games, players:[N.a,N.b,N.c,N.d]};
}

const SCALE=2.2, VW=390, VH=Math.ceil((1920-576)/SCALE)+4;
async function capture(browser, lang, i){
  const dark=i===5, S=sample(lang);
  const cur = i===2 ? S.briscola : i===3 ? S.burraco : i===4 ? S.scopa : i===6 ? null : S.libero;
  const data={'sc.current':cur, 'sc.games':S.games, 'sc.players':S.players, 'sc.pro':true,
    'sc.settings':{lang, theme:dark?'dark':'light', accent:'green', awake:true}};
  const ctx=await browser.newContext({viewport:{width:VW,height:VH}, deviceScaleFactor:SCALE, locale:G.LINGUE[lang]?G.LINGUE[lang].locale:lang==='en'?'en-GB':'it-IT', timezoneId:G.LINGUE[lang]?G.LINGUE[lang].tz:'Europe/Rome', colorScheme:dark?'dark':'light'});
  await ctx.addInitScript(d=>{ if(!sessionStorage.getItem('s')){ localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); sessionStorage.setItem('s','1'); } }, data);
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto(URL); await p.waitForTimeout(500);
  await p.addStyleTag({content:'.toast{display:none!important} *{caret-color:transparent!important} .sheet-card{animation:none!important}'+G.phoneCSS(lang,'Barlow')});
  const type=async(sel,v)=>{ await p.fill(sel,String(v)); };
  if(i===2){
    await p.click('#bAdd'); await p.waitForTimeout(150);
    await type('[data-in="v"][data-i="0"]',81);
  } else if(i===3){
    await p.click('#bAdd'); await p.waitForTimeout(150);
    await p.click('[data-step="cl"][data-i="0"][data-d="1"]'); await p.click('[data-step="sp"][data-i="1"][data-d="1"]');
    await type('[data-in="tav"][data-i="0"]',145); await type('[data-in="man"][data-i="0"]',0);
    await type('[data-in="tav"][data-i="1"]',95); await type('[data-in="man"][data-i="1"]',35);
    await p.click('[data-pick="chiusura"][data-v="0"]');
    await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
  } else if(i===4){
    await p.click('#bAdd'); await p.waitForTimeout(150);
    for(const [k,v] of [['carte',0],['denari',0],['sette',1],['primiera',0]]) await p.click(`[data-pick="${k}"][data-v="${v}"]`);
    await p.click('[data-step="scope"][data-i="0"][data-d="1"]');
  } else if(i===5){
    /* ultima mano: Anna arriva a 305 e la partita finisce */
    await p.click('#bAdd'); await p.waitForTimeout(150);
    for(const [k,v] of [[0,160],[1,50],[2,50],[3,130]]) await type(`[data-in="v"][data-i="${k}"]`,v);
    await p.click('#handSave'); await p.waitForTimeout(300);
  } else if(i===6){
    await p.click('.tab[data-tab="home"]'); await p.click('.tab[data-tab="history"]');
    /* si scorre quanto basta per vedere anche le statistiche */
    await p.evaluate(()=>{ const s=document.querySelector('#statsWrap'); const y=s.getBoundingClientRect().bottom+window.scrollY-innerHeight+20; if(y<=0) return;
      /* senza tagliare a metà una partita dell'elenco */
      const li=[...document.querySelectorAll('#hList li')].map(e=>e.getBoundingClientRect().top+window.scrollY-10).find(t=>t>=y);
      window.scrollTo(0, li!=null ? li : y); });
  }
  await p.waitForTimeout(300);
  const buf=await p.screenshot({type:'png'});
  await ctx.close();
  if(errs.length) console.log('  errori in console:', errs);
  return buf;
}

async function compose(browser, lang, i, shot){
  const font=f=>'data:font/woff2;base64,'+fs.readFileSync(path.join(ROOT,'www/fonts',f)).toString('base64');
  const X=LANGS[lang], L=G.LINGUE[lang], hs=G.headStyle(lang);
  const raw=X?X.shots[i-1]:SHOTS[lang][i-1];
  const title=X?raw.split('|').map(t=>G.esc(t.toLocaleUpperCase(L.locale))).join('<br>'):raw.toUpperCase();
  const html=X?`<!doctype html><html dir="${L.rtl?'rtl':'ltr'}"><head><meta charset="utf-8"><style>
    ${G.headFonts(path.join(ROOT,'www'))}
    html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b100d}
    h1{position:absolute;${L.rtl?'right':'left'}:80px;top:112px;width:920px;margin:0;font:900 ${hs.size}px/${hs.lh} ${hs.family},sans-serif;color:#fff;letter-spacing:.005em;text-wrap:balance${lang==='ko'?';word-break:keep-all':''}${lang==='zh'||lang==='ja'?';white-space:nowrap':''}}
    h1 i{display:inline-block;width:.18em;height:.18em;background:#3fcf8a;margin-inline-start:.06em}
    .phone{position:absolute;left:110px;top:560px;width:892px;height:1500px;background:#000;border-radius:66px;box-shadow:0 0 0 2px #1d2620}
    .screen{position:absolute;left:16px;top:16px;width:860px;height:1440px;border-radius:52px;overflow:hidden;background:#eef2ef}
    .screen img{display:block;width:858px}
  </style></head><body><h1 id="t" data-lh="${hs.lh}" data-size="${hs.size}">${title}<i></i></h1><div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}"></div></div></body></html>`
  :`<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:BS;src:url(${font('big-shoulders-display-latin-900-normal.woff2')});font-weight:900}
    html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b100d}
    h1{position:absolute;left:80px;top:112px;width:920px;margin:0;font:900 124px/0.92 BS;color:#fff;letter-spacing:.005em}
    h1 i{display:inline-block;width:.18em;height:.18em;background:#3fcf8a;margin-left:.06em}
    .phone{position:absolute;left:110px;top:560px;width:892px;height:1500px;background:#000;border-radius:66px;box-shadow:0 0 0 2px #1d2620}
    .screen{position:absolute;left:16px;top:16px;width:860px;height:1440px;border-radius:52px;overflow:hidden;background:#eef2ef}
    .screen img{display:block;width:858px}
  </style></head><body><h1>${title}<i></i></h1><div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}"></div></div></body></html>`;
  const ctx=await browser.newContext({viewport:{width:1080,height:1920}, deviceScaleFactor:1});
  const p=await ctx.newPage(); await p.setContent(html); await p.waitForTimeout(300);
  if(X){ await p.evaluate(()=>document.fonts.ready); console.log('  '+lang+' '+i+': '+await G.fitTitle(p,3)); }
  const h=await p.evaluate(()=>document.querySelector('h1').getBoundingClientRect().bottom);
  if(h>530) console.log('  attenzione: titolo troppo lungo ('+Math.round(h)+'px), tocca la cornice');
  const dir=path.join(ROOT,'store','screenshots-'+(L?L.dir:lang)); fs.mkdirSync(dir,{recursive:true});
  const out=path.join(dir, i+'.png');
  await p.screenshot({path:out}); await ctx.close();
  console.log('✓', path.relative(ROOT,out));
}

if(require.main===module){
  (async()=>{
    const browser=await pw.chromium.launch();
    const want=process.argv.slice(2), all=['it','en',...Object.keys(LANGS)];
    for(const lang of want.length?all.filter(l=>want.includes(l)):all) for(let i=1;i<=6;i++) await compose(browser, lang, i, await capture(browser, lang, i));
    await browser.close();
  })();
}
module.exports={sample};
