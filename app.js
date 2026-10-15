// app.js — updated to use Storage and provide debounced search
document.addEventListener('DOMContentLoaded', () => {
  const addDeckBtn = document.getElementById('add-deck');
  const deckListEl = document.querySelector('.deck-list');
  const mainArea = document.getElementById('cards');

  // Search UI elements (must exist in DOM)
  const searchInput = document.getElementById('card-search');
  const searchCountEl = document.getElementById('search-count');

  // Debounce utility
  function debounce(fn, wait = 300) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ===== In-memory data with persistence ===== */
  const DEFAULT_STATE = { decks: [] };
  const STATE_VERSION = 1;

  // Try loading persisted state; fallback to default
  let persisted = window.Storage && typeof window.Storage.loadState === 'function'
    ? Storage.loadState(DEFAULT_STATE, STATE_VERSION)
    : DEFAULT_STATE;

  // Ensure shape
  let decks = Array.isArray(persisted.decks) ? persisted.decks : DEFAULT_STATE.decks.slice();
  let selectedDeckId = null;
  let currentCardIndex = 0;

  // Debounced save to localStorage to reduce writes
  const saveDebounced = debounce(() => {
    if (window.Storage && typeof window.Storage.saveState === 'function') {
      Storage.saveState({ decks }, STATE_VERSION);
    }
  }, 500);

  function persistNow() {
    if (window.Storage && typeof window.Storage.saveState === 'function') {
      Storage.saveState({ decks }, STATE_VERSION);
    }
  }

  /* Utilities */
  function escapeHtml(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function findDeck(id) { return decks.find(d => d.id === id); }

  /* Render deck list */
  function renderDeckList() {
    deckListEl.innerHTML = '';
    decks.forEach(deck => {
      const li = document.createElement('li');
      li.setAttribute('role','option');
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
      editBtn.dataset.action = 'edit-deck';
      editBtn.dataset.deckId = deck.id;
      editBtn.textContent = 'Edit';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.type = 'button';
      delBtn.dataset.action = 'delete-deck';
      delBtn.dataset.deckId = deck.id;
      delBtn.textContent = 'Delete';

      const studyBtn = document.createElement('button');
      studyBtn.className = 'btn';
      studyBtn.type = 'button';
      studyBtn.dataset.action = 'study-deck';
      studyBtn.dataset.deckId = deck.id;
      studyBtn.textContent = 'Study';

      li.appendChild(nameSpan);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      li.appendChild(studyBtn);

      if (deck.id === selectedDeckId) li.classList.add('selected');

      deckListEl.appendChild(li);
    });
  }

  /* Render card area */
  function renderCardArea() {
    const deck = findDeck(selectedDeckId);

    if (!deck) {
      mainArea.innerHTML = `
        <section class="card" id="card">
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
    saveDebounced();
  }
  function updateDeck(id, name) {
    const d = findDeck(id);
    if (d) d.name = name;
    renderDeckList();
    saveDebounced();
  }
  function deleteDeck(id) {
    const idx = decks.findIndex(d => d.id === id);
    if (idx === -1) return;
    if (!confirm(`Delete deck "${decks[idx].name}"?`)) return;
    const wasSelected = selectedDeckId === id;
    decks.splice(idx,1);
    renderDeckList();
    if (wasSelected) {
      if (decks.length) selectDeck(decks[Math.max(0, idx-1)].id);
      else { selectedDeckId = null; currentCardIndex = 0; renderCardArea(); }
    }
    saveDebounced();
  }
  function selectDeck(id) {
    selectedDeckId = id;
    currentCardIndex = 0;
    renderDeckList();
    renderCardArea();
    const li = deckListEl.querySelector(`li[data-deck-id="${id}"]`);
    if (li) li.focus();
    if (searchInput) {
      searchInput.value = '';
      updateSearchUI('');
    }
  }

  /* Card CRUD */
  function createCard(deckId, frontText, backText) {
    const deck = findDeck(deckId);
    if (!deck) return null;
    const id = 'c' + Date.now().toString();
    deck.cards.push({ id, front: frontText, back: backText });
    currentCardIndex = deck.cards.length - 1;
    renderCardArea();
    saveDebounced();
    return id;
  }
  function updateCard(deckId, cardId, frontText, backText) {
    const deck = findDeck(deckId);
    if (!deck) return;
    const c = deck.cards.find(x => x.id === cardId);
    if (!c) return;
    c.front = frontText; c.back = backText;
    renderCardArea();
    saveDebounced();
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
    saveDebounced();
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

  /* ===== Study Mode ===== */
  function enterStudyMode(deckId) {
    const deck = findDeck(deckId);
    if (!deck) { alert('Deck not found.'); return; }
    if (!deck.cards || deck.cards.length === 0) { alert('This deck has no cards.'); return; }

    let index = 0;
    let flipped = false;
    const previouslyFocused = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'study-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.tabIndex = -1;

    overlay.innerHTML = `
      <div class="study-panel" role="document">
        <div class="study-header">
          <h2 class="study-title">${escapeHtml(deck.name)}</h2>
          <button class="btn" data-action="exit-study" aria-label="Exit study mode">✕</button>
        </div>

        <div class="study-card-wrap">
          <section class="card study-card" id="study-card" aria-roledescription="flashcard">
            <div class="card__inner" tabindex="-1">
              <div class="card__face card__front" data-face="front"></div>
              <div class="card__face card__back" data-face="back"></div>
            </div>
          </section>
        </div>

        <div class="study-controls controls">
          <button class="btn" data-action="prev">Previous</button>
          <button class="btn" data-action="flip">Flip</button>
          <button class="btn" data-action="next">Next</button>
        </div>

        <div class="study-footer text-muted"><span class="study-pos"></span></div>
      </div>
    `;

    document.querySelectorAll('[data-app-root]').forEach(root => {
      if (!root.contains(overlay)) root.setAttribute('aria-hidden', 'true');
    });

    document.body.appendChild(overlay);

    const studyCardEl = overlay.querySelector('.study-card');
    const frontFace = overlay.querySelector('[data-face="front"]');
    const backFace = overlay.querySelector('[data-face="back"]');
    const posEl = overlay.querySelector('.study-pos');

    function renderCard() {
      const card = deck.cards[index];
      frontFace.innerHTML = escapeHtml(card.front || '');
      backFace.innerHTML = escapeHtml(card.back || '');
      posEl.textContent = `${index + 1} / ${deck.cards.length}`;
      flipped = false;
      studyCardEl.classList.remove('is-flipped');
      overlay.querySelector('.card__inner')?.focus();
    }
    function toggleFlip() {
      flipped = !flipped;
      studyCardEl.classList.toggle('is-flipped', flipped);
    }
    function nextCard() {
      if (!deck.cards.length) return;
      index = (index + 1) % deck.cards.length;
      renderCard();
    }
    function prevCard() {
      if (!deck.cards.length) return;
      index = (index - 1 + deck.cards.length) % deck.cards.length;
      renderCard();
    }

    function onKeydown(e) {
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          exitStudyMode();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCard();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevCard();
          break;
        case ' ':
        case 'Spacebar':
        case 'Space':
          e.preventDefault();
          toggleFlip();
          break;
        default:
          break;
      }
    }
    function onOverlayClick(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'exit-study') { exitStudyMode(); return; }
      if (action === 'flip') toggleFlip();
      if (action === 'next') nextCard();
      if (action === 'prev') prevCard();
    }
    function enforceFocus(e) {
      if (!overlay.contains(e.target)) {
        e.stopPropagation();
        overlay.focus();
      }
    }
    function exitStudyMode() {
      document.removeEventListener('keydown', onKeydown, true);
      overlay.removeEventListener('click', onOverlayClick, true);
      document.removeEventListener('focus', enforceFocus, true);
      document.querySelectorAll('[data-app-root]').forEach(root => {
        if (root.hasAttribute('aria-hidden')) root.removeAttribute('aria-hidden');
      });
      overlay.remove();
      try { previouslyFocused && previouslyFocused.focus(); } catch (_) {}
    }

    document.addEventListener('keydown', onKeydown, true);
    overlay.addEventListener('click', onOverlayClick, true);
    document.addEventListener('focus', enforceFocus, true);

    renderCard();
    setTimeout(() => overlay.focus(), 0);
  }

  /* ===== Debounced search ===== */
  function performSearch(query) {
    const deck = findDeck(selectedDeckId);
    if (!searchInput) return;

    if (!query) {
      searchCountEl.textContent = '';
      renderCardArea();
      return;
    }

    if (!deck) {
      searchCountEl.textContent = 'Select a deck to search';
      return;
    }

    const q = query.toLowerCase();
    const matches = deck.cards
      .map((card, idx) => ({ card, idx }))
      .filter(({ card }) =>
        (card.front && card.front.toLowerCase().includes(q)) ||
        (card.back && card.back.toLowerCase().includes(q))
      );

    searchCountEl.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;

    if (!matches.length) {
      mainArea.innerHTML = `<div class="search-results"><div class="search-info">No matches in "${escapeHtml(deck.name)}"</div></div>`;
      return;
    }

    mainArea.innerHTML = `
      <div class="search-results">
        <div class="search-info">Found ${matches.length} match${matches.length === 1 ? '' : 'es'} in "${escapeHtml(deck.name)}"</div>
        <ul>
          ${matches.map(m => `
            <li data-card-idx="${m.idx}" tabindex="0">
              ${escapeHtml(m.card.front)} — <span class="text-muted">${escapeHtml(m.card.back)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  const debouncedSearch = debounce((q) => performSearch(q), 300);

  function updateSearchUI(value) {
    if (!searchInput) return;
    debouncedSearch(value.trim());
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => updateSearchUI(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch(searchInput.value.trim());
        const first = mainArea.querySelector('.search-results li');
        if (first) first.focus();
      }
    });
  }

  mainArea.addEventListener('click', (e) => {
    const li = e.target.closest('.search-results li');
    if (li && li.dataset.cardIdx) {
      const idx = parseInt(li.dataset.cardIdx, 10);
      currentCardIndex = Number.isNaN(idx) ? 0 : idx;
      renderCardArea();
    }
  });

  mainArea.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && target.matches && target.matches('.search-results li') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const idx = parseInt(target.dataset.cardIdx, 10);
      currentCardIndex = Number.isNaN(idx) ? 0 : idx;
      renderCardArea();
    }
  });

  /* ===== Delegated click events ===== */
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
    } else if (action === 'study-deck') {
      enterStudyMode(deckId);
    }
  });

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

  /* Keyboard support for deck names */
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

  addDeckBtn.addEventListener('click', () => {
    const name = prompt('New deck name:');
    if (name && name.trim()) createDeck(name.trim());
    else addDeckBtn.focus();
  });

  /* Initial render */
  renderDeckList();
  if (decks.length) selectDeck(decks[0].id);
});