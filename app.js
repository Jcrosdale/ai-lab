// Deck CRUD (in-memory) + UI wiring for Flashcards app
// - In-memory decks array (id, name, cards)
// - Create / Read / Update (rename) / Delete
// - Renders deck list and keeps selection in sync
// - Uses prompt/confirm for simple inputs (replace with modal/forms later)

document.addEventListener('DOMContentLoaded', () => {
  const addDeckBtn = document.getElementById('add-deck');
  const deckListEl = document.querySelector('.deck-list');
  const front = document.getElementById('card-front');
  const back = document.getElementById('card-back');

  // In-memory store (start with two sample decks)
  let decks = [
    { id: '1', name: 'Spanish — Basics', cards: [] },
    { id: '2', name: 'Chemistry — Elements', cards: [] }
  ];
  let selectedDeckId = null;

  // Render the deck list into the sidebar
  function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach(deck => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.dataset.deckId = deck.id;
      li.className = 'deck-item';

      // Name (click/selectable, keyboard accessible)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'deck-name';
      nameSpan.textContent = deck.name;
      nameSpan.tabIndex = 0;
      nameSpan.addEventListener('click', () => selectDeck(deck.id));
      nameSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDeck(deck.id);
        }
      });

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.type = 'button';
      editBtn.innerText = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editDeck(deck.id);
      });

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.type = 'button';
      delBtn.innerText = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDeck(deck.id);
      });

      // append pieces
      li.appendChild(nameSpan);
      li.appendChild(editBtn);
      li.appendChild(delBtn);

      // mark selected
      if (deck.id === selectedDeckId) li.classList.add('selected');

      deckListEl.appendChild(li);
    });
  }

  // CRUD operations
  function createDeck(name) {
    const id = Date.now().toString();
    const deck = { id, name, cards: [] };
    decks.push(deck);
    renderDeckList();
    // select the newly created deck and focus it
    selectDeck(id);
    return deck;
  }

  function updateDeck(id, name) {
    const d = decks.find(x => x.id === id);
    if (!d) return;
    d.name = name;
    renderDeckList();
  }

  function deleteDeck(id) {
    const idx = decks.findIndex(x => x.id === id);
    if (idx === -1) return;
    const confirmed = confirm(`Delete deck "${decks[idx].name}"? This cannot be undone.`);
    if (!confirmed) return;

    const wasSelected = selectedDeckId === id;
    decks.splice(idx, 1);
    renderDeckList();

    if (wasSelected) {
      // choose next deck if available, otherwise clear main area
      if (decks.length > 0) selectDeck(decks[Math.max(0, idx - 1)].id);
      else {
        selectedDeckId = null;
        front.textContent = 'Front: term or question';
        back.textContent = 'Back: definition or answer';
        back.hidden = true;
      }
    }
  }

  function selectDeck(id) {
    selectedDeckId = id;
    renderDeckList();

    const deck = decks.find(d => d.id === id);
    if (deck) {
      front.textContent = `Deck: ${deck.name} — Front`;
      back.textContent = `Deck: ${deck.name} — Back`;
      back.hidden = true;
    } else {
      front.textContent = 'Front: term or question';
      back.textContent = 'Back: definition or answer';
    }

    // focus the selected LI for keyboard users
    const li = deckListEl.querySelector(`li[data-deck-id="${id}"]`);
    if (li) li.focus();
  }

  function editDeck(id) {
    const deck = decks.find(d => d.id === id);
    if (!deck) return;
    const name = prompt('Rename deck', deck.name);
    if (name && name.trim()) {
      updateDeck(id, name.trim());
      selectDeck(id);
    }
  }

  // Wire add-deck button
  addDeckBtn.addEventListener('click', () => {
    const name = prompt('New deck name:');
    if (name && name.trim()) {
      createDeck(name.trim());
    } else {
      // If user cancelled or entered empty name, focus the button again
      addDeckBtn.focus();
    }
  });

  // Initial render and default selection
  renderDeckList();
  if (decks.length) selectDeck(decks[0].id);

  // Optional: expose a minimal API for debugging/automation
  window.FlashcardsDecks = {
    createDeck,
    updateDeck,
    deleteDeck,
    selectDeck,
    list: () => decks.slice()
  };
});