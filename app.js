function renderCard(el, card){
  const div = document.createElement('div');
  div.className = 'card-ux';
  const rank = card.rank;
  const suit = card.suit;
  if (suit === '♥' || suit === '♦') {
    div.classList.add('red');
  } else {
    div.classList.add('black');
  }
  div.textContent = `${rank}${suit}`;
  div.title = `${rank}${suit}`;
  el.appendChild(div);
}