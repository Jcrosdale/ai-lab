// app.js — accessibility improvements, empty-state components, storage + search + CRUD + study mode
document.addEventListener('DOMContentLoaded', () => {
  const addDeckBtn = document.getElementById('add-deck');
  const deckListEl = document.getElementById('deck-list');
  const mainArea = document.getElementById('cards');

  const sidebarEmpty = document.getElementById('sidebar-empty');
  const mainEmpty = document.getElementById('main-empty');

  // Search UI elements
  const searchInput = document.getElementById('card-search');
  const searchCountEl = document.getElementById('search-count');

  // Debounce utility
  function debounce(fn, wait = 300) {
    let t = null;
    function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    }
    debounced.cancel = () => { clearTimeout(t); };
    return debounced;
  }

  /* ===== Persistence ===== */
  const DEFAULT_STATE = { decks: [] };
  const STATE_VERSION = 1;

  let persisted = window.Storage && typeof window.Storage.loadState === 'function'
    ? Storage.loadState(DEFAULT_STATE, STATE_VERSION)
    : DEFAULT_STATE;

  let decks = Array.isArray(persisted.decks) ? persisted.decks : [];
  let selectedDeckId = null;
  let currentCardIndex = 0;

  const saveDebounced = debounce(() => {
    if (window.Storage && typeof window.Storage.saveState === 'function') {
      Storage.saveState({ decks }, STATE_VERSION);
    }
  }, 500);

  /* Utilities */
  function escapeHtml(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function findDeck(id) { return decks.find(d => d.id === id); }

  /* Empty-state builders */
  function buildEmptyState({ title, description, ctaText, ctaActionId }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';
    // simple inline SVG icon (neutral)
    wrapper.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7v10a2 2 0 0 0 2 2h14"></path>
        <path d="M21 7a2 2 0 0 0-2-2H7"></path>
        <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
      </svg>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(description)}</div>
    `;
    if (ctaText) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn primary';
      btn.textContent = ctaText;
      btn.id = ctaActionId || '';
      wrapper.appendChild(btn);
    }
    return wrapper;
  }

  /* Render sidebar deck list */
  function renderDeckList() {
    deckListEl.innerHTML = '';
    if (decks.length === 0) {
      // show empty state in sidebar
      sidebarEmpty.hidden = false;
      const state = buildEmptyState({
        title: 'No decks yet',
        description: 'Create a deck to start adding flashcards.',
        ctaText: 'Create first deck',
        ctaActionId: 'empty-create-deck'
      });
      sidebarEmpty.innerHTML = '';
      sidebarEmpty.appendChild(state);
      // wire CTA
      const cta = document.getElementById('empty-create-deck');
      if (cta) cta.addEventListener('click', () => addDeckBtn.click());
    } else {
      sidebarEmpty.hidden = true;
    }

    decks.forEach(deck => {
      const li = document.createElement('li');
      li.setAttribute('role','option');
      const isSelected = deck.id === selectedDeckId;
      li.tabIndex = isSelected ? 0 : -1;
      li.setAttribute('aria-selected', String(isSelected));
      li.dataset.deckId = deck.id;
      li.className = 'deck-item';
      // simple label + meta
      const label = document.createElement('span');
      label.className = 'deck-name';
      label.textContent = deck.name;
      label.id = `deck-label-${deck.id}`;
      label.tabIndex = -1; // focus is on li
      li.appendChild(label);

      // controls group
      const group = document.createElement('span');
      group.className = 'deck-controls';
      // edit
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn';
      editBtn.dataset.action = 'edit-deck';
      editBtn.dataset.deckId = deck.id;
      editBtn.textContent = 'Edit';
      // delete
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn';
      delBtn.dataset.action = 'delete-deck';
      delBtn.dataset.deckId = deck.id;
      delBtn.textContent = 'Delete';
      // study
      const studyBtn = document.createElement('button');
      studyBtn.type = 'button';
      studyBtn.className = 'btn';
      studyBtn.dataset.action = 'study-deck';
      studyBtn.dataset.deckId = deck.id;
      studyBtn.textContent = 'Study';

      group.appendChild(editBtn);
      group.appendChild(delBtn);
      group.appendChild(studyBtn);
      li.appendChild(group);

      // click/select behavior on li
      li.addEventListener('click', (e) => {
        // avoid selecting if a button inside was clicked
        if (e.target.closest('button')) return;
        selectDeck(deck.id);
      });

      deckListEl.appendChild(li);
    });
  }

  /* Render card area & empty states */
  function renderCardArea() {
    const deck = findDeck(selectedDeckId);

    // hide main empty region by default
    mainEmpty.hidden = true;

    if (!deck) {
      mainArea.innerHTML = ''; // cleared
      mainEmpty.hidden = false;
      mainEmpty.innerHTML = '';
      mainEmpty.appendChild(buildEmptyState({
        title: 'No deck selected',
        description: 'Select a deck on the left or create a new deck to get started.',
        ctaText: 'Create deck',
        ctaActionId: 'main-empty-create-deck'
      }));
      const cta = document.getElementById('main-empty-create-deck');
      if (cta) cta.addEventListener('click', () => addDeckBtn.click());
      return;
    }

    if (!deck.cards || deck.cards.length === 0) {
      mainArea.innerHTML = ''; // clear main content
      mainEmpty.hidden = false;
      mainEmpty.innerHTML = '';
      mainEmpty.appendChild(buildEmptyState({
        title: 'No cards in this deck',
        description: 'Add cards to this deck. You can study once you have cards.',
        ctaText: 'Add first card',
        ctaActionId: 'main-empty-create-card'
      }));
      const ctaCard = document.getElementById('main-empty-create-card');
      if (ctaCard) ctaCard.addEventListener('click', () => {
        // open prompt-based create flow for now
        const front = prompt('Card front (term / question):', '');
        if (front === null) return;
        const back = prompt('Card back (definition / answer):', '');
        if (back === null) return;
        createCard(deck.id, front.trim(), back.trim());
      });
      return;
    }

    // normal card rendering
    mainEmpty.hidden = true;
    const card = deck.cards[currentCardIndex];
    const hasCard = Boolean(card);

    mainArea.innerHTML = `
      <section class="card" id="card" aria-roledescription="flashcard" aria-live="polite" aria-labelledby="card-label">
        <div class="card__inner" tabindex="-1" aria-hidden="false">
          <div class="card__face card__front" data-face="front" id="card-front">${hasCard ? escapeHtml(card.front) : ''}</div>
          <div class="card__face card__back" data-face="back" id="card-back">${hasCard ? escapeHtml(card.back) : ''}</div>
        </div>

        <div class="controls" role="toolbar" aria-label="Card controls">
          <button class="btn" data-action="flip" type="button">${hasCard ? 'Flip' : 'Preview'}</button>
          <button class="btn" data-action="prev" type="button">Previous</button>
          <button class="btn" data-action="next" type="button">Next</button>
          <button class="btn" data-action="create-card" type="button">New Card</button>
          ${hasCard ? `<button class="btn" data-action="edit-card" data-card-id="${card.id}" type="button">Edit Card</button>` : ''}
          ${hasCard ? `<button class="btn" data-action="delete-card" data-card-id="${card.id}" type="button">Delete Card</button>` : ''}
        </div>
      </section>`;
  }

  /* CRUD operations (deck + card) */
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
    // manage focus: find the li and focus it
    const li = deckListEl.querySelector(`li[data-deck-id="${id}"]`);
    if (li) li.focus();
    if (searchInput) {
      searchInput.value = '';
      updateSearchUI('');
    }
  }

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

  /* Study mode (improved aria-labelledby + focus handling) */
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

    const titleId = `study-title-${Date.now()}`;
    overlay.innerHTML = `
      <div class="study-panel" role="document">
        <div class="study-header">
          <h2 id="${titleId}" class="study-title">${escapeHtml(deck.name)}</h2>
          <button class="btn" data-action="exit-study" aria-label="Exit study mode" type="button">✕</button>
        </div>

        <div class="study-card-wrap">
          <section class="card study-card" id="study-card" aria-roledescription="flashcard" aria-labelledby="${titleId}">
            <div class="card__inner" tabindex="-1">
              <div class="card__face card__front" data-face="front"></div>
              <div class="card__face card__back" data-face="back"></div>
            </div>
          </section>
        </div>

        <div class="study-controls controls">
          <button class="btn" data-action="prev" type="button">Previous</button>
          <button class="btn" data-action="flip" type="button">Flip</button>
          <button class="btn" data-action="next" type="button">Next</button>
        </div>

        <div class="study-footer text-muted"><span class="study-pos" aria-live="polite"></span></div>
      </div>
    `;

    // mark background as hidden from assistive tech
    document.querySelectorAll('[data-app-root]').forEach(root => {
      if (!root.contains(overlay)) root.setAttribute('aria-hidden','true');
    });

    document.body.appendChild(overlay);

    const studyCardEl = overlay.querySelector('.study-card');
    const frontFace = overlay.querySelector('[data-face="front"]');
    const backFace  = overlay.querySelector('[data-face="back"]');
    const posEl     = overlay.querySelector('.study-pos');

    function renderCard() {
      const card = deck.cards[index];
      frontFace.innerHTML = escapeHtml(card.front || '');
      backFace.innerHTML  = escapeHtml(card.back || '');
      posEl.textContent = `${index + 1} / ${deck.cards.length}`;
      flipped = false;
      studyCardEl.classList.remove('is-flipped');
      overlay.querySelector('.card__inner')?.focus();
    }
    function toggleFlip() { flipped = !flipped; studyCardEl.classList.toggle('is-flipped', flipped); }
    function nextCard() { index = (index + 1) % deck.cards.length; renderCard(); }
    function prevCard() { index = (index - 1 + deck.cards.length) % deck.cards.length; renderCard(); }

    function onKeydown(e) {
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
      switch (e.key) {
        case 'Escape': e.preventDefault(); exitStudyMode(); break;
        case 'ArrowRight': e.preventDefault(); nextCard(); break;
        case 'ArrowLeft': e.preventDefault(); prevCard(); break;
        case ' ':
        case 'Spacebar':
        case 'Space': e.preventDefault(); toggleFlip(); break;
        default: break;
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
      document.querySelectorAll('[data-app-root]').forEach(root => { if (root.hasAttribute('aria-hidden')) root.removeAttribute('aria-hidden'); });
      overlay.remove();
      try { previouslyFocused && previouslyFocused.focus(); } catch (_) {}
    }

    document.addEventListener('keydown', onKeydown, true);
    overlay.addEventListener('click', onOverlayClick, true);
    document.addEventListener('focus', enforceFocus, true);

    renderCard();
    setTimeout(() => overlay.focus(), 0);
  }

  /* Search (debounced) */
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
          ${matches.map(m => `<li data-card-idx="${m.idx}" tabindex="0">${escapeHtml(m.card.front)} — <span class="text-muted">${escapeHtml(m.card.back)}</span></li>`).join('')}
        </ul>
      </div>`;
  }

  const debouncedSearch = debounce((q) => performSearch(q), 300);
  function updateSearchUI(value) { if (!searchInput) return; debouncedSearch(value.trim()); }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => updateSearchUI(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        debouncedSearch.cancel && debouncedSearch.cancel();
        performSearch(searchInput.value.trim());
        const first = mainArea.querySelector('.search-results li');
        if (first) first.focus();
      }
    });
  }

  // result selection
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

  /* Delegated actions for deck list */
  deckListEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) {
      const li = e.target.closest('li[data-deck-id]');
      if (li) selectDeck(li.dataset.deckId);
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

  /* Delegated actions for main area (cards) */
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
      default: break;
    }
  });

  /* Keyboard navigation for deck list (ArrowUp/Down, Home/End, Enter/Space to select) */
  deckListEl.addEventListener('keydown', (e) => {
    const key = e.key;
    const items = Array.from(deckListEl.querySelectorAll('li[data-deck-id]'));
    if (!items.length) return;

    const active = document.activeElement;
    const currentIndex = items.indexOf(active);
    let nextIndex = -1;

    if (key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = currentIndex === -1 ? 0 : Math.min(items.length - 1, currentIndex + 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
    } else if (key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (key === 'End') {
      e.preventDefault();
      nextIndex = items.length - 1;
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      const li = active.closest && active.closest('li[data-deck-id]') ? active.closest('li[data-deck-id]') : active;
      if (li && li.dataset && li.dataset.deckId) selectDeck(li.dataset.deckId);
      return;
    }

    if (nextIndex >= 0) {
      const target = items[nextIndex];
      if (target) {
        // update tabindex and aria-selected
        items.forEach((it, i) => {
          it.tabIndex = i === nextIndex ? 0 : -1;
          it.setAttribute('aria-selected', i === nextIndex ? 'true' : 'false');
        });
        target.focus();
      }
    }
  });

  /* Add deck button */
  addDeckBtn.addEventListener('click', () => {
    const name = prompt('New deck name:');
    if (name && name.trim()) createDeck(name.trim());
    else addDeckBtn.focus();
  });

  /* Initial render and focus */
  renderDeckList();
  if (decks.length) selectDeck(decks[0].id);
});