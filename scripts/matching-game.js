function startMatchingGame(termsArray, definitionsArray) {
  const termsContainer = document.getElementById('terms');
  const defsContainer = document.getElementById('definitions');
  const matchedPairsContainer = document.getElementById('matched-pairs');

  let selectedTerm = null;

  function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
  }

  // Clear existing cards
  termsContainer.innerHTML = '';
  defsContainer.innerHTML = '';
  matchedPairsContainer.innerHTML = '';

  function renderCards() {
    shuffle(termsArray).forEach(term => {
      const card = document.createElement('div');
      card.className = 'card';
      card.textContent = term.text;
      card.dataset.id = term.id;
      card.addEventListener('click', () => selectTerm(card));
      termsContainer.appendChild(card);
    });

    shuffle(definitionsArray).forEach(def => {
      const card = document.createElement('div');
      card.className = 'card';
      card.textContent = def.text;
      card.dataset.id = def.id;
      card.addEventListener('click', () => selectDefinition(card));
      defsContainer.appendChild(card);
    });
  }

  function selectTerm(card) {
    clearHighlights(termsContainer);
    selectedTerm = card;
    card.style.border = '2px solid #007BFF';
  }

  function selectDefinition(card) {
    if (!selectedTerm) {
      alert('Please select a term first!');
      return;
    }

    if (selectedTerm.dataset.id === card.dataset.id) {
      moveToMatched(selectedTerm, card);
    } else {
      alert('Incorrect match! Try again.');
    }

    clearHighlights(termsContainer);
    selectedTerm = null;
  }

  function moveToMatched(termCard, defCard) {
    const pair = document.createElement('div');
    pair.className = 'matched-pair';
    pair.innerHTML = `<strong>${termCard.textContent}</strong> - ${defCard.textContent}`;

    matchedPairsContainer.appendChild(pair);

    termCard.remove();
    defCard.remove();
  }

  function clearHighlights(container) {
    const cards = container.querySelectorAll('.card');
    cards.forEach(card => card.style.border = '1px solid #ccc');
  }

  renderCards();
}
