// app.js — UI + dealing + drill logic
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const state = {
    opts: {
      decks: 6,
      s17: 'S17',
      das: true,
      lateSurrender: true,
      peek: true
    },
    shoe: [],
    discard: [],

    // Strategy stats
    sHands: 0,
    sCorrect: 0,
    sStreak: 0,
    sBestStreak: 0,

    // Counting
    streamTimer: null,
    streamCards: 0,
    running: 0,
    totalDecks: 6,

    // Progress
    flashBest: 0, // number of cards correctly counted at fastest speed attempted
  };

  // --- Storage helpers ---
  function saveProgress(){
    const payload = {
      sHands: state.sHands,
      sCorrect: state.sCorrect,
      sBestStreak: state.sBestStreak,
      flashBest: state.flashBest
    };
    localStorage.setItem('bj_trainer_progress', JSON.stringify(payload));
  }
  function loadProgress(){
    try {
      const p = JSON.parse(localStorage.getItem('bj_trainer_progress')||'{}');
      if (!p) return;
      state.sHands = p.sHands||0;
      state.sCorrect = p.sCorrect||0;
      state.sBestStreak = p.sBestStreak||0;
      state.flashBest = p.flashBest||0;
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
    const s = JSON.parse(localStorage.getItem('bj_trainer_settings')||'{}');
    if (s && typeof s === 'object') {
      state.opts = Object.assign(state.opts, s);
    }
    // Populate UI
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
    localStorage.setItem('bj_trainer_settings', JSON.stringify(state.opts));
    // rebuild shoe
    buildShoe();
    $('#chart-body').innerHTML = generateReferenceChart(state.opts);
  }
  function clamp(x,a,b){return Math.max(a, Math.min(b,x));}
  $('#btn-save-settings').addEventListener('click', saveSettings);

  // --- Shoe building ---
  function buildShoe(){
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const suits = ['♠','♥','♦','♣'];
    const decks = state.opts.decks;
    const cards = [];
    for (let d=0; d<decks; d++){
      for (const r of ranks){
        for (const s of suits){
          cards.push({rank: r, suit: s});
        }
      }
    }
    // shuffle
    for (let i=cards.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [cards[i],cards[j]] = [cards[j],cards[i]];
    }
    state.shoe = cards;
    state.discard = [];
  }

  function drawCard(){
    if (state.shoe.length === 0) buildShoe();
    const c = state.shoe.pop();
    state.discard.push(c);
    return c;
  }

  // --- Strategy round ---
  function renderCard(el, card){
    const div = document.createElement('div');
    div.className = 'card-ux';
    div.textContent = card.rank;
    div.title = `${card.rank}${card.suit}`;
    el.appendChild(div);
  }

  function dealStrategyHand(){
    $('#player-cards').innerHTML = '';
    $('#dealer-card').innerHTML = '';
    $('#feedback').textContent = '';
    $('#explain-body').textContent = '—';

    const p1 = drawCard(), p2 = drawCard();
    const d1 = drawCard(); // upcard only for drill
    renderCard($('#player-cards'), p1);
    renderCard($('#player-cards'), p2);
    renderCard($('#dealer-card'), d1);

    const { total, soft } = handTotals([p1,p2]);
    $('#player-total').textContent = `Total: ${total}`;
    $('#hand-type').textContent = isPair([p1,p2]) ? 'Pair' : (soft ? 'Soft' : 'Hard');

    // store on element for later
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
    if (user === correct) {
      state.sCorrect += 1;
      state.sStreak += 1;
      state.sBestStreak = Math.max(state.sBestStreak, state.sStreak);
      $('#feedback').textContent = `✅ Correct: ${correct}`;
    } else {
      state.sStreak = 0;
      $('#feedback').textContent = `❌ Incorrect. You chose ${user}. Correct: ${correct}`;
    }
    updateStatsUI();
    saveProgress();

    $('#explain-body').textContent = advice.reason;
  }

  function normalizeAction(a){
    const m = { 'HIT':'HIT','STAND':'STAND','DOUBLE':'DOUBLE','SPLIT':'SPLIT','SURRENDER':'SURRENDER'};
    return m[a] || a;
  }

  function updateStatsUI(){
    $('#s_hands').textContent = state.sHands;
    $('#s_correct').textContent = state.sCorrect;
    const acc = state.sHands ? Math.round((state.sCorrect/state.sHands)*100) : 0;
    $('#s_accuracy').textContent = acc + '%';
    $('#s_streak').textContent = state.sStreak;
    updateProgressUI();
  }

  // Bind strategy buttons
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

  $('#btn-peek-table').addEventListener('click', ()=>{
    $('#chart').open = true;
    $('#chart-body').innerHTML = generateReferenceChart(state.opts);
  });

  // --- Counting Stream ---
  function startStream(){
    stopStream();
    state.running = 0;
    state.totalDecks = clamp(parseInt($('#count-decks').value,10)||6,1,8);
    const speed = Math.max(200, parseInt($('#count-speed').value,10)||700);
    $('#stream').innerHTML = '';
    let cardsDealt = 0;

    state.streamTimer = setInterval(()=>{
      // draw card
      if (state.shoe.length === 0) buildShoe();
      const card = drawCard();
      cardsDealt++;
      // render
      const el = document.createElement('div');
      el.className = 'card-ux';
      el.textContent = card.rank;
      $('#stream').appendChild(el);
      // update counts
      state.running += HiLo.value(card.rank==='10'?'T':card.rank);
      $('#running-count').textContent = state.running;
      const decksRem = estimateDecksRemaining(cardsDealt, state.totalDecks);
      $('#decks-remaining').textContent = decksRem.toFixed(2);
      $('#true-count').textContent = (state.running / decksRem).toFixed(2);
    }, speed);
  }
  function stopStream(){
    if (state.streamTimer) clearInterval(state.streamTimer);
    state.streamTimer = null;
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
    for (let i=0;i<n;i++){
      if (state.shoe.length === 0) buildShoe();
      seq.push(drawCard());
    }
    flashAnswer = seq.reduce((acc,c)=>acc + HiLo.value(c.rank==='10'?'T':c.rank),0);
    // show one by one then clear
    let i = 0;
    const show = setInterval(()=>{
      if (i>=seq.length){
        clearInterval(show);
        setTimeout(()=>$('#flash-area').innerHTML = '⏱️ Enter your count and hit Check.', 200);
        return;
      }
      const c = seq[i++];
      const el = document.createElement('div');
      el.className = 'card-ux';
      el.textContent = c.rank;
      $('#flash-area').appendChild(el);
    }, speed);
  }
  function checkFlash(){
    const v = parseInt($('#flash-input').value,10);
    if (Number.isNaN(v)){
      $('#flash-feedback').textContent = 'Enter an integer count.';
      return;
    }
    if (v === flashAnswer){
      $('#flash-feedback').textContent = '✅ Correct!';
      state.flashBest = Math.max(state.flashBest, parseInt($('#flash-cards').value,10)||0);
      saveProgress();
      updateProgressUI();
    } else {
      $('#flash-feedback').textContent = `❌ Off by ${v - flashAnswer}. True was ${flashAnswer}.`;
    }
  }
  $('#btn-flash').addEventListener('click', runFlash);
  $('#btn-check-flash').addEventListener('click', checkFlash);

  // --- Init ---
  loadSettings();
  loadProgress();
  updateStatsUI();
  updateProgressUI();
  buildShoe();
  dealStrategyHand();
  $('#chart-body').innerHTML = generateReferenceChart(state.opts);

})();