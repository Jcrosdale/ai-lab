// Decks + Cards (in-memory) + UI wiring with delegated events and 3D flip

document.addEventListener('DOMContentLoaded', () => {
  const addDeckBtn = document.getElementById('add-deck');
  const deckListEl = document.querySelector('.deck-list');
  const mainArea = document.getElementById('cards');

  // In-memory data
  let decks = [
    { id: '1', name: 'Spanish — Basics', cards: [
      { id: 'c1', front: 'Hola', back: 'Hello' },
      { id: 'c2', front: 'Adiós', back: 'Goodbye' }
    ] },
    { id: '2', name: 'Chemistry — Elements', cards: [] }
  ];
  let selectedDeckId = null;
  let currentCardIndex = 0;

  /* utilities */
  function escapeHtml(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function findDeck(id) { return decks.find(d => d.id === id); }

  /* Render deck list */
  function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach(deck => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.dataset.deckId = deck.id;
      li.className = 'deck-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'deck-name';
      nameSpan.textContent = deck.name;
      nameSpan.tabIndex = 0;

      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.type = 'button';
      editBtn.setAttribute('data-action', 'edit-deck');
      editBtn.dataset.deckId = deck.id;
      editBtn.textContent = 'Edit';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.type = 'button';
      delBtn.setAttribute('data-action', 'delete-deck');
      delBtn.dataset.deckId = deck.id;
      delBtn.textContent = 'Delete';

      li.appendChild(nameSpan);
      li.appendChild(editBtn);
      li.appendChild(delBtn);

      if (deck.id === selectedDeckId) li.classList.add('selected');

      deckListEl.appendChild(li);
    });
  }

  /* Render card area */
  function renderCardArea() {
    const deck = findDeck(selectedDeckId);

    if (!deck) {
      mainArea.innerHTML = `
        <section class="card" id="card" aria-roledescription="flashcard">
          <div class="card__inner" tabindex="-1">
            <div class="card__face card__front">No deck selected</div>
            <div class="card__face card__back" hidden>—</div>
          </div>
          <div class="controls">
            <button class="btn" data-action="create-card">Create card</button>
          </div>
        </section>`;
      return;
    }

    const card = deck.cards[currentCardIndex];
    const hasCard = Boolean(card);

    mainArea.innerHTML = `
      <section class="card" id="card" aria-roledescription="flashcard" aria-live="polite">
        <div class="card__inner" tabindex="-1" aria-hidden="false">
          <div class="card__face card__front" data-face="front">${hasCard ? escapeHtml(card.front) : 'No cards yet'}</div>
          <div class="card__face card__back" data-face="back">${hasCard ? escapeHtml(card.back) : ''}</div>
        </div>

        <div class="controls">
          <button class="btn" data-action="flip">${hasCard ? 'Flip' : 'Preview'}</button>
          <button class="btn" data-action="prev">Previous</button>
          <button class="btn" data-action="next">Next</button>
          <button class="btn" data-action="create-card">New Card</button>
          ${hasCard ? `<button class="btn" data-action="edit-card" data-card-id="${card.id}">Edit Card</button>` : ''}
          ${hasCard ? `<button class="btn" data-action="delete-card" data-card-id="${card.id}">Delete Card</button>` : ''}
        </div>
      </section>`;
  }

  /* Deck CRUD */
  function createDeck(name) {
    const id = Date.now().toString();
    decks.push({ id, name, cards: [] });
    renderDeckList();
    selectDeck(id);
  }
  function updateDeck(id, name) {
    const d = findDeck(id);
    if (d) d.name = name;
    renderDeckList();
  }
  function deleteDeck(id) {
    const idx = decks.findIndex(d => d.id === id);
    if (idx === -1) return;
    if (!confirm(`Delete deck "${decks[idx].name}"?`)) return;
    const wasSelected = selectedDeckId === id;
    decks.splice(idx, 1);
    renderDeckList();
    if (wasSelected) {
      if (decks.length) selectDeck(decks[Math.max(0, idx - 1)].id);
      else { selectedDeckId = null; currentCardIndex = 0; renderCardArea(); }
    }
  }
  function selectDeck(id) {
    selectedDeckId = id;
    currentCardIndex = 0;
    renderDeckList();
    renderCardArea();
    const li = deckListEl.querySelector(`li[data-deck-id="${id}"]`);
    if (li) li.focus();
  }

  /* Card CRUD */
  function createCard(deckId, frontText, backText) {
    const deck = findDeck(deckId);
    if (!deck) return null;
    const id = 'c' + Date.now().toString();
    deck.cards.push({ id, front: frontText, back: backText });
    currentCardIndex = deck.cards.length - 1;
    renderCardArea();
    return id;
  }
  function updateCard(deckId, cardId, frontText, backText) {
    const deck = findDeck(deckId);
    if (!deck) return;
    const c = deck.cards.find(x => x.id === cardId);
    if (!c) return;
    c.front = frontText; c.back = backText;
    renderCardArea();
  }
  function deleteCard(deckId, cardId) {
    const deck = findDeck(deckId);
    if (!deck) return;
    const idx = deck.cards.findIndex(x => x.id === cardId);
    if (idx === -1) return;
    if (!confirm('Delete this card?')) return;
    deck.cards.splice(idx, 1);
    currentCardIndex = Math.max(0, Math.min(currentCardIndex, deck.cards.length - 1));
    renderCardArea();
  }

  /* Navigation */
  function goPrev() {
    const deck = findDeck(selectedDeckId);
    if (!deck || deck.cards.length === 0) return;
    currentCardIndex = (currentCardIndex - 1 + deck.cards.length) % deck.cards.length;
    renderCardArea();
  }
  function goNext() {
    const deck = findDeck(selectedDeckId);
    if (!deck || deck.cards.length === 0) return;
    currentCardIndex = (currentCardIndex + 1) % deck.cards.length;
    renderCardArea();
  }

  /* Delegation: deck actions */
  deckListEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) {
      const nameSpan = e.target.closest('.deck-name');
      if (nameSpan) {
        const li = nameSpan.closest('li[data-deck-id]');
        if (li) selectDeck(li.dataset.deckId);
      }
      return;
    }
    const action = actionBtn.dataset.action;
    const deckId = actionBtn.dataset.deckId;
    if (action === 'edit-deck') {
      const d = findDeck(deckId);
      if (!d) return;
      const name = prompt('Rename deck', d.name);
      if (name && name.trim()) updateDeck(deckId, name.trim());
    } else if (action === 'delete-deck') {
      deleteDeck(deckId);
    }
  });

  /* Delegation: card area actions */
  mainArea.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;

    if (['create-card','edit-card','delete-card'].includes(action) && !selectedDeckId) {
      alert('Please select a deck first.');
      return;
    }

    switch (action) {
      case 'flip': {
        const cardEl = document.getElementById('card');
        if (cardEl) cardEl.classList.toggle('is-flipped');
        break;
      }
      case 'prev': goPrev(); break;
      case 'next': goNext(); break;

      case 'create-card': {
        const frontText = prompt('Card front (term / question):', '');
        if (frontText === null) break;
        const backText = prompt('Card back (definition / answer):', '');
        if (backText === null) break;
        createCard(selectedDeckId, frontText.trim(), backText.trim());
        break;
      }

      case 'edit-card': {
        const cardId = actionBtn.dataset.cardId;
        const deck = findDeck(selectedDeckId);
        if (!deck) break;
        const card = deck.cards.find(c => c.id === cardId);
        if (!card) break;
        const newFront = prompt('Edit front:', card.front);
        if (newFront === null) break;
        const newBack = prompt('Edit back:', card.back);
        if (newBack === null) break;
        updateCard(selectedDeckId, cardId, newFront.trim(), newBack.trim());
        break;
      }

      case 'delete-card': {
        const cardId = actionBtn.dataset.cardId;
        deleteCard(selectedDeckId, cardId);
        break;
      }
      default:
        break;
    }
  });

  /* Keyboard support on deck names */
  deckListEl.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('deck-name')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const li = target.closest('li[data-deck-id]');
        if (li) selectDeck(li.dataset.deckId);
      }
    }
  });

  /* Add deck button */
  addDeckBtn.addEventListener('click', () => {
    const name = prompt('New deck name:');
    if (name && name.trim()) createDeck(name.trim());
    else addDeckBtn.focus();
  });

  /* Initial render */
  renderDeckList();
  if (decks.length) selectDeck(decks[0].id);
});