// strategyTables.js
// Basic Strategy logic with options: S17/H17, DAS true/false, Late Surrender true/false
// This code implements widely accepted multi-deck basic strategy, derived for training.
// Hi-level approach: classify hand as pair / soft / hard and use tables parameterized by rules.

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function cardValue(card) {
  const r = card.rank;
  if (r === 'A') return 11;
  if (['10','J','Q','K'].includes(r)) return 10;
  return parseInt(r,10);
}

function handTotals(cards) {
  // return {total, soft, altTotal?}
  let total = 0, aces = 0;
  cards.forEach(c => {
    if (c.rank === 'A') {aces += 1; total += 11;}
    else if (['10','J','Q','K'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank,10);
  });
  while (total > 21 && aces > 0) {
    total -= 10; // count one Ace as 1 instead of 11
    aces--;
  }
  const soft = cards.some(c => c.rank === 'A') && total <= 21 && (total + 10 <= 21); // soft if at least one Ace counted as 11 possible
  return { total, soft };
}

function isPair(cards) {
  if (cards.length !== 2) return false;
  const v1 = cards[0].rank, v2 = cards[1].rank;
  const h1 = (v1 === '10' || v1 === 'J' || v1 === 'Q' || v1 === 'K') ? 'T' : v1;
  const h2 = (v2 === '10' || v2 === 'J' || v2 === 'Q' || v2 === 'K') ? 'T' : v2;
  return h1 === h2;
}

function upcardToValue(dealerCard) {
  const r = dealerCard.rank;
  if (r === 'A') return 'A';
  if (['10','J','Q','K'].includes(r)) return 'T';
  return r; // '2'..'9'
}

// ----- PAIR TABLES -----
// Return 'SPLIT' or refer to hard/soft strategy if not split.
// Tables distinguish DAS allowed or not for some borderline cases.
const PairTables = {
  // Always split: AA, 88
  base(decisionCtx) {
    const {pairRank, up, das, s17} = decisionCtx;

    // Normalize 10/J/Q/K as 'T'
    const pr = (['10','J','Q','K'].includes(pairRank) ? 'T' : pairRank);

    if (pr === 'A' || pr === '8') return 'SPLIT';
    if (pr === 'T') return 'STAND'; // never split 10s

    // 9,9: split vs 2-6,8-9; stand vs 7, T, A
    if (pr === '9') {
      if (['2','3','4','5','6','8','9'].includes(up)) return 'SPLIT';
      return 'STAND';
    }

    // 7,7: split vs 2-7; otherwise hit
    if (pr === '7') {
      if (['2','3','4','5','6','7'].includes(up)) return 'SPLIT';
      return 'HIT';
    }

    // 6,6: split vs 2-6; otherwise hit
    if (pr === '6') {
      if (['2','3','4','5','6'].includes(up)) return 'SPLIT';
      return 'HIT';
    }

    // 5,5: treat as hard 10 (never split)
    if (pr === '5') return 'DOUBLE_10'; // marker to fall through

    // 4,4: split vs 5-6 ONLY if DAS, else hit
    if (pr === '4') {
      if (das && (up === '5' || up === '6')) return 'SPLIT';
      return 'HIT';
    }

    // 3,3 and 2,2: split vs 2-7 if DAS; otherwise split vs 4-7
    if (pr === '3' || pr === '2') {
      if (das) {
        if (['2','3','4','5','6','7'].includes(up)) return 'SPLIT';
      } else {
        if (['4','5','6','7'].includes(up)) return 'SPLIT';
      }
      return 'HIT';
    }

    return null;
  }
};

// ----- SOFT TOTALS -----
// Advice for soft totals A,2..A,9. Distinguish S17/H17 where doubling ranges expand under H17.
function softAdvice(total, up, s17) {
  // total is 13..21 (A+2..A+10)
  switch(total) {
    case 13: // A,2
    case 14: // A,3
      if (s17 === 'H17') {
        if (['4','5','6'].includes(up)) return 'DOUBLE';
      } else {
        if (['5','6'].includes(up)) return 'DOUBLE';
      }
      return 'HIT';
    case 15: // A,4
    case 16: // A,5
      if (s17 === 'H17') {
        if (['3','4','5','6'].includes(up)) return 'DOUBLE';
      } else {
        if (['4','5','6'].includes(up)) return 'DOUBLE';
      }
      return 'HIT';
    case 17: // A,6
      if (s17 === 'H17') {
        if (['2','3','4','5','6'].includes(up)) return 'DOUBLE';
      } else {
        if (['3','4','5','6'].includes(up)) return 'DOUBLE';
      }
      return 'HIT';
    case 18: // A,7
      if (s17 === 'H17') {
        if (['2','3','4','5','6'].includes(up)) return 'DOUBLE';
        if (['7','8'].includes(up)) return 'STAND';
        return 'HIT'; // 9, T, A
      } else {
        if (['3','4','5','6'].includes(up)) return 'DOUBLE';
        if (['2','7','8'].includes(up)) return 'STAND';
        return 'HIT';
      }
    case 19: // A,8
      if (s17 === 'H17' && up === '6') return 'DOUBLE';
      return 'STAND';
    case 20: // A,9
    case 21: // A,10
      return 'STAND';
    default:
      return 'HIT';
  }
}

// ----- HARD TOTALS -----
function hardAdvice(total, up, s17, lateSurrender) {
  // Surrender first where applicable
  if (lateSurrender) {
    // Common LS guidance:
    // 16 vs 9, T, A
    if (total === 16 && ['9','T','A'].includes(up)) return 'SURRENDER_OR_HIT';
    // 15 vs T
    if (total === 15 && up === 'T') return 'SURRENDER_OR_HIT';
  }

  if (total <= 8) return 'HIT';
  if (total === 9) {
    if (['3','4','5','6'].includes(up)) return 'DOUBLE';
    return 'HIT';
  }
  if (total === 10) {
    if (['2','3','4','5','6','7','8','9'].includes(up)) return 'DOUBLE';
    return 'HIT';
  }
  if (total === 11) {
    if (s17 === 'H17') {
      // double vs any upcard including Ace
      return 'DOUBLE';
    } else {
      if (up !== 'A') return 'DOUBLE';
      return 'HIT';
    }
  }
  if (total === 12) {
    if (['4','5','6'].includes(up)) return 'STAND';
    return 'HIT';
  }
  if (total >= 13 && total <= 16) {
    if (['2','3','4','5','6'].includes(up)) return 'STAND';
    return 'HIT';
  }
  return 'STAND'; // 17+
}

// Compose final advice for a two-card starting hand
function basicStrategyAdvice(playerCards, dealerCard, opts) {
  const up = upcardToValue(dealerCard);
  const { total, soft } = handTotals(playerCards);
  const s17 = opts.s17 || 'S17';
  const das = !!opts.das;
  const lateSurrender = !!opts.lateSurrender;

  // Pair handling
  if (isPair(playerCards)) {
    const pairRank = playerCards[0].rank;
    const pairDecision = PairTables.base({pairRank, up, das, s17});
    if (pairDecision === 'SPLIT') return {action: 'SPLIT', reason: `Pair of ${pairRank}s vs ${up}: split.`};
    if (pairDecision === 'DOUBLE_10') {
      // treat as hard 10
      const ha = hardAdvice(10, up, s17, lateSurrender);
      return normalizeAdvice(ha, { type: 'hard', total: 10, up, pair: true });
    }
    if (pairDecision) {
      // HIT or STAND from pair table
      return normalizeAdvice(pairDecision, { type: 'pair', rank: pairRank, up });
    }
    // otherwise fall through to soft/hard
  }

  if (soft && total >= 13 && total <= 21) {
    const sa = softAdvice(total, up, s17);
    return normalizeAdvice(sa, { type: 'soft', total, up });
  } else {
    const ha = hardAdvice(total, up, s17, lateSurrender);
    return normalizeAdvice(ha, { type: 'hard', total, up });
  }
}

function normalizeAdvice(code, ctx) {
  // Map combined codes to final action text + explanation.
  let action = code;
  let extra = '';
  if (code === 'SURRENDER_OR_HIT') {
    action = 'SURRENDER';
    extra = ' (or Hit if surrender not available)';
  }
  if (code === 'DOUBLE_10') action = 'DOUBLE';

  let why = '';
  if (ctx.type === 'pair') {
    why = `Pair strategy for ${ctx.rank}${ctx.rank} vs ${ctx.up}.`;
  } else if (ctx.type === 'soft') {
    why = `Soft ${ctx.total} vs ${ctx.up}.`;
  } else if (ctx.type === 'hard') {
    why = `Hard ${ctx.total} vs ${ctx.up}.`;
  }
  return { action, reason: (why + extra).trim() };
}

// Generate a simple reference chart as HTML for the chosen rules
function generateReferenceChart(opts) {
  const upcards = ['2','3','4','5','6','7','8','9','T','A'];
  const rows = [];

  function mkRow(label, total, soft=false) {
    const tds = upcards.map(u => {
      let res;
      if (soft) res = softAdvice(total, u, opts.s17 || 'S17');
      else      res = hardAdvice(total, u, opts.s17 || 'S17', !!opts.lateSurrender);
      const a = res.replace('_OR_HIT',''); // show primary recommendation
      return `<td>${abbrAction(a)}</td>`;
    }).join('');
    return `<tr><th>${label}</th>${tds}</tr>`;
  }

  function abbrAction(a) {
    if (a === 'HIT') return 'H';
    if (a === 'STAND') return 'S';
    if (a === 'DOUBLE') return 'D';
    if (a === 'SPLIT') return 'P';
    if (a === 'SURRENDER' || a === 'SURRENDER_OR_HIT') return 'R';
    return a[0];
  }

  const header = `<tr><th></th>${upcards.map(u=>`<th>${u}</th>`).join('')}</tr>`;
  rows.push(`<table class="chart"><caption>Hard Totals</caption>${header}`);
  for (let t=8; t<=17; t++) rows.push(mkRow(`${t}`, t, false));
  rows.push('</table>');

  rows.push(`<table class="chart"><caption>Soft Totals (A,x)</caption>${header}`);
  for (let t=13; t<=20; t++) rows.push(mkRow(`A,${t-11}`, t, true));
  rows.push('</table>');

  // Pair overview (condensed)
  const pairRows = [];
  const pairs = ['A','T','9','8','7','6','5','4','3','2'];
  pairRows.push(`<table class="chart"><caption>Pairs (P = Split)</caption>${header}`);
  for (const pr of pairs) {
    const tds = upcards.map(u => {
      const dec = PairTables.base({pairRank: pr==='T'?'10':pr, up:u, das:!!opts.das, s17: opts.s17||'S17'});
      let a = dec || '-';
      if (a === 'DOUBLE_10') a = 'D';
      if (a === 'SPLIT') a = 'P';
      if (a === 'HIT') a = 'H';
      if (a === 'STAND') a = 'S';
      return `<td>${a}</td>`;
    }).join('');
    pairRows.push(`<tr><th>${pr}${pr}</th>${tds}</tr>`);
  }
  pairRows.push('</table>');

  return `<div class="charts">${rows.join('')}<div class="spacer"></div>${pairRows.join('')}</div>`;
}

