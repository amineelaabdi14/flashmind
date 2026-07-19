/* =========================================================
   sm2.js — SM-2 Spaced Repetition Algorithm for FlashMind
   ========================================================= */

/**
 * Quality ratings mapped to button labels
 *   Again = 0  (complete failure, reset)
 *   Hard  = 2  (correct but very difficult)
 *   Good  = 3  (correct with some effort)
 *   Easy  = 5  (effortless recall)
 */

/**
 * Process a review and return updated SM-2 fields.
 *
 * @param {object} card - The card being reviewed (needs interval, repetition, easeFactor)
 * @param {number} quality - Quality of recall: 0 (Again), 2 (Hard), 3 (Good), 5 (Easy)
 * @returns {object} Updated fields: { interval, repetition, easeFactor, nextReview, lastReview }
 */
function processReview(card, quality) {
  let { interval, repetition, easeFactor } = card;

  // Clamp ease factor minimum
  const EF_MIN = 1.3;

  if (quality < 3) {
    // Failed recall — reset
    repetition = 0;
    // Again = review Now (0 days), Hard = 1 day
    interval = quality === 0 ? 0 : 1;
  } else {
    // Successful recall
    if (repetition === 0) {
      if (quality === 5) {
        interval = 4; // Easy on new card
      } else if (quality === 3) {
        interval = 2; // Good on new card
      } else {
        interval = 1;
      }
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  // Update ease factor (applied regardless of pass/fail)
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (easeFactor < EF_MIN) {
    easeFactor = EF_MIN;
  }

  // Calculate next review date
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    interval,
    repetition,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReview: nextReview.toISOString(),
    lastReview: now.toISOString(),
  };
}

/**
 * Get a human-readable label for the next review interval
 */
function getIntervalLabel(interval) {
  if (interval === 0) return 'Now';
  if (interval === 1) return '1 day';
  if (interval < 30) return `${interval} days`;
  if (interval < 365) {
    const months = Math.round(interval / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.round(interval / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Preview what interval each button would produce (for button labels)
 */
function previewIntervals(card) {
  const qualities = [
    { label: 'Again', q: 0 },
    { label: 'Hard', q: 2 },
    { label: 'Good', q: 3 },
    { label: 'Easy', q: 5 },
  ];

  return qualities.map(({ label, q }) => {
    const result = processReview(card, q);
    return {
      label,
      quality: q,
      intervalLabel: getIntervalLabel(result.interval),
    };
  });
}

export { processReview, getIntervalLabel, previewIntervals };
