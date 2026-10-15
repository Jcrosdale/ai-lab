// Accessible modal utility (plain JS)
// Features:
// - data-modal-open="<id>" to open a modal
// - data-modal-close on elements to close
// - overlay click closes (if overlay clicked)
// - ESC closes
// - focus trap inside modal (Tab / Shift+Tab)
// - returns focus to opener
// - marks [data-app-root] elements with aria-hidden while modal open

(function () {
  // helpers
  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable]',
    '[tabindex]:not([tabindex^="-"])'
  ].join(',');

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length);
  }

  // Modal class
  class Modal {
    constructor(el) {
      this.el = el;
      this.overlay = el.querySelector('[data-modal-overlay]') || el;
      this.openers = document.querySelectorAll(`[data-modal-open="${el.id}"]`);
      this.closers = el.querySelectorAll('[data-modal-close]');
      this.previouslyFocused = null;
      this.focusable = [];
      this.boundKeydown = this.handleKeydown.bind(this);
      this.boundFocus = this.retainFocus.bind(this);
      this.boundOverlayClick = this.handleOverlayClick.bind(this);
      this.init();
    }

    init() {
      // Wire closers inside modal
      this.closers.forEach(btn => btn.addEventListener('click', () => this.close()));

      // Wire openers outside modal (in case they aren't wired elsewhere)
      this.openers.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open(btn);
      }));
    }

    open(opener) {
      // Save opener to return focus later
      this.previouslyFocused = opener || document.activeElement;

      // Make rest of app inert-ish by setting aria-hidden on data-app-root elements
      document.querySelectorAll('[data-app-root]').forEach(root => {
        if (!elContains(root, this.el)) root.setAttribute('aria-hidden', 'true');
      });

      // Show modal
      this.el.removeAttribute('hidden');

      // Compute focusable elements and focus first
      this.focusable = getFocusableElements(this.el);
      const first = this.focusable[0] || this.el;
      // small timeout to ensure browser focusable state (esp. on iOS)
      setTimeout(() => first.focus(), 0);

      // Attach handlers
      document.addEventListener('keydown', this.boundKeydown, true);
      // Focus guard to ensure focus stays inside if something else attempts to move it
      document.addEventListener('focus', this.boundFocus, true);
      // overlay click closes (only if clicked outside panel)
      this.overlay.addEventListener('click', this.boundOverlayClick);
    }

    close() {
      // hide modal
      this.el.setAttribute('hidden', '');

      // restore aria-hidden
      document.querySelectorAll('[data-app-root]').forEach(root => {
        if (root.hasAttribute('aria-hidden')) root.removeAttribute('aria-hidden');
      });

      // remove handlers
      document.removeEventListener('keydown', this.boundKeydown, true);
      document.removeEventListener('focus', this.boundFocus, true);
      this.overlay.removeEventListener('click', this.boundOverlayClick);

      // return focus
      if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
        this.previouslyFocused.focus();
      }
    }

    handleOverlayClick(e) {
      // If click target is overlay (not panel), close
      // overlay is the element that fills the viewport (data-modal-overlay)
      // panel has class modal__panel
      const panel = this.el.querySelector('.modal__panel');
      if (panel && !panel.contains(e.target)) {
        this.close();
      }
    }

    handleKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === 'Tab') {
        // Manage focus trap
        this.focusable = getFocusableElements(this.el);
        if (this.focusable.length === 0) {
          // No tabbables, keep focus on the dialog container
          e.preventDefault();
          this.el.querySelector('.modal__panel')?.focus();
          return;
        }

        const first = this.focusable[0];
        const last = this.focusable[this.focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || this.el === document.activeElement) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    retainFocus(e) {
      // If focus leaves the modal, bring it back to the first focusable
      if (!this.el.contains(e.target)) {
        e.stopPropagation();
        const first = this.focusable[0] || this.el.querySelector('.modal__panel') || this.el;
        first.focus();
      }
    }
  }

  function elContains(parent, child) {
    try { return parent.contains(child); } catch (_) { return false; }
  }

  // Instantiate Modal objects for every element with class "modal" and an id
  const modals = Array.from(document.querySelectorAll('.modal[id]')).reduce((map, el) => {
    map[el.id] = new Modal(el);
    return map;
  }, {});

  // Also wire any data-modal-open elements which might reference modals not yet processed
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    const id = btn.dataset.modalOpen;
    if (!id) return;
    const modal = modals[id];
    if (modal) return; // already wired in Modal.init
    const el = document.getElementById(id);
    if (el) modals[id] = new Modal(el);
    // now opening by click is wired by Modal.init
  });

  // Expose a small API on window for programmatic control if needed:
  window.AccessibleModal = {
    open(id, opener) {
      const m = modals[id];
      if (m) m.open(opener);
    },
    close(id) {
      const m = modals[id];
      if (m) m.close();
    }
  };
})();