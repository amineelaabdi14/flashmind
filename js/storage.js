/* =========================================================
   storage.js — LocalStorage persistence layer for FlashMind
   ========================================================= */

const STORAGE_KEY = 'flashmind_data';

/**
 * Generate a simple UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load all app data from localStorage
 */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('Corrupted storage data, resetting.');
    }
  }
  const initial = { decks: [] };
  saveData(initial);
  return initial;
}

/**
 * Save full app data to localStorage
 */
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ---------- Deck operations ---------- */

function addDeck(name) {
  const data = loadData();
  const deck = {
    id: generateId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    cards: [],
  };
  data.decks.push(deck);
  saveData(data);
  return deck;
}

function deleteDeck(deckId) {
  const data = loadData();
  data.decks = data.decks.filter((d) => d.id !== deckId);
  saveData(data);
}

function renameDeck(deckId, newName) {
  const data = loadData();
  const deck = data.decks.find((d) => d.id === deckId);
  if (deck) {
    deck.name = newName.trim();
    saveData(data);
  }
}

function getDeck(deckId) {
  const data = loadData();
  return data.decks.find((d) => d.id === deckId) || null;
}

function getAllDecks() {
  return loadData().decks;
}

/* ---------- Card operations ---------- */

function addCard(deckId, front, back) {
  const data = loadData();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return null;

  const card = {
    id: generateId(),
    front: front.trim(),
    back: back.trim(),
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: new Date().toISOString(),
    lastReview: null,
  };
  deck.cards.push(card);
  saveData(data);
  return card;
}

function editCard(deckId, cardId, front, back) {
  const data = loadData();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return;

  const card = deck.cards.find((c) => c.id === cardId);
  if (card) {
    card.front = front.trim();
    card.back = back.trim();
    saveData(data);
  }
}

function deleteCard(deckId, cardId) {
  const data = loadData();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return;

  deck.cards = deck.cards.filter((c) => c.id !== cardId);
  saveData(data);
}

function updateCardReview(deckId, cardId, updatedFields) {
  const data = loadData();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return;

  const card = deck.cards.find((c) => c.id === cardId);
  if (card) {
    Object.assign(card, updatedFields);
    saveData(data);
  }
}

/**
 * Get all cards due for review (nextReview <= now)
 */
function getDueCards(deckId) {
  const deck = getDeck(deckId);
  if (!deck) return [];

  const now = new Date();
  return deck.cards.filter((c) => new Date(c.nextReview) <= now);
}

/* ---------- Exports ---------- */

export {
  generateId,
  loadData,
  saveData,
  addDeck,
  deleteDeck,
  renameDeck,
  getDeck,
  getAllDecks,
  addCard,
  editCard,
  deleteCard,
  updateCardReview,
  getDueCards,
};
