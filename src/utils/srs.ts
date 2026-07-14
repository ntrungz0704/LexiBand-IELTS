/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WordProgress, WordStatus } from "../types";

/**
 * Calculates the next review date and parameters for a word using the SM-2 algorithm.
 * Quality ratings (q) are from 0 to 5:
 * 5 - Perfect response (Easy)
 * 4 - Correct response after a hesitation (Good)
 * 3 - Correct response recalled with serious difficulty (Hard)
 * 2 - Incorrect response; where the correct one seemed easy to recall
 * 1 - Incorrect response; the correct one remembered
 * 0 - Complete blackout
 * 
 * For simplicity in our app, we map user buttons:
 * - "Forgot" (Quên) -> quality 1 (incorrect)
 * - "Hard" (Khó) -> quality 3 (correct but difficult)
 * - "Good" (Tốt) -> quality 4 (correct with hesitation)
 * - "Easy" (Dễ) -> quality 5 (perfect recall)
 */
export function calculateSM2(
  quality: 1 | 3 | 4 | 5,
  prevInterval: number,
  prevRepetition: number,
  prevEFactor: number
): { interval: number; repetition: number; efactor: number; nextReviewDate: string; status: WordStatus } {
  let interval = 1;
  let repetition = prevRepetition;
  let efactor = prevEFactor;

  // If the response is correct (quality >= 3)
  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 3; // Standard SM-2 is 6, but for quick digital learning, 3 is more motivating initially
    } else {
      interval = Math.round(prevInterval * efactor);
    }
    repetition = repetition + 1;
  } else {
    // Incorrect response (Forgot)
    repetition = 0;
    interval = 1;
  }

  // Adjust Easiness Factor
  efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (efactor < 1.3) {
    efactor = 1.3;
  }

  // Limit interval to a reasonable maximum (e.g., 365 days)
  if (interval > 365) {
    interval = 365;
  }

  // Determine status based on quality and repetitions
  let status: WordStatus = "learning";
  if (quality === 5 || (repetition >= 3 && quality >= 4)) {
    status = "mastered";
  } else if (quality === 1) {
    status = "learning";
  }

  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  
  // Format YYYY-MM-DD
  const nextReviewDate = nextReview.toISOString().split("T")[0];

  return {
    interval,
    repetition,
    efactor,
    nextReviewDate,
    status
  };
}

/**
 * Helper to check if a word is due for review today or earlier.
 */
export function isDue(nextReviewDateStr: string, currentDateStr: string): boolean {
  const nextReview = new Date(nextReviewDateStr);
  const current = new Date(currentDateStr);
  
  // Set times to midnight to compare dates only
  nextReview.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  return nextReview.getTime() <= current.getTime();
}

/**
 * Returns formatted date string (YYYY-MM-DD)
 */
export function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}
