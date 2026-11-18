/* Collegamento con le funzioni del telefono quando Simple Score gira come app (Capacitor).
   Nel browser queste funzioni non fanno nulla, o usano l'equivalente web. */
(function(){
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = (isNative && Cap.Plugins) || {};
  const PRO_ID = 'score_pro';            // ID del prodotto da creare in Google Play Console

  /* Schermo sempre acceso durante la partita */
  let wl = null, wantAwake = false;
  async function keepAwake(on){
    wantAwake = !!on;
    if(isNative && P.KeepAwake){
      try{ on ? await P.KeepAwake.keepAwake() : await P.KeepAwake.allowSleep(); }catch(e){}
      return;
    }
    try{
      if(on){ if(navigator.wakeLock && !wl){ wl = await navigator.wakeLock.request('screen'); wl.addEventListener && wl.addEventListener('release',()=>{ wl = null; }); } }
      else { const w = wl; wl = null; w && w.release(); }
    }catch(e){ wl = null; }
  }
  /* Nel browser il blocco dello schermo si perde quando si cambia app: lo si richiede al ritorno */
  if(!isNative) document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && wantAwake && !wl) keepAwake(true); });

  /* Vibrazione: pattern [vibra, pausa, vibra, ...] in millisecondi */
  function vibrate(pattern){
    if(isNative && P.Haptics){
      let t = 0;
      for(let i=0;i<pattern.length;i+=2){
        const d = pattern[i];
        setTimeout(()=>{ P.Haptics.vibrate({duration:d}).catch(()=>{}); }, t);
        t += d + (pattern[i+1]||0);
      }
      return;
    }
    try{ navigator.vibrate && navigator.vibrate(pattern); }catch(e){}
  }

  /* Colore delle icone nella barra di stato: dark = sfondo scuro (icone chiare) */
  function setBars(darkBackground){
    if(!isNative || !P.SystemBars) return;
    try{ P.SystemBars.setStyle({style: darkBackground ? 'DARK' : 'LIGHT'}).catch(()=>{}); }catch(e){}
  }

  /* Tasto Indietro di Android: handler() restituisce true se l'ha gestito */
  function onBack(handler){
    if(!isNative || !P.App) return;
    P.App.addListener('backButton', ()=>{ if(!handler()) P.App.exitApp(); });
  }
  function onResume(fn){
    if(!isNative || !P.App) return;
    P.App.addListener('resume', fn);
  }

  /* ---------- Salvataggio di un file (storico CSV, backup) ----------
     Sul telefono: il file va nella cache dell'app e si apre la finestra "Condividi" di Android
     (Drive, email, WhatsApp, "Salva nei file"...). Nel browser: download normale.
     Risultato: 'ok' | 'cancelled' | 'error' */
  async function saveFile(name, text, mime){
    if(isNative && P.Filesystem && P.Share){
      try{
        const w = await P.Filesystem.writeFile({path:name, data:text, directory:'CACHE', encoding:'utf8'});
        await P.Share.share({title:'Simple Score', url:w.uri, dialogTitle:name});
        return 'ok';
      }catch(e){
        const msg = String((e && (e.message||e.code)) || e).toLowerCase();
        return msg.includes('cancel') ? 'cancelled' : 'error';
      }
    }
    try{
      const blob = new Blob([text], {type: mime||'text/plain'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return 'ok';
    }catch(e){ return 'error'; }
  }

  /* ---------- Acquisto unico "Simple Score Pro" (Google Play Billing) ---------- */
  const NP = P.NativePurchases;
  const billing = {
    available: isNative && !!NP,
    price: null,
    async init(setPro){
      if(!this.available) return;
      this._setPro = setPro;
      try{
        const r = await NP.getProducts({productIdentifiers:[PRO_ID], productType:'inapp'});
        const p = r && r.products && r.products[0];
        if(p && p.priceString) this.price = p.priceString;
      }catch(e){}
      await this.refresh();
    },
    owned(list){
      return (list||[]).filter(p => p.productIdentifier===PRO_ID && (p.purchaseState==null || String(p.purchaseState)==='1'));
    },
    /* Controlla gli acquisti di questo account Google. Restituisce true/false, o null se non si può sapere (offline) */
    async refresh(){
      if(!this.available) return null;
      try{
        const r = await NP.getPurchases({productType:'inapp'});
        const mine = this.owned(r && r.purchases);
        for(const p of mine){
          if(p.isAcknowledged===false){
            try{ await NP.acknowledgePurchase({purchaseToken: p.purchaseToken || p.transactionId}); }catch(e){}
          }
        }
        const has = mine.length>0;
        this._setPro && this._setPro(has);
        return has;
      }catch(e){ return null; }
    },
    /* Risultato: 'ok' | 'pending' | 'cancelled' | 'error' */
    async buy(){
      if(!this.available) return 'error';
      try{
        const tx = await NP.purchaseProduct({productIdentifier:PRO_ID, productType:'inapp', quantity:1});
        if(tx && (tx.purchaseState==null || String(tx.purchaseState)==='1')){ this._setPro && this._setPro(true); return 'ok'; }
        return 'pending';
      }catch(e){
        /* il plugin rifiuta con testo generico ("Purchase is not purchased") e il motivo nel codice (USER_CANCELED, ITEM_ALREADY_OWNED): si leggono entrambi */
        const msg = (String((e && e.message) || e) + ' ' + String((e && e.code) || '')).toLowerCase();
        if(msg.includes('pending')) return 'pending';
        if(msg.includes('cancel')) return 'cancelled';
        if(msg.includes('already') || msg.includes('owned')){ const h = await this.refresh(); return h ? 'ok' : 'error'; }
        return 'error';
      }
    },
    /* Risultato: 'ok' | 'none' | 'error' */
    async restore(){
      if(!this.available) return 'error';
      try{ await NP.restorePurchases(); }catch(e){}
      const h = await this.refresh();
      return h===null ? 'error' : (h ? 'ok' : 'none');
    }
  };

  window.Native = {isNative, keepAwake, vibrate, setBars, onBack, onResume, saveFile, billing};
})();
