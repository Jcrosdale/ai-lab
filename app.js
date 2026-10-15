// Minimal JS for Flashcards app (separated JS)
// Handles flip, deck selection, and keyboard-friendly behavior.
// Keep logic minimal for clarity and later expansion (storage, routing, etc).

document.addEventListener('DOMContentLoaded', () => {
  const flipBtn = document.getElementById('flip');
  const back = document.getElementById('card-back');
  const front = document.getElementById('card-front');
  const deckItems = document.querySelectorAll('.deck-list li');

  // Flip toggles visibility of the back panel
  flipBtn.addEventListener('click', () => {
    back.hidden = !back.hidden;
  });

  // Simple previous/next placeholders (no deck state yet)
  document.getElementById('prev').addEventListener('click', () => {
    // TODO: implement card index traversal
    alert('Previous card (not implemented)');
  });
  document.getElementById('next').addEventListener('click', () => {
    // TODO: implement card index traversal
    alert('Next card (not implemented)');
  });

  // Deck click / keyboard handling
  deckItems.forEach(li => {
    li.addEventListener('click', () => {
      // Visual focus and placeholder load
      deckItems.forEach(x => x.classList.remove('selected'));
      li.classList.add('selected');
      li.focus();

      // Placeholder: update card area to reflect selected deck
      const deckName = li.textContent.trim();
      front.textContent = `Deck: ${deckName} — Front`;
      back.textContent = `Deck: ${deckName} — Back`;
      back.hidden = true;
    });

    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.click();
      }
    });
  });

  // Add-deck placeholder
  document.getElementById('add-deck').addEventListener('click', () => {
    // TODO: show UI to create a new deck (form/modal)
    const name = prompt('New deck name:');
    if (name) {
      const ul = document.querySelector('.deck-list');
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.dataset.deckId = Date.now().toString();
      li.textContent = name;
      ul.appendChild(li);
      // attach events to new item
      li.addEventListener('click', () => li.click());
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      });
    }
  });
});