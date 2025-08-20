// app.js — UI + dealing + drill logic (iOS-safe)
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ---- Safe storage helpers (avoid Safari Private mode crashes) ----
  const SafeStorage = {
    get(key){
      try { return localStorage.getItem(key); } catch(e){ return null; }
    },
    set(key, val){
      try { localStorage.setItem(key, val); } catch(e){ /* ignore */ }
    }
  };

  const state = {
    opts: { decks: 6, s17: 'S17', das: true, lateSurrender: true, peek: true },
    shoe: [], discard: [],
    // Strategy stats
    sHands: 0, sCorrect: 0, sStreak: 0, sBestStreak: 0,
    // Counting
    streamTimer: null, running: 0, totalDecks: 6, streamActive: false,
    // Progress
    flashBest: 0,
  };

  // --- Storage helpers ---
  function saveProgress(){
    const payload = { sHands: state.sHands, sCorrect: state.sCorrect, sBestStreak: state.sBestStreak, flashBest: state.flashBest };
    SafeStorage.set('bj_trainer_progress', JSON.stringify(payload));
  }
  function loadProgress(){
    try {
      const p = JSON.parse(SafeStorage.get('bj_trainer_progress') || '{}');
      state.sHands = p.sHands||0; state.sCorrect = p.sCorrect||0; state.sBestStreak = p.sBestStreak||0; state.flashBest = p.flashBest||0;
    } catch(e){}
  }
  function updateProgressUI(){
    $('#p_total').textContent = state.sHands;
    const acc = state.sHands ? Math.round((state.sCorrect/state.sHands)*100) : 0;
    $('#p_accuracy').textContent = acc + '%';
    $('#p_beststreak').textContent = state.sBestStreak;
    $('#p_flashbest').textContent = `${state.flashBest} cards correct`;
  }

  // --- Tabs ---
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      $$('.tab').forEach(t=>t.classList.remove('active'));
      btn.classList.add('active');
      $('#'+btn.dataset.tab).classList.add('active');
    });
  });

  // --- Settings ---
  function loadSettings(){
    try {
      const s = JSON.parse(SafeStorage.get('bj_trainer_settings')||'{}');
      if (s && typeof s === 'object') state.opts = Object.assign(state.opts, s);
    } catch(e){}
    $('#opt-decks').value = state.opts.decks;
    $('#opt-s17').value = state.opts.s17;
    $('#opt-das').value = String(state.opts.das);
    $('#opt-ls').value = String(state.opts.lateSurrender);
    $('#opt-peek').value = String(state.opts.peek);
  }
  function saveSettings(){
    state.opts.decks = clamp(parseInt($('#opt-decks').value,10)||6,1,8);
    state.opts.s17 = $('#opt-s17').value;
    state.opts.das = $('#opt-das').value === 'true';
    state.opts.lateSurrender = $('#opt-ls').value === 'true';
    state.opts.peek = $('#opt-peek').value === 'true';
    SafeStorage.set('bj_trainer_settings', JSON.stringify(state.opts));
    buildShoe();
    $('#chart-body').innerHTML = generateReferenceChart(state.opts);
  }
  function clamp(x,a,b){return Math.max(a, Math.min(b,x));}
  $('#btn-save-settings').addEventListener('click', saveSettings);

  // --- Shoe building ---
  function buildShoe(){
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const suits = ['♠','♥','♦','♣'];
    const cards = [];
    for (let d=0; d<state.opts.decks; d++){
      for (const r of ranks){ for (const s of suits){ cards.push({rank:r, suit:s}); } }
    }
    for (let i=cards.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [cards[i],cards[j]] = [cards[j],cards[i)];
    }
    state.shoe = cards; state.discard = [];
  }
  function drawCard(){
    if (state.shoe.length === 0) buildShoe();
    const c = state.shoe.pop(); state.discard.push(c); return c;
  }

  // --- Strategy ---
  function renderCard(el, card){
    const div = document.createElement('div');
    div.className = 'card-ux black'; // default visible color
    const suit = card.suit, rank = card.rank;
    if (suit === '♥' || suit === '♦') div.classList.add('red'); else div.classList.add('black');
    div.textContent = `${rank}${suit}`; div.title = `${rank}${suit}`;
    el.appendChild(div);
  }

  function dealStrategyHand(){
    $('#player-cards').innerHTML = '';
    $('#dealer-card').innerHTML = '';
    $('#feedback').textContent = '';
    $('#explain-body').textContent = '—';
    const p1 = drawCard(), p2 = drawCard(), d1 = drawCard();
    renderCard($('#player-cards'), p1); renderCard($('#player-cards'), p2); renderCard($('#dealer-card'), d1);
    const { total, soft } = handTotals([p1,p2]);
    $('#player-total').textContent = `Total: ${total}`;
    $('#hand-type').textContent = isPair([p1,p2]) ? 'Pair' : (soft ? 'Soft' : 'Hard');
    $('#strategy-table').dataset.p1 = JSON.stringify(p1);
    $('#strategy-table').dataset.p2 = JSON.stringify(p2);
    $('#strategy-table').dataset.d1 = JSON.stringify(d1);
  }

  function answerStrategy(action){
    const p1 = JSON.parse($('#strategy-table').dataset.p1);
    const p2 = JSON.parse($('#strategy-table').dataset.p2);
    const d1 = JSON.parse($('#strategy-table').dataset.d1);
    const advice = basicStrategyAdvice([p1,p2], d1, state.opts);
    const correct = normalizeAction(advice.action);
    const user = normalizeAction(action);
    state.sHands += 1;
    if (user === correct){ state.sCorrect += 1; state.sStreak += 1; state.sBestStreak = Math.max(state.sBestStreak, state.sStreak); $('#feedback').textContent = `✅ Correct: ${correct}`; }
    else { state.sStreak = 0; $('#feedback').textContent = `❌ Incorrect. You chose ${user}. Correct: ${correct}`; }
    updateStatsUI(); saveProgress();
    $('#explain-body').textContent = advice.reason;
  }
  function normalizeAction(a){ const m = {HIT:'HIT',STAND:'STAND',DOUBLE:'DOUBLE',SPLIT:'SPLIT',SURRENDER:'SURRENDER'}; return m[a]||a; }
  function updateStatsUI(){
    $('#s_hands').textContent = state.sHands;
    $('#s_correct').textContent = state.sCorrect;
    const acc = state.sHands ? Math.round((state.sCorrect/state.sHands)*100) : 0;
    $('#s_accuracy').textContent = acc + '%';
    $('#s_streak').textContent = state.sStreak;
    updateProgressUI();
  }
  $('#btn-hit').addEventListener('click', ()=>answerStrategy('HIT'));
  $('#btn-stand').addEventListener('click', ()=>answerStrategy('STAND'));
  $('#btn-double').addEventListener('click', ()=>answerStrategy('DOUBLE'));
  $('#btn-split').addEventListener('click', ()=>answerStrategy('SPLIT'));
  $('#btn-surrender').addEventListener('click', ()=>answerStrategy('SURRENDER'));
  $('#btn-next').addEventListener('click', dealStrategyHand);
  $('#btn-show-why').addEventListener('click', ()=>{
    const p1 = JSON.parse($('#strategy-table').dataset.p1);
    const p2 = JSON.parse($('#strategy-table').dataset.p2);
    const d1 = JSON.parse($('#strategy-table').dataset.d1);
    const advice = basicStrategyAdvice([p1,p2], d1, state.opts);
    $('#feedback').textContent = `${advice.action} — ${advice.reason}`;
  });
  $('#btn-peek-table').addEventListener('click', ()=>{ $('#chart').open = true; $('#chart-body').innerHTML = generateReferenceChart(state.opts); });

  // --- Counting Stream ---
  function startStream(){
    stopStream();
    state.running = 0; state.totalDecks = clamp(parseInt($('#count-decks').value,10)||6,1,8);
    const speed = Math.max(200, parseInt($('#count-speed').value,10)||700);
    const container = $('#stream');
    container.innerHTML = ''; container.style.boxShadow = '0 0 0 2px rgba(255,255,255,.15) inset';
    let cardsDealt = 0; state.streamActive = true;
    state.streamTimer = setInterval(()=>{
      if (!state.streamActive){ stopStream(); return; }
      if (state.shoe.length === 0) buildShoe();
      const card = drawCard(); cardsDealt++;
      const el = document.createElement('div');
      el.className = 'card-ux black';
      el.textContent = `${card.rank}${card.suit}`;
      if (card.suit==='♥'||card.suit==='♦') el.classList.add('red');
      container.appendChild(el);
      state.running += HiLo.value(card.rank==='10'?'T':card.rank);
      $('#running-count').textContent = state.running;
      const decksRem = estimateDecksRemaining(cardsDealt, state.totalDecks);
      $('#decks-remaining').textContent = decksRem.toFixed(2);
      $('#true-count').textContent = (state.running / decksRem).toFixed(2);
    }, speed);
  }
  function stopStream(){
    if (state.streamTimer) clearInterval(state.streamTimer);
    state.streamTimer = null; state.streamActive = false;
    $('#stream').style.boxShadow = '';
  }
  $('#btn-start-stream').addEventListener('click', startStream);
  $('#btn-stop-stream').addEventListener('click', stopStream);

  // --- Flash Test ---
  let flashAnswer = 0;
  function runFlash(){
    $('#flash-area').innerHTML = '';
    $('#flash-feedback').textContent = '';
    const n = clamp(parseInt($('#flash-cards').value,10)||8,4,20);
    const speed = Math.max(150, parseInt($('#flash-speed').value,10)||450);
    const seq = [];
    for (let i=0;i<n;i++){ if (state.shoe.length === 0) buildShoe(); seq.push(drawCard()); }
    flashAnswer = seq.reduce((acc,c)=>acc + HiLo.value(c.rank==='10'?'T':c.rank),0);
    let i = 0;
    const show = setInterval(()=>{
      if (i>=seq.length){ clearInterval(show); setTimeout(()=>$('#flash-area').innerHTML = '⏱️ Enter your count and hit Check.', 200); return; }
      const c = seq[i++];
      const el = document.createElement('div');
      el.className = 'card-ux black';
      el.textContent = `${c.rank}${c.suit}`;
      if (c.suit==='♥'||c.suit==='♦') el.classList.add('red');
      $('#flash-area').appendChild(el);
    }, speed);
  }
  function checkFlash(){
    const v = parseInt($('#flash-input').value,10);
    if (Number.isNaN(v)){ $('#flash-feedback').textContent = 'Enter an integer count.'; return; }
    if (v === flashAnswer){ $('#flash-feedback').textContent = '✅ Correct!'; state.flashBest = Math.max(state.flashBest, parseInt($('#flash-cards').value,10)||0); saveProgress(); updateProgressUI(); }
    else { $('#flash-feedback').textContent = `❌ Off by ${v - flashAnswer}. True was ${flashAnswer}.`; }
  }
  $('#btn-flash').addEventListener('click', runFlash);
  $('#btn-check-flash').addEventListener('click', checkFlash);

  // --- Init ---
  loadSettings(); loadProgress(); updateStatsUI(); updateProgressUI(); buildShoe(); dealStrategyHand();
  $('#chart-body').innerHTML = generateReferenceChart(state.opts);
})();