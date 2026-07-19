/* =========================================================
   app.js — Main application controller for FlashMind
   ========================================================= */

import {
  getAllDecks,
  getDeck,
  addDeck,
  deleteDeck,
  renameDeck,
  addCard,
  editCard,
  deleteCard,
  updateCardReview,
  getDueCards,
} from './storage.js';

import { processReview, previewIntervals } from './sm2.js';

import {
  exportDeckJSON,
  exportAllJSON,
  exportDeckCSV,
  importJSON,
  importCSV,
  readFileAsText,
} from './io.js';

/* --------------------------------------------------------- */
/* State                                                     */
/* --------------------------------------------------------- */

const state = {
  currentView: 'decks',   // 'decks' | 'deck-detail' | 'study'
  currentDeckId: null,
  studyQueue: [],          // cards due for this session
  studyIndex: 0,
  isFlipped: false,
  editingCardId: null,     // null = adding, string = editing
};

/* --------------------------------------------------------- */
/* DOM References                                            */
/* --------------------------------------------------------- */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Views
  viewDecks:      $('#view-decks'),
  viewDeckDetail: $('#view-deck-detail'),
  viewStudy:      $('#view-study'),

  // Header
  btnBack:       $('#btn-back'),
  headerTitle:   $('#header-title'),
  headerActions: $('#header-actions'),

  // Deck list
  deckList:      $('#deck-list'),
  decksEmpty:    $('#decks-empty'),
  btnAddDeck:    $('#btn-add-deck'),
  btnImport:     $('#btn-import'),
  btnExportAll:  $('#btn-export-all'),

  // Deck detail
  detailDeckName:   $('#detail-deck-name'),
  detailDeckStats:  $('#detail-deck-stats'),
  btnStudy:         $('#btn-study'),
  btnAddCard:       $('#btn-add-card'),
  btnRenameDeck:    $('#btn-rename-deck'),
  btnExportJSON:    $('#btn-export-deck-json'),
  btnExportCSV:     $('#btn-export-deck-csv'),
  btnDeleteDeck:    $('#btn-delete-deck'),
  cardList:         $('#card-list'),
  cardsEmpty:       $('#cards-empty'),

  // Study
  studyProgressText: $('#study-progress-text'),
  studyRemaining:    $('#study-remaining'),
  studyProgressFill: $('#study-progress-fill'),
  flipContainer:     $('#flip-container'),
  flipCard:          $('#flip-card'),
  cardFront:         $('#card-front'),
  cardBack:          $('#card-back'),
  answerButtons:     $('#answer-buttons'),
  studyComplete:     $('#study-complete'),
  studySummary:      $('#study-summary'),
  btnFinishStudy:    $('#btn-finish-study'),

  // Modals
  modalDeck:          $('#modal-deck'),
  modalDeckTitle:     $('#modal-deck-title'),
  modalDeckInput:     $('#modal-deck-input'),
  modalDeckCancel:    $('#modal-deck-cancel'),
  modalDeckConfirm:   $('#modal-deck-confirm'),

  modalCard:          $('#modal-card'),
  modalCardTitle:     $('#modal-card-title'),
  modalCardFront:     $('#modal-card-front'),
  modalCardBack:      $('#modal-card-back'),
  modalCardCancel:    $('#modal-card-cancel'),
  modalCardConfirm:   $('#modal-card-confirm'),

  modalImport:        $('#modal-import'),
  importFileInput:    $('#import-file-input'),
  importFilename:     $('#import-filename'),
  importCSVName:      $('#import-csv-name'),
  modalImportCancel:  $('#modal-import-cancel'),
  modalImportConfirm: $('#modal-import-confirm'),

  modalConfirm:       $('#modal-confirm'),
  modalConfirmText:   $('#modal-confirm-text'),
  modalConfirmCancel: $('#modal-confirm-cancel'),
  modalConfirmOk:     $('#modal-confirm-ok'),

  toastContainer:     $('#toast-container'),
};

/* --------------------------------------------------------- */
/* Router / View Switching                                   */
/* --------------------------------------------------------- */

function showView(viewName) {
  state.currentView = viewName;

  // Hide all views
  $$('.view').forEach((v) => {
    v.classList.remove('active', 'visible');
  });

  // Show target view
  let targetView;
  switch (viewName) {
    case 'decks':
      targetView = dom.viewDecks;
      dom.btnBack.classList.add('hidden');
      dom.headerTitle.textContent = 'FlashMind';
      renderDeckList();
      break;
    case 'deck-detail':
      targetView = dom.viewDeckDetail;
      dom.btnBack.classList.remove('hidden');
      renderDeckDetail();
      break;
    case 'study':
      targetView = dom.viewStudy;
      dom.btnBack.classList.remove('hidden');
      dom.headerTitle.textContent = 'Studying';
      break;
  }

  targetView.classList.add('active');
  // Trigger reflow for animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targetView.classList.add('visible');
    });
  });
}

/* --------------------------------------------------------- */
/* Deck List View                                            */
/* --------------------------------------------------------- */

function renderDeckList() {
  const decks = getAllDecks();

  if (decks.length === 0) {
    dom.deckList.innerHTML = '';
    dom.decksEmpty.classList.remove('hidden');
    return;
  }

  dom.decksEmpty.classList.add('hidden');

  dom.deckList.innerHTML = decks
    .map((deck) => {
      const dueCount = getDueCards(deck.id).length;
      const totalCount = deck.cards.length;

      return `
        <button class="deck-card glass-light p-4 text-left w-full cursor-pointer group" data-deck-id="${deck.id}">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <h3 class="font-semibold text-white truncate text-base">${escapeHTML(deck.name)}</h3>
              <p class="text-sm text-slate-400 mt-0.5">${totalCount} card${totalCount !== 1 ? 's' : ''}</p>
            </div>
            <div class="flex items-center gap-3 ml-3">
              ${dueCount > 0
                ? `<span class="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                    ${dueCount} due
                  </span>`
                : `<span class="text-xs text-slate-500">All caught up ✓</span>`
              }
              <svg class="text-slate-600 group-hover:text-slate-400 transition-colors" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l4 4-4 4"/></svg>
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  // Bind click events
  dom.deckList.querySelectorAll('.deck-card').forEach((el) => {
    el.addEventListener('click', () => {
      state.currentDeckId = el.dataset.deckId;
      showView('deck-detail');
    });
  });
}

/* --------------------------------------------------------- */
/* Deck Detail View                                          */
/* --------------------------------------------------------- */

function renderDeckDetail() {
  const deck = getDeck(state.currentDeckId);
  if (!deck) {
    showView('decks');
    return;
  }

  dom.headerTitle.textContent = deck.name;
  dom.detailDeckName.textContent = deck.name;

  const dueCount = getDueCards(deck.id).length;
  const totalCount = deck.cards.length;
  dom.detailDeckStats.textContent = `${totalCount} card${totalCount !== 1 ? 's' : ''} · ${dueCount} due for review`;

  // Study button state
  if (dueCount > 0) {
    dom.btnStudy.disabled = false;
    dom.btnStudy.classList.remove('opacity-40');
    dom.btnStudy.classList.add('pulse-glow');
  } else {
    dom.btnStudy.disabled = true;
    dom.btnStudy.classList.add('opacity-40');
    dom.btnStudy.classList.remove('pulse-glow');
  }

  // Render card list
  if (deck.cards.length === 0) {
    dom.cardList.innerHTML = '';
    dom.cardsEmpty.classList.remove('hidden');
    return;
  }

  dom.cardsEmpty.classList.add('hidden');

  dom.cardList.innerHTML = deck.cards
    .map((card) => {
      const isDue = new Date(card.nextReview) <= new Date();
      return `
        <div class="card-item glass-light p-3 flex items-center gap-3 rounded-xl" data-card-id="${card.id}">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">${escapeHTML(card.front)}</p>
            <p class="text-xs text-slate-400 truncate mt-0.5">${escapeHTML(card.back)}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${isDue
              ? '<span class="w-2 h-2 bg-indigo-400 rounded-full" title="Due now"></span>'
              : '<span class="w-2 h-2 bg-slate-600 rounded-full" title="Not due yet"></span>'
            }
            <button class="btn-edit-card p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors" data-card-id="${card.id}" aria-label="Edit card">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 1.5L11.5 3 4.5 10H3V8.5L10 1.5z"/></svg>
            </button>
            <button class="btn-delete-card p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors" data-card-id="${card.id}" aria-label="Delete card">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 4h8M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4"/></svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Bind card actions
  dom.cardList.querySelectorAll('.btn-edit-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditCardModal(btn.dataset.cardId);
    });
  });

  dom.cardList.querySelectorAll('.btn-delete-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteCard(btn.dataset.cardId);
    });
  });
}

/* --------------------------------------------------------- */
/* Study View                                                */
/* --------------------------------------------------------- */

function startStudy() {
  const dueCards = getDueCards(state.currentDeckId);
  if (dueCards.length === 0) {
    showToast('No cards due for review!', 'error');
    return;
  }

  // Shuffle due cards
  state.studyQueue = shuffleArray([...dueCards]);
  state.studyIndex = 0;
  state.isFlipped = false;

  // Hide complete screen, show card
  dom.studyComplete.classList.add('hidden');
  dom.flipContainer.classList.remove('hidden');
  dom.answerButtons.classList.remove('hidden');

  showView('study');
  showCurrentCard();
}

function showCurrentCard() {
  const card = state.studyQueue[state.studyIndex];
  if (!card) return;

  state.isFlipped = false;
  dom.flipCard.classList.remove('flipped');
  dom.answerButtons.style.opacity = '0';
  dom.answerButtons.style.pointerEvents = 'none';

  dom.cardFront.textContent = card.front;
  dom.cardBack.textContent = card.back;

  // Update progress
  const total = state.studyQueue.length;
  const current = state.studyIndex + 1;
  dom.studyProgressText.textContent = `${current} / ${total}`;
  dom.studyRemaining.textContent = `${total - current} remaining`;
  dom.studyProgressFill.style.width = `${(current / total) * 100}%`;

  // Preview intervals on buttons
  const previews = previewIntervals(card);
  $('#hint-again').textContent = previews[0].intervalLabel;
  $('#hint-hard').textContent = previews[1].intervalLabel;
  $('#hint-good').textContent = previews[2].intervalLabel;
  $('#hint-easy').textContent = previews[3].intervalLabel;
}

function flipCard() {
  if (state.isFlipped) return;
  state.isFlipped = true;
  dom.flipCard.classList.add('flipped');

  // Show answer buttons
  dom.answerButtons.style.opacity = '1';
  dom.answerButtons.style.pointerEvents = 'auto';
}

function answerCard(quality) {
  const card = state.studyQueue[state.studyIndex];
  if (!card) return;

  // Process SM-2 review
  const updatedFields = processReview(card, quality);
  updateCardReview(state.currentDeckId, card.id, updatedFields);

  // Move to next card
  state.studyIndex++;

  if (state.studyIndex >= state.studyQueue.length) {
    // Session complete
    showStudyComplete();
  } else {
    showCurrentCard();
  }
}

function showStudyComplete() {
  dom.flipContainer.classList.add('hidden');
  dom.answerButtons.classList.add('hidden');
  dom.studyComplete.classList.remove('hidden');

  const total = state.studyQueue.length;
  dom.studySummary.textContent = `You reviewed ${total} card${total !== 1 ? 's' : ''} in this session.`;
  dom.studyProgressFill.style.width = '100%';
  dom.studyProgressText.textContent = `${total} / ${total}`;
  dom.studyRemaining.textContent = 'Done!';
}

/* --------------------------------------------------------- */
/* Modals                                                    */
/* --------------------------------------------------------- */

function openModal(modalEl) {
  modalEl.classList.add('open');
}

function closeModal(modalEl) {
  modalEl.classList.remove('open');
}

// --- Deck Modal ---
let deckModalMode = 'add'; // 'add' | 'rename'

function openAddDeckModal() {
  deckModalMode = 'add';
  dom.modalDeckTitle.textContent = 'New Deck';
  dom.modalDeckInput.value = '';
  dom.modalDeckConfirm.textContent = 'Create';
  openModal(dom.modalDeck);
  setTimeout(() => dom.modalDeckInput.focus(), 100);
}

function openRenameDeckModal() {
  const deck = getDeck(state.currentDeckId);
  if (!deck) return;

  deckModalMode = 'rename';
  dom.modalDeckTitle.textContent = 'Rename Deck';
  dom.modalDeckInput.value = deck.name;
  dom.modalDeckConfirm.textContent = 'Save';
  openModal(dom.modalDeck);
  setTimeout(() => {
    dom.modalDeckInput.focus();
    dom.modalDeckInput.select();
  }, 100);
}

function handleDeckModalConfirm() {
  const name = dom.modalDeckInput.value.trim();
  if (!name) {
    showToast('Please enter a deck name.', 'error');
    return;
  }

  if (deckModalMode === 'add') {
    addDeck(name);
    showToast(`Deck "${name}" created!`, 'success');
    renderDeckList();
  } else {
    renameDeck(state.currentDeckId, name);
    showToast(`Deck renamed to "${name}".`, 'success');
    renderDeckDetail();
  }

  closeModal(dom.modalDeck);
}

// --- Card Modal ---
function openAddCardModal() {
  state.editingCardId = null;
  dom.modalCardTitle.textContent = 'Add Card';
  dom.modalCardFront.value = '';
  dom.modalCardBack.value = '';
  dom.modalCardConfirm.textContent = 'Add';
  openModal(dom.modalCard);
  setTimeout(() => dom.modalCardFront.focus(), 100);
}

function openEditCardModal(cardId) {
  const deck = getDeck(state.currentDeckId);
  if (!deck) return;

  const card = deck.cards.find((c) => c.id === cardId);
  if (!card) return;

  state.editingCardId = cardId;
  dom.modalCardTitle.textContent = 'Edit Card';
  dom.modalCardFront.value = card.front;
  dom.modalCardBack.value = card.back;
  dom.modalCardConfirm.textContent = 'Save';
  openModal(dom.modalCard);
  setTimeout(() => dom.modalCardFront.focus(), 100);
}

function handleCardModalConfirm() {
  const front = dom.modalCardFront.value.trim();
  const back = dom.modalCardBack.value.trim();

  if (!front || !back) {
    showToast('Please fill in both front and back.', 'error');
    return;
  }

  if (state.editingCardId) {
    editCard(state.currentDeckId, state.editingCardId, front, back);
    showToast('Card updated!', 'success');
  } else {
    addCard(state.currentDeckId, front, back);
    showToast('Card added!', 'success');
  }

  closeModal(dom.modalCard);
  renderDeckDetail();
}

// --- Import Modal ---
let importFile = null;

function openImportModal() {
  importFile = null;
  dom.importFileInput.value = '';
  dom.importFilename.classList.add('hidden');
  dom.importCSVName.value = '';
  openModal(dom.modalImport);
}

async function handleImportConfirm() {
  if (!importFile) {
    showToast('Please select a file.', 'error');
    return;
  }

  try {
    const content = await readFileAsText(importFile);
    const ext = importFile.name.split('.').pop().toLowerCase();

    let result;
    if (ext === 'json') {
      result = importJSON(content);
    } else if (ext === 'csv') {
      const deckName = dom.importCSVName.value.trim() || 'Imported Deck';
      result = importCSV(content, deckName);
    } else {
      showToast('Unsupported file type. Use .json or .csv', 'error');
      return;
    }

    showToast(result.message, result.success ? 'success' : 'error');

    if (result.success) {
      closeModal(dom.modalImport);
      renderDeckList();
    }
  } catch (e) {
    showToast(`Import failed: ${e.message}`, 'error');
  }
}

// --- Confirm Delete Modal ---
let confirmCallback = null;

function openConfirmModal(text, callback) {
  dom.modalConfirmText.textContent = text;
  confirmCallback = callback;
  openModal(dom.modalConfirm);
}

function confirmDeleteCard(cardId) {
  openConfirmModal('Are you sure you want to delete this card? This cannot be undone.', () => {
    deleteCard(state.currentDeckId, cardId);
    showToast('Card deleted.', 'success');
    renderDeckDetail();
  });
}

function confirmDeleteDeck() {
  const deck = getDeck(state.currentDeckId);
  if (!deck) return;

  openConfirmModal(
    `Delete "${deck.name}" and all its ${deck.cards.length} card(s)? This cannot be undone.`,
    () => {
      deleteDeck(state.currentDeckId);
      state.currentDeckId = null;
      showToast('Deck deleted.', 'success');
      showView('decks');
    }
  );
}

/* --------------------------------------------------------- */
/* Toast Notifications                                       */
/* --------------------------------------------------------- */

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2500);
}

/* --------------------------------------------------------- */
/* Helpers                                                   */
/* --------------------------------------------------------- */

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* --------------------------------------------------------- */
/* Event Bindings                                            */
/* --------------------------------------------------------- */

function init() {
  // --- Navigation ---
  dom.btnBack.addEventListener('click', () => {
    if (state.currentView === 'study') {
      showView('deck-detail');
    } else if (state.currentView === 'deck-detail') {
      showView('decks');
    }
  });

  // --- Deck List ---
  dom.btnAddDeck.addEventListener('click', openAddDeckModal);
  dom.btnImport.addEventListener('click', openImportModal);
  dom.btnExportAll.addEventListener('click', () => {
    const decks = getAllDecks();
    if (decks.length === 0) {
      showToast('No decks to export.', 'error');
      return;
    }
    exportAllJSON();
    showToast('All decks exported as JSON!', 'success');
  });

  // --- Deck Detail ---
  dom.btnStudy.addEventListener('click', startStudy);
  dom.btnAddCard.addEventListener('click', openAddCardModal);
  dom.btnRenameDeck.addEventListener('click', openRenameDeckModal);
  dom.btnDeleteDeck.addEventListener('click', confirmDeleteDeck);

  dom.btnExportJSON.addEventListener('click', () => {
    const deck = getDeck(state.currentDeckId);
    if (deck) {
      exportDeckJSON(deck);
      showToast('Deck exported as JSON!', 'success');
    }
  });

  dom.btnExportCSV.addEventListener('click', () => {
    const deck = getDeck(state.currentDeckId);
    if (deck) {
      exportDeckCSV(deck);
      showToast('Deck exported as CSV!', 'success');
    }
  });

  // --- Study ---
  dom.flipContainer.addEventListener('click', flipCard);

  $$('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = parseInt(btn.dataset.quality, 10);
      answerCard(q);
    });
  });

  dom.btnFinishStudy.addEventListener('click', () => {
    showView('deck-detail');
  });

  // --- Deck Modal ---
  dom.modalDeckCancel.addEventListener('click', () => closeModal(dom.modalDeck));
  dom.modalDeckConfirm.addEventListener('click', handleDeckModalConfirm);
  dom.modalDeckInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleDeckModalConfirm();
  });
  dom.modalDeck.addEventListener('click', (e) => {
    if (e.target === dom.modalDeck) closeModal(dom.modalDeck);
  });

  // --- Card Modal ---
  dom.modalCardCancel.addEventListener('click', () => closeModal(dom.modalCard));
  dom.modalCardConfirm.addEventListener('click', handleCardModalConfirm);
  dom.modalCard.addEventListener('click', (e) => {
    if (e.target === dom.modalCard) closeModal(dom.modalCard);
  });

  // --- Import Modal ---
  dom.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importFile = file;
      dom.importFilename.textContent = `Selected: ${file.name}`;
      dom.importFilename.classList.remove('hidden');
    }
  });
  dom.modalImportCancel.addEventListener('click', () => closeModal(dom.modalImport));
  dom.modalImportConfirm.addEventListener('click', handleImportConfirm);
  dom.modalImport.addEventListener('click', (e) => {
    if (e.target === dom.modalImport) closeModal(dom.modalImport);
  });

  // --- Confirm Modal ---
  dom.modalConfirmCancel.addEventListener('click', () => closeModal(dom.modalConfirm));
  dom.modalConfirmOk.addEventListener('click', () => {
    closeModal(dom.modalConfirm);
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });
  dom.modalConfirm.addEventListener('click', (e) => {
    if (e.target === dom.modalConfirm) closeModal(dom.modalConfirm);
  });

  // --- Keyboard shortcut: Escape to close modals ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal-overlay.open').forEach((m) => closeModal(m));
    }
    // Space to flip card during study
    if (e.key === ' ' && state.currentView === 'study' && !state.isFlipped) {
      e.preventDefault();
      flipCard();
    }
    // 1-4 keys for answer buttons during study
    if (state.currentView === 'study' && state.isFlipped) {
      const keyMap = { '1': 0, '2': 2, '3': 3, '4': 5 };
      if (keyMap[e.key] !== undefined) {
        answerCard(keyMap[e.key]);
      }
    }
  });

  // --- Initial render ---
  showView('decks');
}

// Boot up
init();
