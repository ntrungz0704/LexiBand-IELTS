/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Word {
  id: string;
  word: string;
  band: "0.0-4.0" | "4.5-5.5" | "6.0-6.5";
  ipa: string;
  meaning: string;
  definition: string;
  example: string;
  exampleTranslation: string;
  collocations: string[];
  synonyms: string[];
  topic: string;
  partOfSpeech?: string;
}

export type WordStatus = "new" | "learning" | "mastered";

export interface WordProgress {
  wordId: string;
  status: WordStatus;
  interval: number; // in days
  repetition: number; // number of consecutive correct reviews
  efactor: number; // easiness factor (SM-2, default is 2.5)
  nextReviewDate: string; // ISO string YYYY-MM-DD
  lastReviewedDate?: string; // ISO string YYYY-MM-DD
  isStarred?: boolean;
}

export interface UserProgress {
  [wordId: string]: WordProgress;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string; // YYYY-MM-DD
  history: { [date: string]: number }; // YYYY-MM-DD -> number of words practiced
}

export interface PracticeHistoryItem {
  date: string; // YYYY-MM-DD
  score: number;
  type: string;
}

export type PracticeMode = "flashcard" | "multiple-choice" | "fill-blank";

export const IELTS_BANDS = [
  { key: "0.0-4.0", label: "Foundation (0.0 - 4.0)", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "4.5-5.5", label: "Intermediate (4.5 - 5.5)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "6.0-6.5", label: "Competent (6.0 - 6.5)", color: "bg-amber-50 text-amber-700 border-amber-200" }
] as const;

export const TOPICS = [
  "Education",
  "Environment",
  "Health",
  "Technology",
  "Crime",
  "Urbanization",
  "Work & Career",
  "Economy",
  "Society",
  "General"
] as const;

export function formatIELTSBand(band?: string): string {
  if (!band) return "Band N/A";
  if (band === "0.0-4.0") return "Band 4.0";
  if (band === "4.5-5.5") return "Band 5.5";
  if (band === "6.0-6.5") return "Band 6.5";
  return band.startsWith("Band") ? band : `Band ${band}`;
}
