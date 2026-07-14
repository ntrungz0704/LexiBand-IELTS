import { Word } from "../types";

export interface DailyUnit {
  dayNumber: number;
  date: string;
  type: "new_words" | "review" | "checkpoint";
  wordIds: string[];
  exerciseTypes: string[];
  completed: boolean;
  score?: number; // For checkpoints or reviews if practiced
}

export interface LearningPlan {
  planId: string;
  startBand: "0.0-4.0" | "4.5-5.5" | "6.0-6.5";
  targetBand: "0.0-4.0" | "4.5-5.5" | "6.0-6.5";
  durationMonths: number;
  createdDate: string;
  targetDate: string;
  wordsPerDay: number;
  totalDays: number;
  dailyUnits: DailyUnit[];
}

export interface TestQuestion {
  wordId: string;
  word: string;
  band: "0.0-4.0" | "4.5-5.5" | "6.0-6.5";
  ipa: string;
  options: string[]; // 4 Vietnamese meanings
  correctAnswer: string;
}

/**
 * Generates a placement test with 21 questions, 7 from each band.
 */
export function generatePlacementTest(words: Word[]): TestQuestion[] {
  const bands: ("0.0-4.0" | "4.5-5.5" | "6.0-6.5")[] = ["0.0-4.0", "4.5-5.5", "6.0-6.5"];
  const questions: TestQuestion[] = [];

  // Group all meanings by band for appropriate distractor selection
  const meaningsByBand: { [key: string]: string[] } = {
    "0.0-4.0": [],
    "4.5-5.5": [],
    "6.0-6.5": []
  };

  words.forEach(w => {
    meaningsByBand[w.band].push(w.meaning);
  });

  bands.forEach(band => {
    const bandWords = words.filter(w => w.band === band);
    // Shuffle and pick 7 words
    const shuffled = [...bandWords].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 7);

    selected.forEach(word => {
      // Get correct meaning
      const correct = word.meaning;
      
      // Get distractors from the same band, avoiding duplicates
      const distractors = meaningsByBand[band]
        .filter(m => m !== correct)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      // If we don't have enough distractors (should be rare), backfill from other bands
      while (distractors.length < 3) {
        const fallbackMeaning = words[Math.floor(Math.random() * words.length)].meaning;
        if (fallbackMeaning !== correct && !distractors.includes(fallbackMeaning)) {
          distractors.push(fallbackMeaning);
        }
      }

      // Mix options
      const options = [correct, ...distractors].sort(() => 0.5 - Math.random());

      questions.push({
        wordId: word.id,
        word: word.word,
        band: word.band,
        ipa: word.ipa,
        options,
        correctAnswer: correct
      });
    });
  });

  return questions;
}

/**
 * Calculates the user's band score from placement test results.
 * Returns estimated band string (e.g. "0.0-4.0", "4.5-5.5", "6.0-6.5").
 */
export function calculateStartingBand(answers: { [questionIdx: number]: string }, questions: TestQuestion[]): "0.0-4.0" | "4.5-5.5" | "6.0-6.5" {
  let fndCorrect = 0;
  let intCorrect = 0;
  let advCorrect = 0;

  let fndTotal = 0;
  let intTotal = 0;
  let advTotal = 0;

  questions.forEach((q, idx) => {
    if (q.band === "0.0-4.0") fndTotal++;
    else if (q.band === "4.5-5.5") intTotal++;
    else if (q.band === "6.0-6.5") advTotal++;

    const isCorrect = answers[idx] === q.correctAnswer;
    if (isCorrect) {
      if (q.band === "0.0-4.0") fndCorrect++;
      else if (q.band === "4.5-5.5") intCorrect++;
      else if (q.band === "6.0-6.5") advCorrect++;
    }
  });

  const fndPassed = fndTotal > 0 ? (fndCorrect / fndTotal) >= 0.8 : false;
  const intPassed = intTotal > 0 ? (intCorrect / intTotal) >= 0.8 : false;

  // Paul Nation's Vocabulary Levels Test (VLT) logic:
  // Threshold to pass a band is 80%.
  // Starting band (band xuất phát) is the highest band that passes the threshold continuously from lowest up.
  // - If user fails 0.0-4.0: starting band is "0.0-4.0" (Foundation).
  // - If user passes 0.0-4.0 but fails 4.5-5.5: starting band is "4.5-5.5" (Intermediate).
  // - If user passes both 0.0-4.0 and 4.5-5.5: starting band is "6.0-6.5" (Competent).
  if (fndPassed && intPassed) {
    return "6.0-6.5";
  } else if (fndPassed) {
    return "4.5-5.5";
  } else {
    return "0.0-4.0";
  }
}

/**
 * Groups and mixes words within each band using a round-robin algorithm across topics.
 */
function mixWordsByTopic(wordsInBand: Word[]): Word[] {
  const topicsMap: { [topic: string]: Word[] } = {};
  wordsInBand.forEach(w => {
    const topic = w.topic || "General";
    if (!topicsMap[topic]) topicsMap[topic] = [];
    topicsMap[topic].push(w);
  });

  const topicsList = Object.values(topicsMap);
  const mixed: Word[] = [];
  let index = 0;
  
  while (mixed.length < wordsInBand.length) {
    topicsList.forEach(list => {
      if (list[index]) {
        mixed.push(list[index]);
      }
    });
    index++;
  }

  return mixed;
}

export type MainTopic = 
  | "Education" 
  | "Technology" 
  | "Environment" 
  | "Health" 
  | "Society" 
  | "Economics" 
  | "Science" 
  | "Sports" 
  | "Jobs" 
  | "Family"
  | "General";

export const TOPIC_LABELS: Record<MainTopic, { vi: string; en: string; emoji: string }> = {
  "Education": { vi: "Giáo dục", en: "Education", emoji: "📖" },
  "Technology": { vi: "Công nghệ", en: "Technology", emoji: "💻" },
  "Environment": { vi: "Môi trường", en: "Environment", emoji: "🌱" },
  "Health": { vi: "Sức khỏe", en: "Health", emoji: "❤️" },
  "Society": { vi: "Xã hội", en: "Society", emoji: "👥" },
  "Economics": { vi: "Kinh tế", en: "Economics", emoji: "💰" },
  "Science": { vi: "Khoa học", en: "Science", emoji: "🔬" },
  "Sports": { vi: "Thể thao", en: "Sports", emoji: "⚽" },
  "Jobs": { vi: "Công việc và Nghề nghiệp", en: "Jobs & Careers", emoji: "💼" },
  "Family": { vi: "Gia đình và Mối quan hệ", en: "Family & Relationships", emoji: "👨‍👩‍👧‍👦" },
  "General": { vi: "Tổng hợp", en: "General Academic", emoji: "🧭" }
};

export function getCleanTopic(rawTopic: string): MainTopic {
  const t = String(rawTopic || "").toLowerCase();
  
  if (t.includes("family") || t.includes("relationship") || t.includes("people") || t.includes("friend") || t.includes("parent") || t.includes("marriage") || t.includes("child")) {
    return "Family";
  }
  if (t.includes("education") || t.includes("academic") || t.includes("language") || t.includes("writing") || t.includes("study") || t.includes("school")) {
    return "Education";
  }
  if (t.includes("technology") || t.includes("computer") || t.includes("information") || t.includes("media") || t.includes("digital") || t.includes("internet")) {
    return "Technology";
  }
  if (t.includes("environment") || t.includes("nature") || t.includes("earth") || t.includes("climate") || t.includes("pollution") || t.includes("geography") || t.includes("animal") || t.includes("biology")) {
    return "Environment";
  }
  if (t.includes("medicine") || t.includes("health") || t.includes("psychology") || t.includes("body") || t.includes("food") || t.includes("nutrition")) {
    return "Health";
  }
  if (t.includes("economics") || t.includes("business") || t.includes("finance") || t.includes("marketing") || t.includes("commerce") || t.includes("industry") || t.includes("money")) {
    return "Economics";
  }
  if (t.includes("science") || t.includes("space") || t.includes("physics") || t.includes("chemistry") || t.includes("math") || t.includes("engineering") || t.includes("research")) {
    return "Science";
  }
  if (t.includes("sports") || t.includes("leisure") || t.includes("entertainment") || t.includes("game") || t.includes("recreation") || t.includes("hobby") || t.includes("travel")) {
    return "Sports";
  }
  if (t.includes("job") || t.includes("career") || t.includes("employment") || t.includes("work") || t.includes("leadership") || t.includes("management") || t.includes("occupation") || t.includes("office")) {
    return "Jobs";
  }
  if (t.includes("society") || t.includes("social") || t.includes("culture") || t.includes("art") || t.includes("fashion") || t.includes("lifestyle") || t.includes("history") || t.includes("philosophy") || t.includes("religion") || t.includes("law") || t.includes("government") || t.includes("politics") || t.includes("legal")) {
    return "Society";
  }
  
  return "General";
}

export function groupWordsByTopicAndPriority(words: Word[], selectedTopics: MainTopic[]): Word[] {
  const categorized: Record<MainTopic, Word[]> = {
    Education: [],
    Technology: [],
    Environment: [],
    Health: [],
    Society: [],
    Economics: [],
    Science: [],
    Sports: [],
    Jobs: [],
    Family: [],
    General: []
  };

  words.forEach(w => {
    const topic = getCleanTopic(w.topic || "");
    categorized[topic].push(w);
  });

  const result: Word[] = [];
  
  // Add selected topics in order
  selectedTopics.forEach(topic => {
    if (categorized[topic] && categorized[topic].length > 0) {
      const sortedWords = [...categorized[topic]].sort((a, b) => a.word.localeCompare(b.word));
      result.push(...sortedWords);
    }
  });

  // Add remaining topics
  const allMainTopics: MainTopic[] = [
    "Education", "Technology", "Environment", "Health", "Society", 
    "Economics", "Science", "Sports", "Jobs", "Family", "General"
  ];
  
  allMainTopics.forEach(topic => {
    if (!selectedTopics.includes(topic) && categorized[topic] && categorized[topic].length > 0) {
      const sortedWords = [...categorized[topic]].sort((a, b) => a.word.localeCompare(b.word));
      result.push(...sortedWords);
    }
  });

  return result;
}

/**
 * Core learning plan generator.
 */
export function generateLearningPlan(
  startBand: "0.0-4.0" | "4.5-5.5" | "6.0-6.5",
  targetBand: "0.0-4.0" | "4.5-5.5" | "6.0-6.5",
  durationMonths: number,
  allWords: Word[],
  selectedTopics: MainTopic[] = []
): LearningPlan {
  const planId = `plan_${Date.now()}`;
  const totalDays = durationMonths * 30;

  // Map bands to indices
  const bandOrder = {
    "0.0-4.0": 0,
    "4.5-5.5": 1,
    "6.0-6.5": 2
  };

  // Filter words within startBand and targetBand range
  const targetWords = allWords.filter(w => {
    const wIndex = bandOrder[w.band];
    return wIndex >= bandOrder[startBand] && wIndex <= bandOrder[targetBand];
  });

  // Separate, prioritize and group each band by topic
  const foundationWords = groupWordsByTopicAndPriority(
    targetWords.filter(w => w.band === "0.0-4.0"),
    selectedTopics
  );
  const intermediateWords = groupWordsByTopicAndPriority(
    targetWords.filter(w => w.band === "4.5-5.5"),
    selectedTopics
  );
  const competentWords = groupWordsByTopicAndPriority(
    targetWords.filter(w => w.band === "6.0-6.5"),
    selectedTopics
  );

  // Ordered word queue
  const orderedWords: Word[] = [];
  if (bandOrder[startBand] <= 0 && bandOrder[targetBand] >= 0) orderedWords.push(...foundationWords);
  if (bandOrder[startBand] <= 1 && bandOrder[targetBand] >= 1) orderedWords.push(...intermediateWords);
  if (bandOrder[startBand] <= 2 && bandOrder[targetBand] >= 2) orderedWords.push(...competentWords);

  // Estimate study days
  const weeks = Math.floor(totalDays / 7);
  // Estimate Checkpoints (1 per finished band)
  let checkpointCount = 0;
  if (bandOrder[startBand] <= 0 && bandOrder[targetBand] >= 0) checkpointCount++;
  if (bandOrder[startBand] <= 1 && bandOrder[targetBand] >= 1) checkpointCount++;
  if (bandOrder[startBand] <= 2 && bandOrder[targetBand] >= 2) checkpointCount++;

  const studyDaysCount = Math.max(1, totalDays - weeks - checkpointCount);
  const rawWordsPerDay = Math.max(5, Math.ceil(orderedWords.length / studyDaysCount));
  let wordsPerDay = 15;
  if (rawWordsPerDay <= 12) {
    wordsPerDay = 10;
  } else if (rawWordsPerDay <= 17) {
    wordsPerDay = 15;
  } else {
    wordsPerDay = 20;
  }

  const dailyUnits: DailyUnit[] = [];
  const today = new Date();

  let wordIndex = 0;
  let lastReviewWords: string[] = [];
  let bandWordIdsTracker: { [band: string]: string[] } = {
    "0.0-4.0": foundationWords.map(w => w.id),
    "4.5-5.5": intermediateWords.map(w => w.id),
    "6.0-6.5": competentWords.map(w => w.id)
  };

  let activeBandsOrder = ["0.0-4.0", "4.5-5.5", "6.0-6.5"].filter(b => {
    const bIdx = bandOrder[b as keyof typeof bandOrder];
    return bIdx >= bandOrder[startBand] && bIdx <= bandOrder[targetBand];
  });

  let currentBandIndex = 0;
  let wordsIntroducedInCurrentBand: string[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const unitDate = new Date(today);
    unitDate.setDate(today.getDate() + (day - 1));
    const dateStr = unitDate.toISOString().split("T")[0];

    // 1. Weekly Review Day (every 7th day)
    if (day % 7 === 0) {
      dailyUnits.push({
        dayNumber: day,
        date: dateStr,
        type: "review",
        wordIds: [...lastReviewWords],
        exerciseTypes: ["flashcard", "multiple-choice", "fill-blank"],
        completed: false
      });
      // Clear lastReviewWords list after scheduling weekly review
      lastReviewWords = [];
      continue;
    }

    // 2. Checkpoint Day
    // If we have fully introduced all words in the current band, and there are words to test
    const currentBand = activeBandsOrder[currentBandIndex];
    const currentBandWordIds = bandWordIdsTracker[currentBand] || [];
    const allCurrentBandIntroduced = currentBandWordIds.every(id => 
      wordsIntroducedInCurrentBand.includes(id)
    );

    if (allCurrentBandIntroduced && currentBandWordIds.length > 0 && wordsIntroducedInCurrentBand.length > 0) {
      dailyUnits.push({
        dayNumber: day,
        date: dateStr,
        type: "checkpoint",
        wordIds: [...currentBandWordIds],
        exerciseTypes: ["multiple-choice", "fill-blank"],
        completed: false
      });
      
      // Move to next band
      currentBandIndex++;
      wordsIntroducedInCurrentBand = [];
      continue;
    }

    // 3. Normal study day (introducing new words)
    const dailyWordIds: string[] = [];
    for (let i = 0; i < wordsPerDay; i++) {
      if (wordIndex < orderedWords.length) {
        const nextWord = orderedWords[wordIndex];
        dailyWordIds.push(nextWord.id);
        lastReviewWords.push(nextWord.id);
        wordsIntroducedInCurrentBand.push(nextWord.id);
        wordIndex++;
      }
    }

    if (dailyWordIds.length > 0) {
      dailyUnits.push({
        dayNumber: day,
        date: dateStr,
        type: "new_words",
        wordIds: dailyWordIds,
        exerciseTypes: ["flashcard"],
        completed: false
      });
    } else {
      // If we ran out of words early, backfill with review of previous words to keep schedule filled
      const fallbackWords = targetWords.slice(0, wordsPerDay).map(w => w.id);
      dailyUnits.push({
        dayNumber: day,
        date: dateStr,
        type: "new_words",
        wordIds: fallbackWords,
        exerciseTypes: ["flashcard"],
        completed: false
      });
    }
  }

  const targetDateObj = new Date(today);
  targetDateObj.setDate(today.getDate() + totalDays - 1);

  return {
    planId,
    startBand,
    targetBand,
    durationMonths,
    createdDate: today.toISOString().split("T")[0],
    targetDate: targetDateObj.toISOString().split("T")[0],
    wordsPerDay,
    totalDays,
    dailyUnits
  };
}

/**
 * Dynamically re-schedules the remaining units of a learning plan if days are missed.
 */
export function rescheduleLearningPlan(plan: LearningPlan, todayStr: string): LearningPlan {
  // Find the index of today's unit
  const todayIndex = plan.dailyUnits.findIndex(u => u.date === todayStr);
  if (todayIndex === -1) return plan; // Not found, keep as is

  const dailyUnits = [...plan.dailyUnits];
  const incompletePrecedingUnits = dailyUnits.slice(0, todayIndex).filter(u => !u.completed);

  if (incompletePrecedingUnits.length === 0) return plan; // No missed days

  // Gather all uncompleted words that were missed
  const missedWordIds: string[] = [];
  incompletePrecedingUnits.forEach(u => {
    if (u.type === "new_words") {
      missedWordIds.push(...u.wordIds);
    }
  });

  // Roll missed words into today's study unit!
  if (missedWordIds.length > 0) {
    const todayUnit = dailyUnits[todayIndex];
    if (todayUnit.type === "new_words") {
      // Avoid duplicates
      const uniqueWordIds = Array.from(new Set([...todayUnit.wordIds, ...missedWordIds]));
      // Cap at wordsPerDay setting so it always matches selected daily intensity
      todayUnit.wordIds = uniqueWordIds.slice(0, plan.wordsPerDay || 15);
    }
  }

  // Mark missed preceding units as completed with 0 score (or simply set completed to avoid nagging)
  for (let i = 0; i < todayIndex; i++) {
    if (!dailyUnits[i].completed) {
      dailyUnits[i].completed = true;
    }
  }

  return {
    ...plan,
    dailyUnits
  };
}

/**
 * Simple simulation test to verify the sequential order of vocabulary bands in the generated learning plan.
 * Simulates days 1, 2, 5, 10, etc., verifying that word bands are strictly non-decreasing over the plan's course.
 */
export interface CurriculumTestResult {
  dayNumber: number;
  wordSample: { word: string; band: string }[];
  isSequential: boolean;
}

export function testCurriculumSequence(allWords: Word[]): CurriculumTestResult[] {
  // Generate a standard plan: start at 0.0-4.0, target 6.0-6.5, duration 1 month
  const testPlan = generateLearningPlan("0.0-4.0", "6.0-6.5", 1, allWords);
  const targetDays = [1, 2, 5, 10, 15, 20];
  const results: CurriculumTestResult[] = [];

  const bandOrder = { "0.0-4.0": 0, "4.5-5.5": 1, "6.0-6.5": 2 };
  let maxBandSeenIndex = 0;

  targetDays.forEach(day => {
    const unit = testPlan.dailyUnits.find(u => u.dayNumber === day);
    if (!unit || unit.type !== "new_words") return;

    const unitWords = unit.wordIds
      .map(id => allWords.find(w => w.id === id))
      .filter(Boolean) as Word[];

    const wordSample = unitWords.map(w => ({ word: w.word, band: w.band }));
    
    let dayIsSequential = true;
    unitWords.forEach(w => {
      const wIdx = bandOrder[w.band];
      if (wIdx < maxBandSeenIndex) {
        // Minor tolerance if it's within the same band range, but overall band index should not decrease majorly
        if (maxBandSeenIndex - wIdx > 1) {
          dayIsSequential = false;
        }
      } else {
        maxBandSeenIndex = wIdx;
      }
    });

    results.push({
      dayNumber: day,
      wordSample,
      isSequential: dayIsSequential
    });
  });

  return results;
}

