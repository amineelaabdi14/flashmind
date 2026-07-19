/* =========================================================
   io.js — Import / Export module for FlashMind
   ========================================================= */

import { loadData, saveData, generateId } from './storage.js';

/* ---------- Export ---------- */

/**
 * Export a single deck as JSON (preserves all SM-2 data)
 */
function exportDeckJSON(deck) {
  const blob = new Blob([JSON.stringify(deck, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${sanitizeFilename(deck.name)}.json`);
}

/**
 * Export all decks as JSON
 */
function exportAllJSON() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, 'flashmind_backup.json');
}

/**
 * Export a single deck as CSV (front, back only — human-readable)
 */
function exportDeckCSV(deck) {
  const rows = [['front', 'back']];
  deck.cards.forEach((card) => {
    rows.push([escapeCSV(card.front), escapeCSV(card.back)]);
  });
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `${sanitizeFilename(deck.name)}.csv`);
}

/* ---------- Import ---------- */

/**
 * Import from a JSON file. Returns { success, message, deckCount }
 */
function importJSON(fileContent) {
  try {
    const parsed = JSON.parse(fileContent);
    const data = loadData();

    // If it's a full backup (has "decks" array)
    if (parsed.decks && Array.isArray(parsed.decks)) {
      let imported = 0;
      parsed.decks.forEach((importedDeck) => {
        const newDeck = prepareDeckForImport(importedDeck);
        data.decks.push(newDeck);
        imported++;
      });
      saveData(data);
      return {
        success: true,
        message: `Imported ${imported} deck(s) successfully.`,
        deckCount: imported,
      };
    }

    // If it's a single deck (has "name" and "cards")
    if (parsed.name && parsed.cards) {
      const newDeck = prepareDeckForImport(parsed);
      data.decks.push(newDeck);
      saveData(data);
      return {
        success: true,
        message: `Imported deck "${newDeck.name}" with ${newDeck.cards.length} card(s).`,
        deckCount: 1,
      };
    }

    return { success: false, message: 'Unrecognized JSON format.', deckCount: 0 };
  } catch (e) {
    return {
      success: false,
      message: `Invalid JSON: ${e.message}`,
      deckCount: 0,
    };
  }
}

/**
 * Import from a CSV file. Creates a new deck. Returns { success, message }
 */
function importCSV(fileContent, deckName) {
  try {
    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return { success: false, message: 'CSV file is empty.' };
    }

    // Detect if first row is a header
    const firstRow = parseCSVLine(lines[0]);
    let startIdx = 0;
    if (
      firstRow.length >= 2 &&
      firstRow[0].toLowerCase() === 'front' &&
      firstRow[1].toLowerCase() === 'back'
    ) {
      startIdx = 1;
    }

    const cards = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length >= 2 && cols[0].trim() && cols[1].trim()) {
        cards.push({
          id: generateId(),
          front: cols[0].trim(),
          back: cols[1].trim(),
          interval: 0,
          repetition: 0,
          easeFactor: 2.5,
          nextReview: new Date().toISOString(),
          lastReview: null,
        });
      }
    }

    if (cards.length === 0) {
      return {
        success: false,
        message: 'No valid cards found. Expected at least 2 columns (front, back).',
      };
    }

    const data = loadData();
    const deck = {
      id: generateId(),
      name: deckName || 'Imported Deck',
      createdAt: new Date().toISOString(),
      cards,
    };
    data.decks.push(deck);
    saveData(data);

    return {
      success: true,
      message: `Created deck "${deck.name}" with ${cards.length} card(s).`,
    };
  } catch (e) {
    return { success: false, message: `CSV import error: ${e.message}` };
  }
}

/* ---------- Helpers ---------- */

function prepareDeckForImport(importedDeck) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: importedDeck.name || 'Imported Deck',
    createdAt: importedDeck.createdAt || now,
    cards: (importedDeck.cards || []).map((c) => ({
      id: generateId(),
      front: c.front || '',
      back: c.back || '',
      interval: c.interval || 0,
      repetition: c.repetition || 0,
      easeFactor: c.easeFactor || 2.5,
      nextReview: c.nextReview || now,
      lastReview: c.lastReview || null,
    })),
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_');
}

/* ---------- File reader helper ---------- */

/**
 * Read a file from an <input type="file"> element
 * Returns a Promise<string>
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export {
  exportDeckJSON,
  exportAllJSON,
  exportDeckCSV,
  importJSON,
  importCSV,
  readFileAsText,
};
