// counting.js — Hi-Lo counting utilities
const HiLo = {
  value(rank) {
    if (['2','3','4','5','6'].includes(rank)) return 1;
    if (['7','8','9'].includes(rank)) return 0;
    return -1; // T,J,Q,K,A
  }
};

function estimateDecksRemaining(cardsDealt, totalDecks) {
  const totalCards = totalDecks * 52;
  const remaining = Math.max(0, totalCards - cardsDealt);
  return Math.max(0.25, remaining / 52); // floor at a quarter deck to avoid div/0
}
