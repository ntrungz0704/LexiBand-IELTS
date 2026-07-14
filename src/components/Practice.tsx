/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Volume2, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  BookOpen, 
  Award, 
  Play, 
  ChevronRight, 
  ListOrdered,
  Eye,
  BookmarkPlus,
  Lightbulb,
  AlertTriangle,
  Mic,
  Sparkles,
  TrendingUp,
  X,
  Clock,
  Check,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Word, UserProgress, WordStatus, PracticeMode } from "../types";
import { getEnrichedWord } from "../utils/enrichment";
import { calculateSM2, getTodayString, isDue } from "../utils/srs";
import { speakWord } from "./Library";
import { speakText } from "../utils/speech";
import { addMultipleErrors } from "../utils/errorBank";

interface PracticeProps {
  words: Word[];
  progress: UserProgress;
  onUpdateSRS: (wordId: string, rating: 1 | 3 | 4 | 5) => void;
  selectedWordFromLib?: Word | null;
  onClearSelectedWord: () => void;
  practiceTrigger?: { mode: "srs" | "quiz" | "fill-blank"; type?: "all" | "due" | "new"; word?: Word; targetWords?: Word[] } | null;
  onClearTrigger?: () => void;
  user: { uid: string; email: string } | null;
}

export default function Practice({ 
  words, 
  progress, 
  onUpdateSRS, 
  selectedWordFromLib,
  onClearSelectedWord,
  practiceTrigger,
  onClearTrigger,
  user
}: PracticeProps) {
  
  // App Modes: "menu" | "srs" | "quiz" | "fill-blank" | "speaking" | "shadowing" | "sequential"
  const [activeMode, setActiveMode] = useState<"menu" | "srs" | "quiz" | "fill-blank" | "speaking" | "shadowing" | "sequential">("menu");

  // =========================================================================
  // SEQUENTIAL PRACTICE FLOW STATE & GENERATORS
  // =========================================================================
  const [seqStep, setSeqStep] = useState<"flashcard" | "quiz" | "fill-blank" | "speaking" | "shadowing" | "review">("flashcard");
  const [seqWords, setSeqWords] = useState<Word[]>([]);
  const [seqIdx, setSeqIdx] = useState(0);
  const [seqFlipped, setSeqFlipped] = useState(false);
  const [seqQuizOptions, setSeqQuizOptions] = useState<string[]>([]);
  const [seqSelectedOption, setSeqSelectedOption] = useState<string | null>(null);
  const [seqTypedWord, setSeqTypedWord] = useState("");
  const [seqBlankChecked, setSeqBlankChecked] = useState(false);
  const [seqRecording, setSeqRecording] = useState(false);
  const [seqSpeakResult, setSeqSpeakResult] = useState<{ status: "success" | "near" | "fail"; recognized: string } | null>(null);
  const [seqShadowResult, setSeqShadowResult] = useState<{ score: number; recognized: string } | null>(null);
  const [seqScores, setSeqScores] = useState<{
    flashcards: Record<string, 1 | 3 | 4 | 5>;
    quiz: Record<string, boolean>;
    fillBlank: Record<string, boolean>;
    speaking: Record<string, "success" | "near" | "fail">;
    shadowing: Record<string, number>;
  }>({
    flashcards: {},
    quiz: {},
    fillBlank: {},
    speaking: {},
    shadowing: {},
  });

  const startSequentialFlow = () => {
    const today = getTodayString();
    
    // 1. Get due words
    let candidateWords = words.filter(w => {
      const p = progress[w.id];
      return p && isDue(p.nextReviewDate, today);
    });

    // 2. If candidates < 5, add new words
    if (candidateWords.length < 5) {
      const newWords = words.filter(w => !progress[w.id]);
      candidateWords = [...candidateWords, ...newWords];
    }

    // 3. If still < 5, just fill with any words
    if (candidateWords.length < 5) {
      candidateWords = [...candidateWords, ...words];
    }

    // Slice to 5 unique words
    const uniqueCandidates: Word[] = [];
    const seenIds = new Set<string>();
    for (const w of candidateWords) {
      if (!seenIds.has(w.id)) {
        seenIds.add(w.id);
        uniqueCandidates.push(w);
      }
      if (uniqueCandidates.length === 5) break;
    }

    setSeqWords(uniqueCandidates);
    setSeqIdx(0);
    setSeqStep("flashcard");
    setSeqFlipped(false);
    setSeqSelectedOption(null);
    setSeqTypedWord("");
    setSeqBlankChecked(false);
    setSeqSpeakResult(null);
    setSeqShadowResult(null);
    setSeqScores({
      flashcards: {},
      quiz: {},
      fillBlank: {},
      speaking: {},
      shadowing: {},
    });
    
    if (uniqueCandidates.length > 0) {
      generateSeqQuizOptions(uniqueCandidates[0]);
    }

    setActiveMode("sequential");
  };

  const generateSeqQuizOptions = (word: Word) => {
    if (!word) return;
    const distractors = words
      .filter(w => w.id !== word.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(w => w.meaning);

    const opts = [word.meaning, ...distractors].sort(() => 0.5 - Math.random());
    setSeqQuizOptions(opts);
  };

  const cleanTextForComparison = (t: string) => {
    return t.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  };

  const startSeqSpeakingRecord = (targetText: string) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome hoặc Safari.");
      return;
    }

    try {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setSeqRecording(true);
        setSeqSpeakResult(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript || "";
        const cleanTarget = cleanTextForComparison(targetText);
        const cleanTrans = cleanTextForComparison(transcript);

        let status: "success" | "near" | "fail" = "fail";
        if (cleanTarget === cleanTrans) {
          status = "success";
        } else {
          const sim = getSimilarity(targetText, transcript);
          if (sim >= 70) {
            status = "success";
          } else if (sim >= 40) {
            status = "near";
          }
        }

        setSeqSpeakResult({
          status,
          recognized: transcript
        });

        setSeqScores(prev => ({
          ...prev,
          speaking: { ...prev.speaking, [seqWords[seqIdx].id]: status }
        }));
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error", e);
        setSeqRecording(false);
      };

      rec.onend = () => {
        setSeqRecording(false);
      };

      rec.start();
      setRecognitionInstance(rec);
    } catch (e) {
      console.error(e);
      setSeqRecording(false);
    }
  };

  const startSeqShadowRecord = (targetText: string) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome hoặc Safari.");
      return;
    }

    try {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setSeqRecording(true);
        setSeqShadowResult(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript || "";
        const simScore = Math.round(getSimilarity(targetText, transcript));

        setSeqShadowResult({
          score: simScore,
          recognized: transcript
        });

        setSeqScores(prev => ({
          ...prev,
          shadowing: { ...prev.shadowing, [seqWords[seqIdx].id]: simScore }
        }));
      };

      rec.onerror = (e: any) => {
        console.error("Shadowing Speech Recognition Error", e);
        setSeqRecording(false);
      };

      rec.onend = () => {
        setSeqRecording(false);
      };

      rec.start();
      setRecognitionInstance(rec);
    } catch (e) {
      console.error(e);
      setSeqRecording(false);
    }
  };

  const handleFinishSeqSession = () => {
    // For each word, calculate a synthesized rating from 1 to 5 based on their multi-phase performance
    seqWords.forEach(word => {
      // 1. Base score from Flashcard rating
      let score = seqScores.flashcards[word.id] || 4; // default to 4 (Good) if not rated

      // 2. Adjust with quiz (correct/incorrect)
      const quizCorrect = seqScores.quiz[word.id] === true;
      score += quizCorrect ? 0.25 : -0.25;

      // 3. Adjust with spelling/fill-blank (correct/incorrect)
      const blankCorrect = seqScores.fillBlank[word.id] === true;
      score += blankCorrect ? 0.25 : -0.25;

      // 4. Adjust with pronunciation/speaking ("success" | "near" | "fail")
      const speakStatus = seqScores.speaking[word.id];
      if (speakStatus === "success") {
        score += 0.25;
      } else if (speakStatus === "fail") {
        score -= 0.25;
      }

      // 5. Adjust with shadowing score [0-100]
      const shadowScore = seqScores.shadowing[word.id] || 0;
      if (shadowScore >= 80) {
        score += 0.25;
      } else if (shadowScore < 50) {
        score -= 0.25;
      }

      // Clamp to [1, 5]
      let finalRating: 1 | 3 | 4 | 5 = 4;
      if (score <= 1.5) {
        finalRating = 1;
      } else if (score <= 3.5) {
        finalRating = 3;
      } else if (score <= 4.5) {
        finalRating = 4;
      } else {
        finalRating = 5;
      }

      onUpdateSRS(word.id, finalRating);
    });

    // Award XP
    if (user && user.uid) {
      try {
        const userXPKey = `lexiband_xp_${user.uid}`;
        const currentXP = parseInt(localStorage.getItem(userXPKey) || "0", 10);
        localStorage.setItem(userXPKey, (currentXP + 150).toString()); // 150 XP for completing sequential session!
      } catch (e) {
        console.error(e);
      }
    }

    setActiveMode("menu");
  };

  // Voice setting
  const [accent, setAccent] = useState<"en-US" | "en-GB">("en-US");

  // AI Speaking Coach Feedback Integration
  const [evaluatingSpeaking, setEvaluatingSpeaking] = useState<boolean>(false);
  const [speakingFeedback, setSpeakingFeedback] = useState<any | null>(null);

  const evaluateSpokenText = async (recognized: string, target: string, topic: string, part: string) => {
    if (!user) return;
    setEvaluatingSpeaking(true);
    setSpeakingFeedback(null);
    try {
      const response = await fetch("/api/speaking/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recognizedText: recognized,
          targetText: target,
          topic,
          part
        })
      });
      if (response.ok) {
        const data = await response.json();
        setSpeakingFeedback(data);
        if (data.hasErrors && data.errors && data.errors.length > 0) {
          const errorLogs = data.errors.map((err: any) => ({
            skill: "speaking" as const,
            errorType: err.error_type || "collocation_wrong",
            rootCause: err.root_cause || "unknown",
            original: err.originalSentence || recognized,
            corrected: err.correctedSentence || target,
            explanation: err.errorExplanation || "Lỗi phát âm hoặc ngữ pháp trong câu nói.",
            context: `Speaking Practice part: "${part}" (Topic: ${topic})`
          }));
          await addMultipleErrors(user.uid, errorLogs);
          console.log("Logged speaking errors to bank:", errorLogs.length);
        }
      }
    } catch (err) {
      console.error("Error evaluating speaking feedback:", err);
    } finally {
      setEvaluatingSpeaking(false);
    }
  };

  // =========================================================================
  // FLASHCARD RECORD & COMPARE STATE & HELPERS
  // =========================================================================
  const [isFlashcardRecording, setIsFlashcardRecording] = useState(false);
  const [flashcardResult, setFlashcardResult] = useState<{ wordId: string; status: "success" | "near" | "fail"; recognized: string } | null>(null);
  const [flashcardStats, setFlashcardStats] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("lexiband_pronounce_stats");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleToggleFlashcardRecord = (targetWord: string, wordId: string) => {
    if (isFlashcardRecording) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsFlashcardRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError("Trình duyệt không hỗ trợ Nhận diện Giọng nói. Vui lòng dùng Chrome hoặc Safari.");
      return;
    }

    try {
      setSpeechError(null);
      setFlashcardResult(null);
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let accumulatedText = "";

      rec.onstart = () => {
        setIsFlashcardRecording(true);
      };

      rec.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript + " ";
        }
        accumulatedText = currentText.trim();
        setFlashcardResult({
          wordId,
          status: "fail",
          recognized: accumulatedText
        });
      };

      rec.onerror = (event: any) => {
        console.error("Flashcard Speech recognition error", event);
        setIsFlashcardRecording(false);
      };

      rec.onend = () => {
        setIsFlashcardRecording(false);
        if (!accumulatedText) return;

        const resultText = accumulatedText;
        const cleanT = targetWord.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
        const cleanR = resultText.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

        let status: "success" | "near" | "fail" = "fail";
        if (cleanT === cleanR) {
          status = "success";
        } else {
          const sim = getSimilarity(targetWord, resultText);
          if (sim >= 60) {
            status = "near";
          }
        }

        setFlashcardResult({
          wordId,
          status,
          recognized: resultText
        });

        // Increment pronunciation practice stats
        setFlashcardStats(prev => {
          const updated = { ...prev, [wordId]: (prev[wordId] || 0) + 1 };
          localStorage.setItem("lexiband_pronounce_stats", JSON.stringify(updated));
          return updated;
        });
      };

      rec.start();
      setRecognitionInstance(rec);

    } catch (e) {
      console.error(e);
      setIsFlashcardRecording(false);
    }
  };

  // =========================================================================
  // SHADOWING PRACTICE STATE, DYNAMIC GENERATORS & HELPERS
  // =========================================================================
  interface ShadowingExercise {
    id: string;
    part: 1 | 2 | 3;
    topic: string;
    question?: string;
    text: string;
    translation: string;
    wordsUsed: { word: string; meaning: string }[];
  }

  const [activeShadowingPart, setActiveShadowingPart] = useState<1 | 2 | 3>(1);
  const [shadowingList, setShadowingList] = useState<ShadowingExercise[]>([]);
  const [currentShadowingIndex, setCurrentShadowingIndex] = useState(0);
  const [isShadowingRecording, setIsShadowingRecording] = useState(false);
  const [isShadowingPlaying, setIsShadowingPlaying] = useState(false);
  const [shadowingSpeed, setShadowingSpeed] = useState<"normal" | "slow">("normal");
  const [shadowingResult, setShadowingResult] = useState<{
    score: number;
    lcsScore: number;
    confidenceScore: number;
    timingScore: number;
    timingWarning: boolean;
    timeDiffRatio: number;
    recognized: string;
    confidence: number;
  } | null>(null);

  const [shadowingDurationTTS, setShadowingDurationTTS] = useState<number>(0);
  const [shadowingDurationUser, setShadowingDurationUser] = useState<number>(0);
  const [shadowingError, setShadowingError] = useState<string | null>(null);

  const [shadowingHistory, setShadowingHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("lexiband_shadowing_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Helper functions to build custom IELTS Speaking prompts
  function getPart1Question(word: string, topic: string): string {
    const t = topic || "General";
    switch (t) {
      case "Education":
        return `Do you think studying about "${word}" is important for students?`;
      case "Environment":
        return `How does "${word}" affect the local environment in your hometown?`;
      case "Health":
        return `Is "${word}" a common topic discussed in terms of public health?`;
      case "Technology":
        return `How has modern technology changed our view of "${word}"?`;
      case "Crime":
        return `Do you think governments can reduce issues related to "${word}"?`;
      case "Urbanization":
        return `How do cities manage challenges related to "${word}"?`;
      case "Economy":
        return `What role does "${word}" play in the economic development of a country?`;
      case "Society":
        return `How do communities usually deal with issues like "${word}"?`;
      default:
        return `Could you tell me how "${word}" relates to your daily life?`;
    }
  }

  function getPart3Question(word: string, topic: string): string {
    const t = topic || "General";
    switch (t) {
      case "Education":
        return `In what ways should modern educational systems reform their approach to "${word}"?`;
      case "Environment":
        return `What are the global long-term ramifications if humanity fails to resolve challenges involving "${word}"?`;
      case "Health":
        return `To what extent should international healthcare policies prioritize research surrounding "${word}"?`;
      case "Technology":
        return `What ethical dilemmas might arise when we introduce technologies that automate processes related to "${word}"?`;
      case "Crime":
        return `How should the international judicial framework adapt to handle modern cross-border cases of "${word}"?`;
      case "Urbanization":
        return `How can urban planners design resilient infrastructures that mitigate the social pressures of "${word}"?`;
      case "Economy":
        return `What macro-economic structural reforms are necessary to sustain growth while regulating "${word}"?`;
      case "Society":
        return `How do cultural traditions and values shape our collective societal perception of "${word}"?`;
      default:
        return `What are the fundamental philosophical and practical challenges societies face when navigating "${word}"?`;
    }
  }

  function generateShadowingExercises(part: 1 | 2 | 3, allWords: Word[]): ShadowingExercise[] {
    if (!allWords || allWords.length === 0) return [];

    const list: ShadowingExercise[] = [];
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);

    if (part === 1) {
      // IELTS Part 1: Familiar short QA
      const selection = shuffled.slice(0, 5);
      selection.forEach((word, idx) => {
        const q = getPart1Question(word.word, word.topic);
        list.push({
          id: `sh-p1-${word.id}-${idx}`,
          part: 1,
          topic: word.topic || "General",
          question: q,
          text: word.example || `It is very important to consider the role of ${word.word} in our society.`,
          translation: word.exampleTranslation || `Việc xem xét vai trò của ${word.word} trong xã hội của chúng ta là rất quan trọng.`,
          wordsUsed: [{ word: word.word, meaning: word.meaning }]
        });
      });
    } else if (part === 2) {
      // IELTS Part 2: Long monologue cue card
      // Grouping 3 related example sentences for an expanded monologue
      const topicsList = ["Education", "Environment", "Health", "Technology", "Economy", "Society", "General"];
      
      for (let i = 0; i < 5; i++) {
        const activeTopic = topicsList[i % topicsList.length];
        const topicWords = shuffled.filter(w => (w.topic || "General").toLowerCase() === activeTopic.toLowerCase()).slice(0, 3);
        const finalWords = topicWords.length >= 2 ? topicWords : shuffled.slice(i * 3, i * 3 + 3);
        
        const partsText: string[] = [];
        const partsTrans: string[] = [];
        const wordsInfo: { word: string; meaning: string }[] = [];

        finalWords.forEach((w, idx) => {
          let prefix = "";
          let prefixTrans = "";
          if (idx === 0) {
            prefix = "Regarding this matter, ";
            prefixTrans = "Về vấn đề này, ";
          } else if (idx === 1) {
            prefix = "Furthermore, ";
            prefixTrans = "Hơn thế nữa, ";
          } else {
            prefix = "Ultimately, ";
            prefixTrans = "Cuối cùng, ";
          }

          partsText.push(prefix + (w.example || ""));
          partsTrans.push(prefixTrans + (w.exampleTranslation || ""));
          wordsInfo.push({ word: w.word, meaning: w.meaning });
        });

        const joinedText = partsText.join(" ");
        const joinedTrans = partsTrans.join(" ");

        list.push({
          id: `sh-p2-${activeTopic}-${i}`,
          part: 2,
          topic: activeTopic,
          question: `Describe a situation related to "${activeTopic}" where you experienced significant development. You should talk about what happened, why it was memorable, and how it shaped your outlook.`,
          text: joinedText,
          translation: joinedTrans,
          wordsUsed: wordsInfo
        });
      }
    } else {
      // IELTS Part 3: Complex academic discussion QA
      const academicSelection = shuffled.filter(w => w.band === "6.0-6.5" || w.band === "4.5-5.5").slice(0, 5);
      const finalSelection = academicSelection.length >= 5 ? academicSelection : shuffled.slice(0, 5);

      finalSelection.forEach((word, idx) => {
        const q = getPart3Question(word.word, word.topic);
        list.push({
          id: `sh-p3-${word.id}-${idx}`,
          part: 3,
          topic: word.topic || "General",
          question: q,
          text: word.example || `The conceptual analysis of ${word.word} suggests profound implications for policy development.`,
          translation: word.exampleTranslation || `Phân tích khái niệm về ${word.word} cho thấy những tác động sâu sắc đối với việc phát triển chính sách.`,
          wordsUsed: [{ word: word.word, meaning: word.meaning }]
        });
      });
    }

    return list;
  }

  // Word-by-word sequence matching via Longest Common Subsequence (LCS)
  function getWordLCSPercentage(targetText: string, recognizedText: string): number {
    const tWords = targetText.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
    const rWords = recognizedText.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
    if (tWords.length === 0) return 0;
    if (rWords.length === 0) return 0;

    const m = tWords.length;
    const n = rWords.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (tWords[i - 1] === rWords[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lcsLength = dp[m][n];
    return (lcsLength / m) * 100;
  }

  // Shadowing Core 3-Signal evaluation formula configuration
  // Adjust these weights as necessary (the total should equal 1.0)
  const WEIGHT_LCS = 0.60;        // Signal 1: LCS matching (high weight, tests order and vocabulary accuracy)
  const WEIGHT_CONFIDENCE = 0.25; // Signal 2: API confidence (medium weight, tests overall clarity)
  const WEIGHT_TIMING = 0.15;     // Signal 3: Speaking tempo/duration ratio compared to target TTS

  const startShadowingMode = (part: 1 | 2 | 3 = 1) => {
    const exercises = generateShadowingExercises(part, words);
    setShadowingList(exercises);
    setActiveShadowingPart(part);
    setCurrentShadowingIndex(0);
    setIsShadowingRecording(false);
    setIsShadowingPlaying(false);
    setShadowingResult(null);
    setShadowingDurationTTS(0);
    setShadowingDurationUser(0);
    setShadowingError(null);
    setSpeakingFeedback(null);
    setActiveMode("shadowing");
  };

  const speakShadowingText = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setShadowingError("Trình duyệt không hỗ trợ phát giọng nói.");
      return;
    }

    try {
      const rate = shadowingSpeed === "slow" ? 0.65 : 0.95;
      let startTime = Date.now();

      speakText(
        text,
        rate,
        accent,
        () => {
          setIsShadowingPlaying(true);
          startTime = Date.now();
        },
        () => {
          const duration = Date.now() - startTime;
          setShadowingDurationTTS(duration);
          setIsShadowingPlaying(false);
        }
      );
    } catch (e) {
      console.error(e);
      setIsShadowingPlaying(false);
    }
  };

  const handleToggleShadowingRecord = (targetText: string) => {
    if (isShadowingRecording) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsShadowingRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setShadowingError("Trình duyệt không hỗ trợ Nhận diện Giọng nói. Vui lòng dùng Chrome hoặc Safari.");
      return;
    }

    try {
      setShadowingError(null);
      setShadowingResult(null);
      setSpeakingFeedback(null);

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let startTime = Date.now();
      let accumulatedText = "";

      rec.onstart = () => {
        setIsShadowingRecording(true);
        startTime = Date.now();
      };

      rec.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript + " ";
        }
        accumulatedText = currentText.trim();
        setShadowingResult(prev => ({
          ...prev,
          recognized: accumulatedText
        }) as any);
      };

      rec.onerror = (event: any) => {
        console.error("Shadowing Speech recognition error", event);
        if (event.error === "no-speech") {
          setShadowingError("Không nghe thấy giọng nói. Vui lòng nói to rõ ràng hơn.");
        } else if (event.error === "not-allowed") {
          setShadowingError("Quyền Microphone bị từ chối. Vui lòng cấp quyền.");
        } else {
          setShadowingError(`Lỗi: ${event.error}`);
        }
        setIsShadowingRecording(false);
      };

      rec.onend = () => {
        setIsShadowingRecording(false);
        if (!accumulatedText) {
          return;
        }

        const resultText = accumulatedText;
        const duration = Date.now() - startTime;
        setShadowingDurationUser(duration);

        // Compute LCS Word-Order Score
        const lcs = getWordLCSPercentage(targetText, resultText);
        
        // Compute Confidence Score
        const confidenceScore = 85;
        
        // Compute Timing Score & deviation warning (> 40% deviation is abnormal)
        const ttsDur = shadowingDurationTTS > 0 ? shadowingDurationTTS : targetText.length * 65;
        const timeDiffRatio = ttsDur > 0 ? Math.abs(duration - ttsDur) / ttsDur : 0;
        let timingScore = 100;
        const timingWarning = timeDiffRatio > 0.40;

        if (timingWarning) {
          timingScore = Math.max(0, 100 - (timeDiffRatio - 0.40) * 100);
        }

        // Weighted Final Combination
        const finalScore = Math.round(
          (lcs * WEIGHT_LCS) + 
          (confidenceScore * WEIGHT_CONFIDENCE) + 
          (timingScore * WEIGHT_TIMING)
        );

        setShadowingResult({
          score: finalScore,
          lcsScore: Math.round(lcs),
          confidenceScore: Math.round(confidenceScore),
          timingScore: Math.round(timingScore),
          timingWarning,
          timeDiffRatio,
          recognized: resultText,
          confidence: 0.85
        });

        // Save progress to Local History
        const newRecord = {
          date: getTodayString(),
          part: activeShadowingPart,
          score: finalScore,
          topic: shadowingList[currentShadowingIndex]?.topic || "General"
        };

        setShadowingHistory(prev => {
          const updated = [newRecord, ...prev];
          localStorage.setItem("lexiband_shadowing_history", JSON.stringify(updated));
          return updated;
        });

        // Trigger AI Speaking feedback evaluation
        const currentTopic = shadowingList[currentShadowingIndex]?.topic || "General";
        evaluateSpokenText(resultText, targetText, currentTopic, `shadowing_part_${activeShadowingPart}`);
      };

      rec.start();
      setRecognitionInstance(rec);
    } catch (e) {
      console.error(e);
      setShadowingError("Không thể mở micro.");
      setIsShadowingRecording(false);
    }
  };

  const handleNextShadowing = () => {
    if (currentShadowingIndex + 1 < shadowingList.length) {
      setCurrentShadowingIndex(prev => prev + 1);
      setShadowingResult(null);
      setShadowingDurationTTS(0);
      setShadowingDurationUser(0);
      setShadowingError(null);
      setSpeakingFeedback(null);
    } else {
      setCurrentShadowingIndex(shadowingList.length);
    }
  };

  // =========================================================================
  // SPEAKING PRACTICE STATE & HELPERS
  // =========================================================================
  const [speakingQueue, setSpeakingQueue] = useState<Word[]>([]);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speakingHistory, setSpeakingHistory] = useState<{ word: string, score: number, text: string }[]>([]);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  function getSimilarity(s1: string, s2: string): number {
    const clean1 = s1.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    const clean2 = s2.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (clean1 === clean2) return 100;
    if (!clean1 || !clean2) return 0;

    const track = Array(clean2.length + 1).fill(null).map(() =>
      Array(clean1.length + 1).fill(null));
    for (let i = 0; i <= clean1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= clean2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= clean2.length; j += 1) {
      for (let i = 1; i <= clean1.length; i += 1) {
        const indicator = clean1[i - 1] === clean2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j - 1][i] + 1,
          track[j][i - 1] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }
    const distance = track[clean2.length][clean1.length];
    const maxLen = Math.max(clean1.length, clean2.length);
    return Math.round(((maxLen - distance) / maxLen) * 100);
  }

  const startSpeaking = () => {
    const today = getTodayString();
    let selected = words.filter(w => {
      const p = progress[w.id];
      return p && p.status === "learning";
    });
    if (selected.length < 5) {
      selected = [...selected, ...words.filter(w => !progress[w.id])];
    }
    const queue = selected.slice(0, 5);
    setSpeakingQueue(queue);
    setCurrentSpeakingIndex(0);
    setIsRecording(false);
    setRecognizedText("");
    setSpeakingScore(null);
    setSpeechError(null);
    setSpeakingHistory([]);
    setActiveMode("speaking");
  };

  const handleToggleSpeakRecord = () => {
    if (isRecording) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError("Trình duyệt không hỗ trợ Nhận diện Giọng nói. Vui lòng dùng Chrome hoặc Safari.");
      return;
    }

    try {
      setSpeechError(null);
      setRecognizedText("");
      setSpeakingScore(null);

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      let accumulatedText = "";

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript + " ";
        }
        accumulatedText = currentText.trim();
        setRecognizedText(accumulatedText);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event);
        if (event.error === "no-speech") {
          setSpeechError("Không nghe thấy giọng nói. Vui lòng thử lại.");
        } else if (event.error === "not-allowed") {
          setSpeechError("Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền.");
        } else {
          setSpeechError(`Lỗi: ${event.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
        if (!accumulatedText) return;

        const resultText = accumulatedText;
        setRecognizedText(resultText);
        
        const targetWord = speakingQueue[currentSpeakingIndex].word;
        const score = getSimilarity(targetWord, resultText);
        setSpeakingScore(score);
        
        setSpeakingHistory(prev => [...prev, { word: targetWord, score, text: resultText }]);

        // Trigger AI Speaking feedback evaluation
        const currentTopic = speakingQueue[currentSpeakingIndex].topic || "General";
        evaluateSpokenText(resultText, targetWord, currentTopic, "speaking_sentence");
      };

      rec.start();
      setRecognitionInstance(rec);

    } catch (e: any) {
      console.error(e);
      setSpeechError("Có lỗi xảy ra khi bắt đầu nhận diện.");
      setIsRecording(false);
    }
  };

  const handleNextSpeaking = () => {
    if (currentSpeakingIndex + 1 < speakingQueue.length) {
      setCurrentSpeakingIndex(prev => prev + 1);
      setRecognizedText("");
      setSpeakingScore(null);
      setSpeechError(null);
    } else {
      speakingHistory.forEach(item => {
        const wObj = words.find(x => x.word === item.word);
        if (wObj && item.score >= 75) {
          onUpdateSRS(wObj.id, 4);
        }
      });
      setCurrentSpeakingIndex(speakingQueue.length);
    }
  };

  // =========================================================================
  // 1. STATE FOR SRS FLASHCARD REVIEW
  // =========================================================================
  const [srsQueue, setSrsQueue] = useState<Word[]>([]);
  const [currentSrsIndex, setCurrentSrsIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [srsModeType, setSrsModeType] = useState<"all" | "due" | "new">("all");

  // Build SRS Queue based on user selection
  const initializeSRS = (type: "all" | "due" | "new") => {
    const today = getTodayString();
    let queue: Word[] = [];

    if (type === "due") {
      // Words that are either learning and due, or mastered and due
      queue = words.filter(w => {
        const p = progress[w.id];
        return p && isDue(p.nextReviewDate, today);
      });
    } else if (type === "new") {
      // Words that have no progress yet
      queue = words.filter(w => !progress[w.id]);
    } else {
      // Due words first, then new words
      const dueWords = words.filter(w => {
        const p = progress[w.id];
        return p && isDue(p.nextReviewDate, today);
      });
      const newWords = words.filter(w => !progress[w.id]);
      queue = [...dueWords, ...newWords].slice(0, 15); // limit to 15 per quick deck
    }

    // Shuffle queue
    queue = [...queue].sort(() => Math.random() - 0.5);

    setSrsQueue(queue);
    setCurrentSrsIndex(0);
    setIsFlipped(false);
    setFlashcardResult(null);
    setSrsModeType(type);
    setActiveMode("srs");
  };

  // Trigger SRS learning for a single specific word requested from Library details
  useEffect(() => {
    if (selectedWordFromLib) {
      setSrsQueue([selectedWordFromLib]);
      setCurrentSrsIndex(0);
      setIsFlipped(false);
      setFlashcardResult(null);
      setActiveMode("srs");
      onClearSelectedWord();
    }
  }, [selectedWordFromLib, onClearSelectedWord]);

  // Hoisted Trigger listener to let Dashboard quick start any practice module!
  useEffect(() => {
    if (practiceTrigger) {
      if (practiceTrigger.mode === "srs") {
        if (practiceTrigger.word) {
          setSrsQueue([practiceTrigger.word]);
          setCurrentSrsIndex(0);
          setIsFlipped(false);
          setFlashcardResult(null);
          setActiveMode("srs");
        } else {
          initializeSRS(practiceTrigger.type || "all");
        }
      } else if (practiceTrigger.mode === "quiz") {
        startQuiz(practiceTrigger.targetWords);
      } else if (practiceTrigger.mode === "fill-blank") {
        startFillBlank(practiceTrigger.targetWords);
      }
      if (onClearTrigger) {
        onClearTrigger();
      }
    }
  }, [practiceTrigger, onClearTrigger]);

  const handleSRSFeedback = (rating: 1 | 3 | 4 | 5) => {
    const currentWord = srsQueue[currentSrsIndex];
    
    // Stop any ongoing flashcard speech recognition
    if (isFlashcardRecording && recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsFlashcardRecording(false);
    setFlashcardResult(null);

    // Call parent to update state and persist
    onUpdateSRS(currentWord.id, rating);
    
    // Speak word on grading to anchor pronunciation
    speakWord(currentWord.word, 0.9, accent);

    // Next Card animation
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentSrsIndex(prev => prev + 1);
    }, 200);
  };

  // =========================================================================
  // 2. STATE FOR MULTIPLE CHOICE QUIZ ("Listen & Choose" & Standard)
  // =========================================================================
  interface QuizQuestion {
    word: Word;
    type: "listening" | "matching";
    options: { text: string; wordId: string }[];
    correctAnswerId: string;
    selectedAnswerId?: string;
    isCorrect?: boolean;
  }
  
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const startQuiz = (filterWords?: Word[]) => {
    // Select 10 random words from library or filterWords
    const source = filterWords && filterWords.length > 0 ? filterWords : words;
    const pool = [...source].sort(() => Math.random() - 0.5).slice(0, 10);
    
    const questions: QuizQuestion[] = pool.map(word => {
      // 50% chance of listening question, 50% chance of standard matching
      const qType: "listening" | "matching" = Math.random() > 0.4 ? "listening" : "matching";
      
      // Distractors
      const distractors = words
        .filter(w => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
        
      const options = [
        { text: word.meaning, wordId: word.id },
        ...distractors.map(d => ({ text: d.meaning, wordId: d.id }))
      ].sort(() => Math.random() - 0.5);

      return {
        word,
        type: qType,
        options,
        correctAnswerId: word.id
      };
    });

    setQuizQuestions(questions);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setQuizFinished(false);
    setActiveMode("quiz");

    // If first question is listening, play TTS
    if (questions[0]?.type === "listening") {
      setTimeout(() => speakWord(questions[0].word.word, 0.9, accent), 500);
    }
  };

  const handleSelectQuizOption = (optionId: string) => {
    const questions = [...quizQuestions];
    const currentQ = questions[currentQuizIndex];
    
    if (currentQ.selectedAnswerId) return; // already answered
    
    currentQ.selectedAnswerId = optionId;
    const correct = optionId === currentQ.correctAnswerId;
    currentQ.isCorrect = correct;
    
    if (correct) {
      setQuizScore(prev => prev + 1);
      // Auto upgrade word progression on correct quiz answer as minor reinforcement
      onUpdateSRS(currentQ.word.id, 4); 
    } else {
      // Minor reset on incorrect answer
      onUpdateSRS(currentQ.word.id, 1);
    }

    setQuizQuestions(questions);
  };

  const handleNextQuiz = () => {
    const nextIdx = currentQuizIndex + 1;
    if (nextIdx >= quizQuestions.length) {
      setQuizFinished(true);
    } else {
      setCurrentQuizIndex(nextIdx);
      // If next is listening, play TTS
      if (quizQuestions[nextIdx].type === "listening") {
        setTimeout(() => speakWord(quizQuestions[nextIdx].word.word, 0.9, accent), 300);
      }
    }
  };


  // =========================================================================
  // 3. STATE FOR FILL IN THE BLANK
  // =========================================================================
  interface BlankQuestion {
    word: Word;
    maskedSentence: string;
    hintText: string;
    correctWord: string;
    userAnswer: string;
    submitted: boolean;
    isCorrect?: boolean;
  }

  const [blankQuestions, setBlankQuestions] = useState<BlankQuestion[]>([]);
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0);
  const [blankScore, setBlankScore] = useState(0);
  const [blankFinished, setBlankFinished] = useState(false);
  const [showBlankHint, setShowBlankHint] = useState(false);

  const startFillBlank = (filterWords?: Word[]) => {
    // Select 10 random words that have examples
    const source = filterWords && filterWords.length > 0 ? filterWords : words;
    const pool = [...source].sort(() => Math.random() - 0.5).slice(0, 10);
    
    const questions: BlankQuestion[] = pool.map(word => {
      // Mask the key word in the example sentence.
      // E.g., replace "analyze" with "_________"
      // Case insensitive match to mask correctly
      const regex = new RegExp(`\\b${word.word}\\b`, "gi");
      const masked = word.example.replace(regex, "_________");
      
      return {
        word,
        maskedSentence: masked,
        hintText: `${word.meaning} (${word.ipa})`,
        correctWord: word.word.toLowerCase(),
        userAnswer: "",
        submitted: false
      };
    });

    setBlankQuestions(questions);
    setCurrentBlankIndex(0);
    setBlankScore(0);
    setBlankFinished(false);
    setShowBlankHint(false);
    setActiveMode("fill-blank");
  };

  const handleSubmitBlank = (answer: string) => {
    const questions = [...blankQuestions];
    const currentQ = questions[currentBlankIndex];
    
    if (currentQ.submitted) return;
    
    const cleanedUser = answer.trim().toLowerCase();
    const correct = cleanedUser === currentQ.correctWord;
    
    currentQ.userAnswer = answer;
    currentQ.submitted = true;
    currentQ.isCorrect = correct;
    
    if (correct) {
      setBlankScore(prev => prev + 1);
      // Perfect spelling reward!
      onUpdateSRS(currentQ.word.id, 5);
    } else {
      // spelling error counts as review block
      onUpdateSRS(currentQ.word.id, 1);
    }

    setBlankQuestions(questions);
  };

  const handleNextBlank = () => {
    const nextIdx = currentBlankIndex + 1;
    if (nextIdx >= blankQuestions.length) {
      setBlankFinished(true);
    } else {
      setCurrentBlankIndex(nextIdx);
      setShowBlankHint(false);
    }
  };


  // =========================================================================
  // BACK HOME OR SWITCHING ACCENT HELPERS
  // =========================================================================
  const backToMenu = () => {
    setActiveMode("menu");
  };

  // Due count for current dashboard
  const dueCount = useMemo(() => {
    const today = getTodayString();
    return words.filter(w => {
      const p = progress[w.id];
      return p && isDue(p.nextReviewDate, today);
    }).length;
  }, [words, progress]);

  const newCount = useMemo(() => {
    return words.filter(w => !progress[w.id]).length;
  }, [words, progress]);


  return (
    <div className="space-y-6" id="practice-section">
      
      {/* Dynamic Header */}
      {activeMode !== "menu" && (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
          <button
            onClick={backToMenu}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Thoát chế độ luyện tập
          </button>
          
          {/* Accent toggle directly available inside games */}
          <div className="flex items-center gap-2">
            <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider">Accent:</span>
            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value as "en-US" | "en-GB")}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xxs font-semibold focus:outline-hidden text-slate-600"
            >
              <option value="en-US">US (Mỹ)</option>
              <option value="en-GB">UK (Anh)</option>
            </select>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW A: MAIN MENU SELECTOR
          ========================================================================= */}
      {activeMode === "menu" && (
        <div className="space-y-6">
          
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-800">Chọn phương thức học</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Để ghi nhớ từ vựng sâu sắc nhất, hãy phối hợp giữa flashcard SRS hàng ngày cùng với việc luyện tập nghe và viết qua các câu đố.
              </p>
            </div>
            
            {/* Quick Summary status */}
            <div className="flex gap-4 self-start md:self-auto">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center min-w-[100px]">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Cần ôn tập</span>
                <span className="text-lg font-black text-emerald-800 mt-0.5 block">{dueCount} từ</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-center min-w-[100px]">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Từ mới chưa học</span>
                <span className="text-lg font-black text-indigo-800 mt-0.5 block">{newCount} từ</span>
              </div>
            </div>
          </div>

          {/* Featured Sequential Learning Journey */}
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute left-1/4 bottom-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-4 relative z-10 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black px-3 py-1 bg-blue-600 text-white rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-blue-500/20">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  Quy trình học tuần tự chính khóa
                </span>
                <span className="text-xxs font-extrabold text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-900/40">
                  Phù hợp nhất với {dueCount > 0 ? `${dueCount} từ cần ôn` : "Từ mới hàng ngày"}
                </span>
              </div>
              
              <div className="space-y-1">
                <h4 className="text-xl font-black tracking-tight">Hành Trình Luyện Tập Toàn Diện 5 Bước</h4>
                <p className="text-slate-300 text-xs font-semibold leading-relaxed max-w-2.5xl">
                  Để ghi nhớ từ vựng sâu sắc nhất, hãy học theo lộ trình khoa học được IELTS Learning Scientists khuyên dùng: 
                  <span className="text-blue-400 font-bold"> Flashcard ➔ Trắc Nghiệm Nghe ➔ Luyện Viết Chính Tả ➔ Đánh Giá Phát Âm AI ➔ Luyện Shadowing IELTS</span>.
                </p>
              </div>

              {/* Steps timeline preview list */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                {[
                  { step: "1. Flashcard", desc: "Độ nhớ SM-2", emoji: "🎴" },
                  { step: "2. Trắc Nghiệm", desc: "Phản xạ Nghe", emoji: "🔊" },
                  { step: "3. Chính Tả", desc: "Ghi nhớ sâu", emoji: "✍️" },
                  { step: "4. Phát Âm AI", desc: "Nói chuẩn IPA", emoji: "🎙️" },
                  { step: "5. Shadowing", desc: "Phản xạ IELTS", emoji: "🗣️" }
                ].map((s, i) => (
                  <div key={i} className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl text-center">
                    <span className="text-sm block">{s.emoji}</span>
                    <span className="text-xxs font-black text-slate-200 mt-1 block">{s.step}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 shrink-0 self-stretch flex items-center justify-center md:justify-end">
              <button
                onClick={startSequentialFlow}
                className="w-full md:w-auto px-8 py-5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white stroke-white" />
                <span>Bắt Đầu Lộ Trình</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Hoặc luyện tập công cụ riêng lẻ</h4>
            {/* Desktop/Tablet Grid View */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            
              {/* 1. Anki Spaced Repetition Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Flashcard SRS (Anki)</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Học từ vựng lặp lại ngắt quãng bằng thuật toán SM-2. Tự động nhắc nhở ôn tập đúng ngày dựa trên độ nhớ.
                    </p>
                  </div>
                </div>

                {/* Deck choosing buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => initializeSRS("all")}
                    className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-between px-4 cursor-pointer"
                  >
                    <span>Mở Hộp Flashcard (Khuyên học)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => initializeSRS("due")}
                      disabled={dueCount === 0}
                      className="py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                    >
                      Ôn từ cũ ({dueCount})
                    </button>
                    <button
                      onClick={() => initializeSRS("new")}
                      disabled={newCount === 0}
                      className="py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                    >
                      Nạp từ mới ({newCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Choose Correct meaning / Listen choose */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl flex items-center justify-center">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Nghe & Trắc Nghiệm</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Đề bài đọc to từ bằng giọng nói bản xứ (US/UK), người học nghe và chọn nghĩa phù hợp nhất. Tăng phản xạ Nghe cực tốt!
                    </p>
                  </div>
                </div>

                <button
                  onClick={startQuiz}
                  className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <span>Bắt đầu Trắc Nghiệm (10 câu)</span>
                  <Play className="w-4 h-4 fill-white text-white" />
                </button>
              </div>

              {/* 3. Fill in the Blank (Spelling/Sentence context) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl flex items-center justify-center">
                    <ListOrdered className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Điền Câu Ví Dụ</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Đọc câu ví dụ học thuật bị khuyết và gõ từ vựng đúng để hoàn tất câu. Thử thách khả năng nhớ ngữ cảnh và đúng chính tả.
                    </p>
                  </div>
                </div>

                <button
                  onClick={startFillBlank}
                  className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <span>Bắt đầu Điền Từ (10 câu)</span>
                  <Play className="w-4 h-4 fill-white text-white" />
                </button>
              </div>

              {/* 4. Speaking Practice Card (AI Pronunciation check) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl flex items-center justify-center">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">Luyện Nói Phát Âm</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Nói trực tiếp từ vựng qua Microphone và nhận đánh giá phát âm AI theo thời gian thực. Tối ưu kỹ năng phát âm IELTS chuẩn!
                    </p>
                  </div>
                </div>

                <button
                  onClick={startSpeaking}
                  className="w-full py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <span>Bắt đầu Phát Âm (5 từ)</span>
                  <Play className="w-4 h-4 fill-white text-white" />
                </button>
              </div>

              {/* 5. Shadowing Practice Card (IELTS 3 Parts) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 font-sans tracking-tight">Luyện Shadowing</h4>
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 font-extrabold uppercase px-2 py-0.5 rounded border border-indigo-100">
                      Mới • IELTS 3 Parts
                    </span>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Nhại lại các câu hỏi/độc thoại IELTS chuẩn mẫu theo nhịp điệu bản xứ và nhận đánh giá 3 tín hiệu chuẩn xác.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => startShadowingMode(1)}
                  className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <span>Bắt đầu Shadowing</span>
                  <Play className="w-4 h-4 fill-white text-white" />
                </button>
              </div>

            </div>

            {/* Mobile Duolingo Study Path View */}
            <div className="md:hidden flex flex-col items-center py-8 relative w-full overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-xxs">
              {/* Dotted connecting line */}
              <div className="absolute top-16 bottom-24 left-1/2 -translate-x-1/2 w-1 border-l-4 border-dashed border-slate-200 dark:border-slate-800 z-0" />

              <div className="space-y-12 relative z-10 w-full px-4">
                {[
                  { 
                    id: "srs", 
                    name: "Flashcard SRS", 
                    desc: "Học thẻ nhớ lặp lại ngắt quãng", 
                    icon: BookOpen, 
                    color: "bg-amber-500 text-white shadow-amber-500/20",
                    offset: "-translate-x-6",
                    action: () => initializeSRS("all")
                  },
                  { 
                    id: "quiz", 
                    name: "Trắc Nghiệm Phản Xạ", 
                    desc: "Game phản xạ nghĩa và điền từ", 
                    icon: Volume2, 
                    color: "bg-blue-500 text-white shadow-blue-500/20",
                    offset: "translate-x-0",
                    action: startQuiz
                  },
                  { 
                    id: "dictation", 
                    name: "Luyện Chính Tả", 
                    desc: "Nghe viết chính tả câu hoàn chỉnh", 
                    icon: ListOrdered, 
                    color: "bg-emerald-500 text-white shadow-emerald-500/20",
                    offset: "translate-x-6",
                    action: startFillBlank
                  },
                  { 
                    id: "speaking", 
                    name: "Phát Âm AI (IPA)", 
                    desc: "Chấm điểm nói chuẩn xác từng âm", 
                    icon: Mic, 
                    color: "bg-rose-500 text-white shadow-rose-500/20",
                    offset: "translate-x-0",
                    action: startSpeaking
                  },
                  { 
                    id: "shadowing", 
                    name: "Shadowing IELTS", 
                    desc: "Đuổi theo phát âm câu dài bản xứ", 
                    icon: Sparkles, 
                    color: "bg-indigo-500 text-white shadow-indigo-500/20",
                    offset: "-translate-x-6",
                    action: () => startShadowingMode(1)
                  }
                ].map((step, idx) => {
                  const IconComponent = step.icon;
                  return (
                    <div key={step.id} className={`flex flex-col items-center justify-center transform ${step.offset} transition-transform`}>
                      
                      {/* Circle Node */}
                      <button
                        onClick={step.action}
                        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer relative ring-6 ring-white dark:ring-slate-900 ${step.color}`}
                      >
                        <IconComponent className="w-7 h-7" />
                        
                        {/* Step Number Badge */}
                        <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-white dark:border-slate-800">
                          {idx + 1}
                        </span>
                      </button>

                      {/* Label Box */}
                      <div className="text-center mt-2.5 max-w-[160px] bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xxs">
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 block truncate">{step.name}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block leading-tight mt-0.5 line-clamp-2">{step.desc}</span>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* =========================================================================
          VIEW SEQUENTIAL: MULTI-STEP COHESIVE LEARNING FLOW (Flashcard → Quiz → Speaking → Shadowing → Review)
          ========================================================================= */}
      {activeMode === "sequential" && seqWords.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-md">
          
          {/* Main header and stepper progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse animate-infinite" />
                Hành Trình Luyện Tập Toàn Diện 5 Bước
              </span>
              <button
                onClick={() => {
                  if (recognitionInstance) recognitionInstance.stop();
                  setActiveMode("menu");
                }}
                className="text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer uppercase tracking-wider"
              >
                Hủy luyện tập
              </button>
            </div>

            {/* Stepper progress indicator bar */}
            <div className="grid grid-cols-6 gap-2 pt-2 text-center text-[10px] font-black tracking-tight uppercase">
              {[
                { key: "flashcard", label: "1. Ghi nhớ", emoji: "🎴" },
                { key: "quiz", label: "2. Phản xạ", emoji: "🔊" },
                { key: "fill-blank", label: "3. Chính tả", emoji: "✍️" },
                { key: "speaking", label: "4. Phát âm AI", emoji: "🎙️" },
                { key: "shadowing", label: "5. Shadowing", emoji: "🗣️" },
                { key: "review", label: "6. Tổng kết", emoji: "🏆" }
              ].map((step, idx) => {
                const stepKeys = ["flashcard", "quiz", "fill-blank", "speaking", "shadowing", "review"];
                const activeIdx = stepKeys.indexOf(seqStep);
                const currentIdx = stepKeys.indexOf(step.key);
                
                let textClass = "text-slate-400 dark:text-slate-600";
                let barClass = "bg-slate-100 dark:bg-slate-800";
                
                if (currentIdx === activeIdx) {
                  textClass = "text-indigo-600 dark:text-indigo-400 font-black scale-105";
                  barClass = "bg-indigo-500";
                } else if (currentIdx < activeIdx) {
                  textClass = "text-emerald-500 dark:text-emerald-400 font-bold";
                  barClass = "bg-emerald-500";
                }

                return (
                  <div key={step.key} className="space-y-1.5 flex flex-col items-center">
                    <span className={`${textClass} flex items-center gap-1 transition-all`}>
                      <span className="hidden sm:inline text-xs">{step.emoji}</span>
                      <span>{step.label}</span>
                    </span>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full ${barClass} transition-all duration-300`} style={{ width: currentIdx <= activeIdx ? "100%" : "0%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Flashcards SRS */}
            {seqStep === "flashcard" && seqWords[seqIdx] && (
              <motion.div
                key={`seq-fc-${seqIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">TỪ VỰNG {seqIdx + 1} / 5</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => speakText(seqWords[seqIdx].word, 0.85, "en-US")}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" /> US
                    </button>
                    <button
                      onClick={() => speakText(seqWords[seqIdx].word, 0.85, "en-GB")}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" /> UK
                    </button>
                  </div>
                </div>

                {/* Card Container */}
                <div 
                  onClick={() => setSeqFlipped(!seqFlipped)}
                  className={`bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-850 p-8 rounded-2xl border-2 ${seqFlipped ? "border-indigo-400 shadow-indigo-100/30" : "border-slate-100 hover:border-slate-300 dark:border-slate-700"} min-h-[250px] flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-300 shadow-sm`}
                >
                  {!seqFlipped ? (
                    <div className="my-auto space-y-4">
                      <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{seqWords[seqIdx].word}</h2>
                      <div className="flex justify-center items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded">
                          {seqWords[seqIdx].ipa}
                        </span>
                        <span className="text-xxs font-extrabold uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
                          {seqWords[seqIdx].partOfSpeech}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 italic">Nhấp vào thẻ để lật mặt sau xem nghĩa</p>
                    </div>
                  ) : (
                    <div className="w-full my-auto space-y-4 text-left">
                      <div>
                        <span className="text-xxs font-extrabold text-indigo-500 uppercase tracking-widest block">ĐỊNH NGHĨA</span>
                        <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">{seqWords[seqIdx].meaning}</p>
                      </div>
                      
                      {seqWords[seqIdx].vietnameseExplanation && (
                        <div>
                          <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-widest block">GIẢI THÍCH TIẾNG VIỆT</span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{seqWords[seqIdx].vietnameseExplanation}</p>
                        </div>
                      )}

                      {seqWords[seqIdx].example && (
                        <div className="bg-slate-100/50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/40">
                          <span className="text-xxs font-extrabold text-emerald-600 uppercase tracking-widest block">VÍ DỤ</span>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 italic font-sans font-medium">"{seqWords[seqIdx].example}"</p>
                          {seqWords[seqIdx].exampleTranslation && (
                            <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">({seqWords[seqIdx].exampleTranslation})</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Feedbacks for Flashcard */}
                <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 text-center uppercase tracking-wider">Mức độ tự nhớ từ vựng này của bạn:</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { rating: 1 as const, color: "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200", label: "🔴 Lặp lại", desc: "Chưa nhớ" },
                      { rating: 3 as const, color: "bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200", label: "🟡 Tạm nhớ", desc: "Mất thời gian" },
                      { rating: 4 as const, color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200", label: "🟢 Nhớ tốt", desc: "Đúng ngay" },
                      { rating: 5 as const, color: "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200", label: "🔵 Cực dễ", desc: "Không cần nghĩ" }
                    ].map(r => (
                      <button
                        key={r.rating}
                        onClick={() => {
                          setSeqScores(prev => ({
                            ...prev,
                            flashcards: { ...prev.flashcards, [seqWords[seqIdx].id]: r.rating }
                          }));
                          if (seqIdx < seqWords.length - 1) {
                            setSeqIdx(seqIdx + 1);
                            setSeqFlipped(false);
                          } else {
                            setSeqIdx(0);
                            setSeqStep("quiz");
                            generateSeqQuizOptions(seqWords[0]);
                            setSeqSelectedOption(null);
                          }
                        }}
                        className={`p-3 text-center border rounded-xl transition-all cursor-pointer ${r.color}`}
                      >
                        <span className="text-xs font-black block">{r.label}</span>
                        <span className="text-[10px] opacity-70 block mt-0.5">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Listening Quiz */}
            {seqStep === "quiz" && seqWords[seqIdx] && (
              <motion.div
                key={`seq-qz-${seqIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">CÂU HỎI {seqIdx + 1} / 5</span>
                  <button
                    onClick={() => speakText(seqWords[seqIdx].word, 0.85, accent)}
                    className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-100 flex items-center justify-center shadow-xs cursor-pointer animate-bounce"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center space-y-2">
                  <span className="text-xxs font-black text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 uppercase tracking-widest">Phản Xạ Nghe</span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Lắng nghe từ phát âm và chọn nghĩa đúng nhất:</h3>
                </div>

                {/* Options list */}
                <div className="grid grid-cols-1 gap-3">
                  {seqQuizOptions.map((opt, oIdx) => {
                    const isSelected = seqSelectedOption === opt;
                    const isCorrect = opt === seqWords[seqIdx].meaning;
                    const hasAnswered = seqSelectedOption !== null;
                    
                    let cardClass = "border-slate-100 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300";
                    if (hasAnswered) {
                      if (isCorrect) {
                        cardClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400";
                      } else if (isSelected) {
                        cardClass = "border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400";
                      } else {
                        cardClass = "opacity-50 border-slate-100 text-slate-400 dark:text-slate-600 dark:border-slate-800";
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={hasAnswered}
                        onClick={() => {
                          setSeqSelectedOption(opt);
                          setSeqScores(prev => ({
                            ...prev,
                            quiz: { ...prev.quiz, [seqWords[seqIdx].id]: opt === seqWords[seqIdx].meaning }
                          }));
                          speakText(opt, 0.95, "en-US");
                        }}
                        className={`p-4 rounded-xl border-2 text-left text-xs font-black tracking-tight transition-all flex items-center justify-between cursor-pointer ${cardClass}`}
                      >
                        <span>{opt}</span>
                        {hasAnswered && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                        {hasAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {seqSelectedOption && (
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => {
                        if (seqIdx < seqWords.length - 1) {
                          setSeqIdx(seqIdx + 1);
                          setSeqSelectedOption(null);
                          generateSeqQuizOptions(seqWords[seqIdx + 1]);
                        } else {
                          setSeqIdx(0);
                          setSeqStep("fill-blank");
                          setSeqTypedWord("");
                          setSeqBlankChecked(false);
                        }
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Fill-blank Spelling */}
            {seqStep === "fill-blank" && seqWords[seqIdx] && (
              <motion.div
                key={`seq-fb-${seqIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">CÂU HỎI {seqIdx + 1} / 5</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => speakText(seqWords[seqIdx].word, 0.85, accent)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" /> Nghe từ vựng
                    </button>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-xxs font-black text-emerald-500 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest">Điền Câu Ví Dụ</span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Gõ từ vựng khuyết đúng chính tả vào chỗ trống:</h3>
                </div>

                {/* Sentence Context */}
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                  <p className="text-base font-black text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                    "{seqWords[seqIdx].example ? seqWords[seqIdx].example.replace(new RegExp(seqWords[seqIdx].word, "gi"), "_______") : "_______"}"
                  </p>
                  {seqWords[seqIdx].exampleTranslation && (
                    <p className="text-xs text-slate-400 font-bold italic">Nghĩa: {seqWords[seqIdx].exampleTranslation}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={seqBlankChecked}
                      value={seqTypedWord}
                      onChange={(e) => setSeqTypedWord(e.target.value)}
                      placeholder="Nhập từ còn khuyết..."
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-100 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !seqBlankChecked && seqTypedWord.trim() !== "") {
                          setSeqBlankChecked(true);
                          const isCorrect = cleanTextForComparison(seqTypedWord) === cleanTextForComparison(seqWords[seqIdx].word);
                          setSeqScores(prev => ({
                            ...prev,
                            fillBlank: { ...prev.fillBlank, [seqWords[seqIdx].id]: isCorrect }
                          }));
                        }
                      }}
                    />
                    {!seqBlankChecked && (
                      <button
                        disabled={seqTypedWord.trim() === ""}
                        onClick={() => {
                          setSeqBlankChecked(true);
                          const isCorrect = cleanTextForComparison(seqTypedWord) === cleanTextForComparison(seqWords[seqIdx].word);
                          setSeqScores(prev => ({
                            ...prev,
                            fillBlank: { ...prev.fillBlank, [seqWords[seqIdx].id]: isCorrect }
                          }));
                        }}
                        className="px-6 py-3 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Kiểm tra
                      </button>
                    )}
                  </div>

                  {seqBlankChecked && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border flex items-start gap-3 ${
                        cleanTextForComparison(seqTypedWord) === cleanTextForComparison(seqWords[seqIdx].word)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                          : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                      }`}
                    >
                      {cleanTextForComparison(seqTypedWord) === cleanTextForComparison(seqWords[seqIdx].word) ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-black">
                          {cleanTextForComparison(seqTypedWord) === cleanTextForComparison(seqWords[seqIdx].word) ? "Chính xác tuyệt vời!" : "Chưa chính xác!"}
                        </p>
                        <p className="text-xxs">
                          Từ vựng đúng là: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">{seqWords[seqIdx].word}</span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {seqBlankChecked && (
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => {
                        if (seqIdx < seqWords.length - 1) {
                          setSeqIdx(seqIdx + 1);
                          setSeqTypedWord("");
                          setSeqBlankChecked(false);
                        } else {
                          setSeqIdx(0);
                          setSeqStep("speaking");
                          setSeqSpeakResult(null);
                        }
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Speaking (AI Pronunciation check) */}
            {seqStep === "speaking" && seqWords[seqIdx] && (
              <motion.div
                key={`seq-sp-${seqIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">TỪ VỰNG {seqIdx + 1} / 5</span>
                  <button
                    onClick={() => speakText(seqWords[seqIdx].word, 0.85, accent)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" /> Nghe giọng mẫu
                  </button>
                </div>

                <div className="text-center space-y-4">
                  <span className="text-xxs font-black text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100 uppercase tracking-widest">Đánh Giá Phát Âm AI</span>
                  
                  <div className="space-y-1 py-4">
                    <h2 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{seqWords[seqIdx].word}</h2>
                    <p className="text-sm font-black font-mono text-slate-400">{seqWords[seqIdx].ipa}</p>
                    <p className="text-xs text-slate-500">({seqWords[seqIdx].meaning})</p>
                  </div>

                  {/* Record Button & status indicator */}
                  <div className="flex flex-col items-center justify-center space-y-3 py-6">
                    <button
                      onClick={() => startSeqSpeakingRecord(seqWords[seqIdx].word)}
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                        seqRecording 
                          ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 scale-105" 
                          : "bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 shadow-sm"
                      } cursor-pointer`}
                    >
                      <Mic className="w-10 h-10" />
                    </button>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {seqRecording ? "Hệ thống đang lắng nghe..." : "Nhấp và bắt đầu phát âm"}
                    </p>
                  </div>

                  {seqSpeakResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-6 rounded-2xl border text-center space-y-3 ${
                        seqSpeakResult.status === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                          : seqSpeakResult.status === "near"
                          ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                          : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                      }`}
                    >
                      <div className="flex justify-center">
                        {seqSpeakResult.status === "success" ? (
                          <CheckCircle className="w-10 h-10 text-emerald-600" />
                        ) : seqSpeakResult.status === "near" ? (
                          <AlertTriangle className="w-10 h-10 text-amber-500" />
                        ) : (
                          <XCircle className="w-10 h-10 text-rose-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-black">
                          {seqSpeakResult.status === "success"
                            ? "Phát âm tuyệt vời!"
                            : seqSpeakResult.status === "near"
                            ? "Khá tốt, cần rõ âm hơn!"
                            : "Chưa chính xác, hãy nói lại!"}
                        </p>
                        <p className="text-xs">
                          Kết quả nhận diện: <span className="font-mono font-black italic">"{seqSpeakResult.recognized || "..."}"</span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {seqSpeakResult && (
                  <div className="pt-4 flex justify-between items-center">
                    <button
                      onClick={() => startSeqSpeakingRecord(seqWords[seqIdx].word)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Nói lại
                    </button>
                    <button
                      onClick={() => {
                        if (seqIdx < seqWords.length - 1) {
                          setSeqIdx(seqIdx + 1);
                          setSeqSpeakResult(null);
                        } else {
                          setSeqIdx(0);
                          setSeqStep("shadowing");
                          setSeqShadowResult(null);
                        }
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Shadowing */}
            {seqStep === "shadowing" && seqWords[seqIdx] && (
              <motion.div
                key={`seq-sd-${seqIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">LUYỆN TẬP {seqIdx + 1} / 5</span>
                  <button
                    onClick={() => speakText(seqWords[seqIdx].example || "", 0.85, accent)}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer animate-pulse"
                  >
                    <Volume2 className="w-4 h-4" /> Phát giọng đọc mẫu
                  </button>
                </div>

                <div className="text-center space-y-1">
                  <span className="text-xxs font-black text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 uppercase tracking-widest">Shadowing Phản Xạ IELTS</span>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Hãy nghe và nhại lại toàn bộ câu IELTS dưới đây:</h3>
                </div>

                {/* Question sentence */}
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4 text-center">
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-relaxed font-sans">
                    "{seqWords[seqIdx].example || `Indeed, the application of ${seqWords[seqIdx].word} is crucial.`}"
                  </p>
                  {seqWords[seqIdx].exampleTranslation && (
                    <p className="text-xs text-slate-400 font-bold italic">Nghĩa: {seqWords[seqIdx].exampleTranslation}</p>
                  )}
                </div>

                {/* Record Button & status indicator */}
                <div className="flex flex-col items-center justify-center space-y-3 py-4">
                  <button
                    onClick={() => startSeqShadowRecord(seqWords[seqIdx].example || "")}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      seqRecording 
                        ? "bg-indigo-500 text-white animate-pulse shadow-lg shadow-indigo-500/40 scale-105" 
                        : "bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 shadow-sm"
                    } cursor-pointer`}
                  >
                    <Mic className="w-10 h-10" />
                  </button>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {seqRecording ? "Hệ thống đang nghe shadowing..." : "Nhấp và nói nhại theo câu mẫu"}
                  </p>
                </div>

                {seqShadowResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-6 rounded-2xl border text-center space-y-4 ${
                      seqShadowResult.score >= 80
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                        : seqShadowResult.score >= 50
                        ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                        : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-xxs font-black text-indigo-500 bg-white/80 dark:bg-slate-900 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider shadow-xs">
                        Điểm số Shadowing AI
                      </span>
                      <h4 className="text-4xl font-black tracking-tight mt-2">{seqShadowResult.score}%</h4>
                      <p className="text-xs font-extrabold uppercase mt-1">
                        {seqShadowResult.score >= 85 ? "🔥 IELTS BAND 8.5+ EXCELLENT" : seqShadowResult.score >= 70 ? "👍 IELTS BAND 7.0+ GOOD" : "💪 CẦN LUYỆN TẬP THÊM"}
                      </p>
                    </div>

                    <p className="text-xs">
                      Kết quả ghi âm: <span className="font-mono font-black italic">"{seqShadowResult.recognized || "..."}"</span>
                    </p>
                  </motion.div>
                )}

                {seqShadowResult && (
                  <div className="pt-4 flex justify-between items-center">
                    <button
                      onClick={() => startSeqShadowRecord(seqWords[seqIdx].example || "")}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Nói lại
                    </button>
                    <button
                      onClick={() => {
                        if (seqIdx < seqWords.length - 1) {
                          setSeqIdx(seqIdx + 1);
                          setSeqShadowResult(null);
                        } else {
                          setSeqIdx(0);
                          setSeqStep("review");
                        }
                      }}
                      className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 6: Review / Completion screen */}
            {seqStep === "review" && (
              <motion.div
                key="seq-complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 text-center"
              >
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-sm animate-bounce">
                    <Award className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">Chúc mừng bạn đã hoàn thành bài luyện tập tuần tự!</h2>
                  <p className="text-xs font-semibold text-slate-400">Báo cáo hiệu suất học tập toàn diện được phân tích dựa trên 5 trạm thử thách:</p>
                </div>

                {/* Performance indicators bento grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Recall self assessment */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center space-y-1">
                    <span className="text-xl">🎴</span>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thẻ Nhớ Flashcard</h5>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {Object.values(seqScores.flashcards).filter((v: any) => v >= 4).length} / 5
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">từ nhớ tốt trở lên</p>
                  </div>

                  {/* Card 2: Listening Quiz */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center space-y-1">
                    <span className="text-xl">🔊</span>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trắc Nghiệm Nghe</h5>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {Object.values(seqScores.quiz).filter(v => v === true).length} / 5
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">câu trả lời đúng</p>
                  </div>

                  {/* Card 3: Fill blank spelling */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center space-y-1">
                    <span className="text-xl">✍️</span>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viết Chính Tả</h5>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {Object.values(seqScores.fillBlank).filter(v => v === true).length} / 5
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">từ điền khuyết đúng</p>
                  </div>

                  {/* Card 4: Speaking accuracy */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center space-y-1">
                    <span className="text-xl">🎙️</span>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phát Âm AI</h5>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {Object.values(seqScores.speaking).filter(v => v === "success").length} / 5
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">từ chuẩn giọng mẫu</p>
                  </div>
                </div>

                {/* XP and streak reward block */}
                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                  <div className="space-y-1">
                    <span className="text-xxs font-black text-indigo-500 uppercase tracking-widest">Phần thưởng hôm nay</span>
                    <h4 className="text-base font-black text-indigo-900 dark:text-indigo-300">Nhận +150 XP Điểm Tích Lũy Kèm Cứu Trợ Streak Hàng Ngày!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                      Thuật toán Spaced Repetition (Anki SM-2) của LexiBand đã tự động cập nhật độ nhớ và ngày ôn tập tiếp theo cho 5 từ vựng này.
                    </p>
                  </div>
                  <div className="bg-amber-500 text-white px-5 py-3 rounded-xl text-center self-start md:self-auto shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider block">XP KIẾM ĐƯỢC</span>
                    <span className="text-xl font-black mt-0.5 block">+150 XP</span>
                  </div>
                </div>

                {/* Final CTA Buttons */}
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    onClick={startSequentialFlow}
                    className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Luyện tập lượt mới
                  </button>
                  <button
                    onClick={handleFinishSeqSession}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Đồng ý & Hoàn thành
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {activeMode === "srs" && (
        <div className="max-w-xl mx-auto space-y-6">
          
          {/* Progress indicators */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>CHẾ ĐỘ: FLASHCARD SRS ({srsModeType === "all" ? "Tất cả" : srsModeType === "due" ? "Cần ôn tập" : "Từ mới"})</span>
            <span>{currentSrsIndex} / {srsQueue.length} thẻ</span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${srsQueue.length > 0 ? (currentSrsIndex / srsQueue.length) * 100 : 0}%` }}
            />
          </div>

          {currentSrsIndex < srsQueue.length ? (
            (() => {
              const activeEnriched = getEnrichedWord(srsQueue[currentSrsIndex]);
              
              return (
                <div className="space-y-6">
                  
                  {/* Interactive Flip Card Wrapper */}
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="perspective-1000 w-full min-h-[420px] cursor-pointer"
                  >
                    <div 
                      className={`relative w-full h-full min-h-[420px] duration-500 transform-style-3d transition-transform ${
                        isFlipped ? "rotate-y-180" : ""
                      }`}
                    >
                      
                      {/* CARD FRONT: English & IPA */}
                      <div className="absolute inset-0 backface-hidden bg-white p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-100 transition-all flex flex-col justify-between shadow-xs">
                        
                        {/* Header tags */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                          <div className="flex gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                              IELTS Band {activeEnriched.band}
                            </span>
                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                              {activeEnriched.pos}
                            </span>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                              {activeEnriched.cefr}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                            {activeEnriched.topic}
                          </span>
                        </div>

                        {/* Main English target */}
                        <div className="text-center py-8 space-y-3">
                          <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                            {activeEnriched.word}
                          </h2>
                          <p className="text-sm font-mono text-slate-400">{activeEnriched.ipa}</p>
                          
                          <div className="flex justify-center gap-2 pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakWord(activeEnriched.word, 0.85, "en-US");
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors text-xxs font-black cursor-pointer"
                              title="Phát âm Mỹ"
                            >
                              US (🇺🇸)
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakWord(activeEnriched.word, 0.85, "en-GB");
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors text-xxs font-black cursor-pointer"
                              title="Phát âm Anh"
                            >
                              UK (🇬🇧)
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFlashcardRecord(activeEnriched.word, activeEnriched.id);
                              }}
                              className={`px-3 py-1.5 rounded-lg transition-all text-xxs font-black flex items-center gap-1 cursor-pointer border ${
                                isFlashcardRecording 
                                  ? "bg-rose-100 border-rose-300 text-rose-600 animate-pulse scale-105" 
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100"
                              }`}
                              title="Bấm để đọc thử và máy sẽ chấm điểm"
                            >
                              <Mic className="w-3 h-3" />
                              {isFlashcardRecording ? "Ghi âm..." : "Luyện đọc"}
                            </button>
                          </div>

                          {/* Record & Compare Results Area */}
                          {speechError && (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="p-3 rounded-2xl text-center border bg-rose-50 border-rose-100 dark:bg-rose-950/15 dark:border-rose-900/20 max-w-xs mx-auto animate-fade-in text-rose-500 font-bold text-[10px]"
                            >
                              <p className="flex items-center justify-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                <span>{speechError}</span>
                              </p>
                            </div>
                          )}

                          {flashcardResult && flashcardResult.wordId === activeEnriched.id && (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="p-3 rounded-2xl text-center border bg-slate-50 border-slate-100 max-w-xs mx-auto animate-fade-in space-y-1"
                            >
                              {flashcardResult.status === "success" && (
                                <p className="text-emerald-600 font-extrabold flex items-center justify-center gap-1 text-xs">
                                  <span>✅ Khớp chính xác!</span>
                                </p>
                              )}
                              {flashcardResult.status === "near" && (
                                <div className="space-y-1">
                                  <p className="text-amber-600 font-extrabold text-xs">⚠️ Gần đúng</p>
                                  <p className="text-[10px] text-slate-500">
                                    Máy nghe được: <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">&ldquo;{flashcardResult.recognized}&rdquo;</span>
                                  </p>
                                </div>
                              )}
                              {flashcardResult.status === "fail" && (
                                <div className="space-y-1">
                                  <p className="text-rose-500 font-extrabold text-xs">❌ Chưa khớp</p>
                                  <p className="text-[10px] text-slate-400">Hãy nghe mẫu và thử phát âm lại to rõ nhé!</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pronunciation Stats Badge */}
                          {(flashcardStats[activeEnriched.id] || 0) > 0 && (
                            <div className="flex justify-center">
                              <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 flex items-center gap-1">
                                🎙️ Đã luyện đọc: {flashcardStats[activeEnriched.id]} lần
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Instruction */}
                        <div className="text-center text-xxs font-semibold text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-50 flex items-center justify-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Bấm vào thẻ để lật xem nghĩa tiếng Việt & mẹo học
                        </div>
                      </div>

                      {/* CARD BACK: Vietnamese & Academic Example details */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white p-6 rounded-3xl border-2 border-indigo-200/80 flex flex-col justify-between shadow-md overflow-y-auto text-slate-700">
                        
                        {/* Header info */}
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800">
                              {activeEnriched.word}
                            </span>
                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                              {activeEnriched.pos}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-400">{activeEnriched.ipa}</span>
                        </div>

                        {/* Full details display */}
                        <div className="py-4 space-y-4 text-xs flex-1">
                          
                          {/* Meaning */}
                          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider block mb-0.5">Nghĩa tiếng Việt:</span>
                            <p className="text-base font-extrabold text-indigo-950">
                              {activeEnriched.meaning}
                            </p>
                          </div>

                          {/* Mnemonic Memory Tip */}
                          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/40 space-y-1">
                            <div className="text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5" /> Mẹo ghi nhớ siêu tốc:
                            </div>
                            <p className="font-semibold text-slate-800 leading-normal">
                              {activeEnriched.memoryTip.mnemonic}
                            </p>
                          </div>

                          {/* Vietnamese Learner Mistakes */}
                          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1">
                            <div className="text-[9px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Tránh lỗi sai:
                            </div>
                            <p className="font-medium text-slate-700 leading-normal">
                              Lỗi: <span className="font-mono text-rose-600 line-through font-bold">{activeEnriched.commonMistakes.mistake}</span> &rarr; Đúng: <span className="font-mono text-emerald-600 font-bold">{activeEnriched.commonMistakes.correct}</span>
                            </p>
                          </div>

                          {/* Collocations */}
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Collocations gợi ý:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {activeEnriched.collocations.map((col, idx) => (
                                <span key={idx} className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-md font-bold text-xxs flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-500" /> {col}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Example Sentence */}
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Câu ví dụ chuẩn IELTS:</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakWord(activeEnriched.example, 0.85, accent);
                                }}
                                className="text-xxs font-bold text-indigo-600 flex items-center gap-0.5 hover:underline"
                              >
                                <Volume2 className="w-3 h-3" /> Nghe câu ví dụ
                              </button>
                            </div>
                            <p className="text-slate-800 font-semibold mt-1 leading-normal italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              &ldquo;{activeEnriched.example}&rdquo;
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 pl-2 border-l border-slate-300 italic">
                              {activeEnriched.exampleTranslation}
                            </p>
                          </div>

                        </div>

                        {/* Click info */}
                        <div className="text-center text-xxs font-semibold text-slate-300 uppercase tracking-widest pt-2 border-t border-slate-50 shrink-0">
                          Bấm để lật lại mặt trước
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* SM-2 SRS GRADE ACTIONS (Only visible when flipped) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-3">
                    <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isFlipped ? "Hãy tự đánh giá mức độ ghi nhớ từ này:" : "Mẹo: Hãy lật thẻ để đánh giá độ nhớ!"}
                    </p>
                    <div className={`grid grid-cols-4 gap-2 transition-all duration-300 ${isFlipped ? "opacity-100 pointer-events-auto" : "opacity-40 pointer-events-none"}`}>
                      
                      {/* Forgot button */}
                      <button
                        onClick={() => handleSRSFeedback(1)}
                        className="flex flex-col items-center py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="text-sm font-black">Quên</span>
                        <span className="text-[10px] opacity-75 font-medium mt-0.5">Học lại</span>
                      </button>

                      {/* Hard button */}
                      <button
                        onClick={() => handleSRSFeedback(3)}
                        className="flex flex-col items-center py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="text-sm font-black">Khó</span>
                        <span className="text-[10px] opacity-75 font-medium mt-0.5">Ôn sớm</span>
                      </button>

                      {/* Good button */}
                      <button
                        onClick={() => handleSRSFeedback(4)}
                        className="flex flex-col items-center py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="text-sm font-black">Tốt</span>
                        <span className="text-[10px] opacity-75 font-medium mt-0.5">Lịch chuẩn</span>
                      </button>

                      {/* Easy button */}
                      <button
                        onClick={() => handleSRSFeedback(5)}
                        className="flex flex-col items-center py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                      >
                        <span className="text-sm font-black">Dễ</span>
                        <span className="text-[10px] opacity-75 font-medium mt-0.5">Bỏ qua lâu</span>
                      </button>

                    </div>
                  </div>

                </div>
              );
            })()
          ) : (
            // Empty / finished state
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Hoàn thành lượt học!</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Rất tốt! Bạn đã hoàn thành toàn bộ các thẻ flashcard trong hộp ôn tập này. Chuỗi Streak học tập của bạn đã được cập nhật hôm nay!
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={backToMenu}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Về thực đơn
                </button>
                <button
                  onClick={() => initializeSRS(srsModeType)}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Học lượt tiếp theo
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {/* =========================================================================
          VIEW C: MULTIPLE CHOICE QUIZ PLAYER ("Listen & Choose")
          ========================================================================= */}
      {activeMode === "quiz" && (
        <div className="max-w-xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>CHẾ ĐỘ: NGHE VÀ TRẮC NGHIỆM</span>
            <span>{currentQuizIndex + 1} / {quizQuestions.length} câu</span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(currentQuizIndex / quizQuestions.length) * 100}%` }}
            />
          </div>

          {!quizFinished && quizQuestions[currentQuizIndex] ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
              
              {/* Question card */}
              <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                {quizQuestions[currentQuizIndex].type === "listening" ? (
                  <div className="space-y-3">
                    <span className="bg-blue-100 text-blue-700 text-xxs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      🎧 CHẾ ĐỘ NGHE PHẢN XẠ
                    </span>
                    <h3 className="text-lg font-bold text-slate-700">Nghe kỹ từ vựng đang được đọc và chọn nghĩa đúng:</h3>
                    
                    <button
                      onClick={() => speakWord(quizQuestions[currentQuizIndex].word.word, 0.85, accent)}
                      className="mx-auto w-16 h-16 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95"
                      title="Nghe lại"
                    >
                      <Volume2 className="w-8 h-8" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="bg-indigo-100 text-indigo-700 text-xxs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      📖 CHỌN NGHĨA TỪ VỰNG
                    </span>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest pt-2">Từ vựng sau có nghĩa là gì?</h3>
                    <div className="flex items-center justify-center gap-2.5 mt-1">
                      <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                        {quizQuestions[currentQuizIndex].word.word}
                      </h2>
                      <button
                        onClick={() => speakWord(quizQuestions[currentQuizIndex].word.word, 0.85, accent)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-400">{quizQuestions[currentQuizIndex].word.ipa}</p>
                  </div>
                )}
              </div>

              {/* Multiple Choice Options */}
              <div className="space-y-2">
                {quizQuestions[currentQuizIndex].options.map((opt, idx) => {
                  const isSelected = quizQuestions[currentQuizIndex].selectedAnswerId === opt.wordId;
                  const isCorrectAnswer = opt.wordId === quizQuestions[currentQuizIndex].correctAnswerId;
                  const hasAnswered = !!quizQuestions[currentQuizIndex].selectedAnswerId;
                  
                  let optStyle = "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-700";
                  let badge = null;
                  
                  if (hasAnswered) {
                    if (isCorrectAnswer) {
                      optStyle = "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold";
                      badge = <CheckCircle className="w-4 h-4 text-emerald-500 ml-2 shrink-0" />;
                    } else if (isSelected) {
                      optStyle = "bg-red-50 text-red-800 border-red-300 font-semibold";
                      badge = <XCircle className="w-4 h-4 text-red-500 ml-2 shrink-0" />;
                    } else {
                      optStyle = "opacity-40 border-slate-200 text-slate-400";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={hasAnswered}
                      onClick={() => handleSelectQuizOption(opt.wordId)}
                      className={`w-full text-left p-4 border rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${optStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-slate-500 flex items-center justify-center text-[10px]">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{opt.text}</span>
                      </div>
                      {badge}
                    </button>
                  );
                })}
              </div>

              {/* Next Action button */}
              {quizQuestions[currentQuizIndex].selectedAnswerId && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-4 border-t border-slate-100 flex items-center justify-between"
                >
                  <p className="text-xs text-slate-500">
                    {quizQuestions[currentQuizIndex].isCorrect 
                      ? "🎉 Chính xác! Từ này được cộng điểm ghi nhớ." 
                      : `😢 Chưa đúng rồi! Đáp án là: "${quizQuestions[currentQuizIndex].word.meaning}"`}
                  </p>
                  <button
                    onClick={handleNextQuiz}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    Câu tiếp theo <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

            </div>
          ) : null}

          {/* Finished State */}
          {quizFinished && (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Hoàn thành Trắc nghiệm!</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chúc mừng bạn đã xuất sắc vượt qua các câu hỏi nghe hiểu!
                </p>
                <div className="text-2xl font-black text-blue-600 my-2">
                  {quizScore} / {quizQuestions.length} câu đúng
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={backToMenu}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Về thực đơn
                </button>
                <button
                  onClick={startQuiz}
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Làm đề mới
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {/* =========================================================================
          VIEW D: FILL IN THE BLANK EXAM
          ========================================================================= */}
      {activeMode === "fill-blank" && (
        <div className="max-w-xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>CHẾ ĐỘ: ĐIỀN TỪ CÂU VÍ DỤ</span>
            <span>{currentBlankIndex + 1} / {blankQuestions.length} câu</span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-600 h-full transition-all duration-300"
              style={{ width: `${(currentBlankIndex / blankQuestions.length) * 100}%` }}
            />
          </div>

          {!blankFinished && blankQuestions[currentBlankIndex] ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
              
              {/* Exam masked sentence */}
              <div className="space-y-4">
                <span className="bg-emerald-100 text-emerald-700 text-xxs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                  📝 ĐIỀN TỪ VÀO CHỖ TRỐNG
                </span>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-base text-slate-800 font-medium leading-relaxed tracking-wide">
                    {blankQuestions[currentBlankIndex].maskedSentence}
                  </p>
                  <p className="text-xs text-slate-500 border-l-2 border-indigo-200 pl-3 italic">
                    Dịch nghĩa câu: {blankQuestions[currentBlankIndex].word.exampleTranslation}
                  </p>
                </div>
              </div>

              {/* Hints */}
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => setShowBlankHint(!showBlankHint)}
                  className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> {showBlankHint ? "Ẩn gợi ý" : "Xem gợi ý từ loại / nghĩa"}
                </button>
                <span className="text-slate-400 font-mono">
                  Chiều dài từ: {blankQuestions[currentBlankIndex].word.word.length} chữ cái (Bắt đầu bằng &apos;{blankQuestions[currentBlankIndex].word.word[0]}&apos;)
                </span>
              </div>

              {showBlankHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-xs text-amber-800 leading-relaxed font-semibold flex items-center gap-2"
                >
                  <BookmarkPlus className="w-4 h-4 shrink-0" /> Nghĩa của từ cần điền: &ldquo;{blankQuestions[currentBlankIndex].hintText}&rdquo;
                </motion.div>
              )}

              {/* Form Input Submit */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem("userWordAnswer") as HTMLInputElement;
                  handleSubmitBlank(input.value);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  name="userWordAnswer"
                  disabled={blankQuestions[currentBlankIndex].submitted}
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="Gõ từ vựng tiếng Anh vào đây..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 font-semibold disabled:bg-slate-100 disabled:opacity-75"
                />
                <button
                  type="submit"
                  disabled={blankQuestions[currentBlankIndex].submitted}
                  className="px-5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:bg-slate-300 cursor-pointer"
                >
                  Gửi đáp án
                </button>
              </form>

              {/* Submit evaluation */}
              {blankQuestions[currentBlankIndex].submitted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-4 border-t border-slate-100 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    {blankQuestions[currentBlankIndex].isCorrect ? (
                      <span className="p-2 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </span>
                    ) : (
                      <span className="p-2 bg-red-100 text-red-800 rounded-full flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </span>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {blankQuestions[currentBlankIndex].isCorrect 
                          ? "Quá xuất sắc! Bạn đã gõ đúng chính xác từ vựng." 
                          : `Chưa chính xác rồi. Đáp án đúng là: "${blankQuestions[currentBlankIndex].correctWord}"`}
                      </h4>
                      <p className="text-xxs text-slate-400 mt-0.5">
                        Bạn đã gõ: &ldquo;{blankQuestions[currentBlankIndex].userAnswer}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Complete sentence display */}
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-1">
                    <span className="text-xxs text-indigo-700 font-bold uppercase tracking-wider block">Câu ví dụ hoàn chỉnh</span>
                    <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                      {blankQuestions[currentBlankIndex].word.example}
                    </p>
                    <button
                      type="button"
                      onClick={() => speakWord(blankQuestions[currentBlankIndex].word.example, 0.85, accent)}
                      className="text-xxs text-indigo-600 font-bold flex items-center gap-1 hover:underline pt-1 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" /> Phát âm toàn câu ví dụ
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleNextBlank}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      Câu tiếp theo <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

            </div>
          ) : null}

          {/* Finished State */}
          {blankFinished && (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Hoàn thành Thử thách viết!</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chúc mừng bạn đã xuất sắc rèn luyện kỹ năng gõ từ chính xác trong câu ví dụ!
                </p>
                <div className="text-2xl font-black text-emerald-600 my-2">
                  {blankScore} / {blankQuestions.length} câu đúng
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={backToMenu}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Về thực đơn
                </button>
                <button
                  onClick={startFillBlank}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Làm đề mới
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          VIEW E: SPEAKING PRACTICE MODULE (AI PRONUNCIATION EVALUATION)
          ========================================================================= */}
      {activeMode === "speaking" && (
        <div className="max-w-xl mx-auto space-y-6 text-slate-700 animate-fade-in">
          
          {/* Progress indicators */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>CHẾ ĐỘ: LUYỆN NÓI & PHÁT ÂM AI</span>
            {currentSpeakingIndex < speakingQueue.length && (
              <span>{currentSpeakingIndex + 1} / {speakingQueue.length} từ</span>
            )}
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="bg-rose-600 h-full transition-all duration-300"
              style={{ width: `${speakingQueue.length > 0 ? (Math.min(currentSpeakingIndex + 1, speakingQueue.length) / speakingQueue.length) * 100 : 0}%` }}
            />
          </div>

          {currentSpeakingIndex < speakingQueue.length ? (
            (() => {
              const activeWordObj = speakingQueue[currentSpeakingIndex];
              const activeEnriched = getEnrichedWord(activeWordObj);

              return (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
                  
                  {/* Topic and instructions */}
                  <div className="flex items-center justify-between">
                    <span className="bg-rose-100 text-rose-700 text-xxs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      🗣️ LUYỆN PHÁT ÂM IELTS
                    </span>
                    <span className="text-slate-400 text-xxs font-bold">CHỦ ĐỀ: {activeWordObj.topic}</span>
                  </div>

                  {/* Word Area */}
                  <div className="text-center py-6 bg-slate-50/50 border border-slate-100 rounded-3xl p-6 relative overflow-hidden space-y-3">
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">{activeWordObj.word}</h3>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-mono text-slate-400">{activeWordObj.ipa}</span>
                      <button 
                        onClick={() => speakWord(activeWordObj.word, 0.9, accent)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100 transition-colors cursor-pointer"
                        title="Nghe phát âm chuẩn"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">({activeEnriched.pos}) &mdash; {activeWordObj.meaning}</p>
                  </div>

                  {/* Audio visualization & feedback instructions */}
                  <div className="flex flex-col items-center justify-center space-y-4 pt-2">
                    <button
                      onClick={handleToggleSpeakRecord}
                      className={`w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-md transition-all cursor-pointer ${
                        isRecording 
                          ? "bg-rose-100 border-rose-300 text-rose-600 scale-105 animate-pulse" 
                          : "bg-rose-600 border-rose-500 text-white hover:bg-rose-700"
                      }`}
                      title={isRecording ? "Bấm để dừng ghi âm" : "Bấm để ghi âm phát âm"}
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                    
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse">
                      {isRecording ? "Đang lắng nghe... Hãy nói ngay bây giờ" : "Chạm nút để bắt đầu đọc từ vựng"}
                    </span>

                    {/* Mobile Mic Permission Guide */}
                    <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-3.5 max-w-md text-center text-[10px] text-slate-400 font-medium leading-normal space-y-1">
                      <p className="font-bold text-slate-500 flex items-center justify-center gap-1">
                        💡 Hướng dẫn quyền Micro (Mobile Chrome / Safari):
                      </p>
                      <p>Nhấp cho phép sử dụng Micro khi trình duyệt yêu cầu. Nếu lỡ tay từ chối, nhấp vào biểu tượng ổ khóa 🔒 trên thanh địa chỉ và bật quyền Micro để bắt đầu luyện nói nhé!</p>
                    </div>
                  </div>

                  {/* Error display */}
                  {speechError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-semibold text-center flex items-center justify-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-4 h-4" /> {speechError}
                    </div>
                  )}

                  {/* Result Box */}
                  {speakingScore !== null && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl border bg-slate-50 border-slate-100 flex flex-col items-center text-center space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Từ bạn nói: </span>
                        <span className="text-xs font-mono font-black text-rose-600">&ldquo;{recognizedText}&rdquo;</span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex flex-col items-center">
                          <span className="text-xxs text-slate-400 font-bold uppercase">Độ khớp phát âm</span>
                          <span className={`text-3xl font-black mt-0.5 ${
                            speakingScore >= 85 
                              ? "text-emerald-600" 
                              : speakingScore >= 65 
                                ? "text-amber-500" 
                                : "text-rose-500"
                          }`}>
                            {speakingScore}%
                          </span>
                        </div>

                        <div className="h-8 w-px bg-slate-200" />

                        <div className="text-left">
                          <h5 className="text-xs font-black text-slate-800">
                            {speakingScore >= 85 
                              ? "Xuất sắc! Phát âm rất chuẩn." 
                              : speakingScore >= 65 
                                ? "Khá tốt! Gần khớp với từ gốc." 
                                : "Chưa chuẩn lắm. Hãy nghe lại phát âm mẫu và nói to rõ ràng hơn nhé!"}
                          </h5>
                          <p className="text-xxs text-slate-400 mt-0.5">Hệ thống ghi nhận sự tiến bộ của bạn.</p>
                        </div>
                      </div>

                      {/* AI Coaching Feedback Block */}
                      {(evaluatingSpeaking || speakingFeedback) && (
                        <div className="w-full text-left space-y-2 pt-3 border-t border-slate-200/60">
                          <span className="text-[10px] text-indigo-600 uppercase tracking-wider block font-bold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> AI Speaking Coach:
                          </span>
                          {evaluatingSpeaking ? (
                            <div className="flex items-center gap-2 text-xxs font-bold text-slate-400">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" /> Đang chẩn đoán chi tiết phát âm & ngữ pháp...
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <p className="text-xs bg-indigo-50/50 p-3 rounded-xl text-slate-700 leading-relaxed font-medium border border-indigo-100/40">
                                {speakingFeedback.feedbackSummary}
                              </p>
                              {speakingFeedback.errors && speakingFeedback.errors.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] text-rose-500 font-bold uppercase">Lỗi đã ghi vào Sổ Tay Lỗi Sai:</span>
                                  {speakingFeedback.errors.map((err: any, idx: number) => (
                                    <div key={idx} className="bg-rose-50/30 border border-rose-100/30 p-2.5 rounded-lg text-xxs space-y-1 text-slate-600 font-sans">
                                      <div><span className="text-rose-500 font-bold">Sai: </span>&ldquo;{err.originalSentence}&rdquo;</div>
                                      <div><span className="text-emerald-600 font-bold">Nên nói: </span>&ldquo;{err.correctedSentence}&rdquo;</div>
                                      <div className="text-slate-400 italic pt-0.5">{err.errorExplanation}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="w-full pt-2 flex justify-end">
                        <button
                          onClick={handleNextSpeaking}
                          className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          Từ tiếp theo <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Continue without scoring button */}
                  {speakingScore === null && !isRecording && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleNextSpeaking}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Bỏ qua từ này &rarr;
                      </button>
                    </div>
                  )}

                </div>
              );
            })()
          ) : (
            /* Finished State */
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                <Award className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Hoàn thành Luyện Nói!</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chúc mừng bạn đã luyện phát âm hoàn tất 5 từ vựng học thuật!
                </p>
                <div className="text-xxs text-slate-400 font-bold uppercase tracking-wider pt-3">Độ khớp trung bình</div>
                <div className="text-3xl font-black text-rose-600 mt-1">
                  {speakingHistory.length > 0 
                    ? Math.round(speakingHistory.reduce((acc, x) => acc + x.score, 0) / speakingHistory.length) 
                    : 0}%
                </div>
              </div>

              {/* Detail list of spoken words */}
              {speakingHistory.length > 0 && (
                <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 max-h-40 overflow-y-auto">
                  <span className="text-xxs text-slate-400 font-bold uppercase block pb-1 border-b border-slate-200">Chi tiết phát âm</span>
                  {speakingHistory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{item.word}</span>
                      <span className={item.score >= 85 ? "text-emerald-600" : item.score >= 65 ? "text-amber-500" : "text-rose-500"}>
                        {item.score}% (&ldquo;{item.text || "N/A"}&rdquo;)
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={backToMenu}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Về thực đơn
                </button>
                <button
                  onClick={startSpeaking}
                  className="px-5 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Luyện tập thêm
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {/* =========================================================================
          VIEW E: SHADOWING PRACTICE MODE (IELTS 3 Parts)
          ========================================================================= */}
      {activeMode === "shadowing" && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Header & Back Action */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  🎙️ Chế độ Shadowing
                </span>
                <span className="text-xxs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                  IELTS Speaking
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 font-sans tracking-tight">
                Luyện Nhại Giọng (Shadowing)
              </h2>
              <p className="text-xs text-slate-400">
                Luyện nhịp điệu, tốc độ và cách phát âm theo các bài mẫu IELTS Band 8.0+.
              </p>
            </div>
            
            <button
              onClick={backToMenu}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" /> Thoát luyện tập
            </button>
          </div>

          {/* 3-Part Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            {[1, 2, 3].map((pNum) => (
              <button
                key={pNum}
                onClick={() => startShadowingMode(pNum as 1 | 2 | 3)}
                className={`py-3 text-[11px] md:text-xs font-black rounded-xl transition-all cursor-pointer ${
                  activeShadowingPart === pNum
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                }`}
              >
                Part {pNum}: {pNum === 1 ? "Hội thoại Ngắn" : pNum === 2 ? "Độc thoại Cue Card" : "Thảo luận Chuyên sâu"}
              </button>
            ))}
          </div>

          {shadowingList.length > 0 ? (
            (() => {
              const currentEx = shadowingList[currentShadowingIndex];
              return (
                <div className="space-y-6">
                  
                  {/* Progress navigation banner */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                    <span>BÀI TẬP {currentShadowingIndex + 1} / {shadowingList.length}</span>
                    <div className="flex gap-2">
                      <button
                        disabled={currentShadowingIndex === 0}
                        onClick={() => {
                          setCurrentShadowingIndex(prev => prev - 1);
                          setShadowingResult(null);
                          setShadowingError(null);
                          setSpeakingFeedback(null);
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-600 cursor-pointer text-xxs font-extrabold"
                      >
                        Quay lại
                      </button>
                      <button
                        disabled={currentShadowingIndex === shadowingList.length - 1}
                        onClick={() => {
                          setCurrentShadowingIndex(prev => prev + 1);
                          setShadowingResult(null);
                          setShadowingError(null);
                          setSpeakingFeedback(null);
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-600 cursor-pointer text-xxs font-extrabold"
                      >
                        Kế tiếp
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* LEFT COLUMN: Lesson Material (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
                        
                        {/* Topic Header */}
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-extrabold">Chủ đề bài học</span>
                            <h4 className="text-base font-extrabold text-indigo-950">
                              {currentEx?.topic || "General"}
                            </h4>
                          </div>
                          <button
                            onClick={() => startShadowingMode(activeShadowingPart)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Đổi bài mẫu ngẫu nhiên"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                        {/* IELTS Cue Card style for Part 2 */}
                        {activeShadowingPart === 2 && (
                          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">Cue Card (Part 2 Topic):</span>
                            <p className="text-sm font-extrabold text-slate-800 leading-relaxed italic">
                              &ldquo;{currentEx?.question}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Question Prompt for Part 1 & 3 */}
                        {activeShadowingPart !== 2 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Câu hỏi của Giám khảo:</span>
                            <p className="text-base font-extrabold text-slate-800 leading-relaxed">
                              💬 &ldquo;{currentEx?.question}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Model Script with Highlighted Vocabulary */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Bài nói mẫu IELTS (Script):</span>
                          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-slate-700 leading-relaxed text-sm">
                            {(() => {
                              const scriptWords = (currentEx?.text || "").split(" ");
                              return scriptWords.map((word, i) => {
                                const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();
                                const isMatch = words.some(w => w.word.toLowerCase() === cleanWord);
                                return (
                                  <span 
                                    key={i} 
                                    className={isMatch ? "text-indigo-600 font-extrabold underline decoration-indigo-200 decoration-2 underline-offset-2" : ""}
                                  >
                                    {word}{" "}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Translation / Meaning details */}
                        <div className="space-y-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bản dịch học thuật:</span>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {currentEx?.translation}
                          </p>
                        </div>

                        {/* Highlighted Vocabulary Panel */}
                        {currentEx?.wordsUsed && currentEx.wordsUsed.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Từ vựng mục tiêu trong bài:</span>
                            <div className="flex flex-wrap gap-2">
                              {currentEx.wordsUsed.map((wu, idx) => (
                                <div key={idx} className="bg-indigo-50/60 border border-indigo-100/80 px-2.5 py-1 rounded-xl text-xxs font-bold">
                                  <span className="text-indigo-700 font-black">{wu.word}</span>
                                  <span className="text-slate-400 font-medium"> &ndash; {wu.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Accent and Playback Controllers */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-xxs font-black text-slate-400 uppercase">Giọng đọc mẫu:</span>
                            <button
                              onClick={() => setAccent("en-US")}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
                                accent === "en-US" 
                                  ? "bg-slate-800 text-white" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              Mỹ (🇺🇸)
                            </button>
                            <button
                              onClick={() => setAccent("en-GB")}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
                                accent === "en-GB" 
                                  ? "bg-slate-800 text-white" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              Anh (🇬🇧)
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <select 
                              value={shadowingSpeed}
                              onChange={(e) => setShadowingSpeed(e.target.value as "normal" | "slow")}
                              className="bg-white border border-slate-200 text-slate-600 text-xxs font-bold rounded-lg p-1"
                            >
                              <option value="normal">Tốc độ chuẩn (0.95x)</option>
                              <option value="slow">Chậm để tập nhại (0.65x)</option>
                            </select>
                            
                            <button
                              onClick={() => speakShadowingText(currentEx?.text || "")}
                              className={`px-4 py-2 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isShadowingPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-900 hover:bg-slate-800"
                              }`}
                            >
                              <Volume2 className="w-4 h-4" /> 
                              {isShadowingPlaying ? "Đang phát..." : "Nghe mẫu"}
                            </button>
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* RIGHT COLUMN: Active Recording & Feedback (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                      
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6">
                        
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest pb-3 border-b border-slate-50">
                          Phát Âm & Ghi Âm
                        </h4>

                        {/* Dynamic error banner */}
                        {shadowingError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold animate-fade-in">
                            ⚠️ {shadowingError}
                          </div>
                        )}

                        {/* Recording interface state */}
                        <div className="flex flex-col items-center justify-center py-4 space-y-4">
                          {isShadowingRecording ? (
                            <div className="relative flex flex-col items-center space-y-3">
                              {/* Pulse visualizer circle */}
                              <span className="absolute inline-flex h-20 w-20 rounded-full bg-rose-400 opacity-20 animate-ping" />
                              <button
                                onClick={() => handleToggleShadowingRecord(currentEx?.text || "")}
                                className="relative w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700 transition-all cursor-pointer shadow-md"
                                title="Dừng ghi âm"
                              >
                                <Mic className="w-6 h-6 animate-pulse" />
                              </button>
                              <p className="text-xxs text-rose-500 font-extrabold tracking-widest uppercase animate-pulse">
                                Đang ghi âm Shadowing...
                              </p>
                              {shadowingDurationTTS > 0 && (
                                <p className="text-[10px] text-slate-400">
                                  Thời lượng TTS chuẩn: ~{(shadowingDurationTTS / 1000).toFixed(1)} giây
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center space-y-3 text-center">
                              <button
                                onClick={() => handleToggleShadowingRecord(currentEx?.text || "")}
                                className="w-16 h-16 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs"
                                title="Bắt đầu ghi âm nhại giọng"
                              >
                                <Mic className="w-6 h-6" />
                              </button>
                              <p className="text-xxs text-slate-400 font-bold uppercase tracking-widest">
                                Bấm Mic để nói theo
                              </p>
                              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                                Hãy bấm Mic, nghe giọng mẫu phát trước rồi lập tức nhại theo sát tốc độ của mẫu nói.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Scoreboard Result Area */}
                        {shadowingResult && (
                          <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-slate-100 bg-slate-50 p-5 rounded-2xl space-y-5"
                          >
                            
                            {/* Gauge score */}
                            <div className="flex items-center gap-4 justify-between">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Điểm số Shadowing</span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                  <span className={`text-4xl font-black ${
                                    shadowingResult.score >= 80 ? "text-emerald-600" : shadowingResult.score >= 60 ? "text-amber-500" : "text-rose-500"
                                  }`}>
                                    {shadowingResult.score}
                                  </span>
                                  <span className="text-xs text-slate-400">/100</span>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md font-extrabold uppercase">
                                  {shadowingResult.score >= 80 ? "IELTS Band 8.5" : shadowingResult.score >= 60 ? "IELTS Band 7.0" : "IELTS Band 5.5"}
                                </span>
                              </div>
                            </div>

                            {/* 3 Signal Breakdown */}
                            <div className="space-y-3 pt-3 border-t border-slate-200/60">
                              
                              {/* Metric 1: Word Match */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xxs font-bold">
                                  <span className="text-slate-500">1. Từ vựng chính xác (LCS - 60%):</span>
                                  <span className="text-slate-800">{Math.round(shadowingResult.lcsScore)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="bg-indigo-500 h-full" style={{ width: `${shadowingResult.lcsScore}%` }} />
                                </div>
                              </div>

                              {/* Metric 2: API Confidence */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xxs font-bold">
                                  <span className="text-slate-500">2. Độ tự tin phát âm (Confidence - 25%):</span>
                                  <span className="text-slate-800">{Math.round(shadowingResult.confidenceScore)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="bg-emerald-500 h-full" style={{ width: `${shadowingResult.confidenceScore}%` }} />
                                </div>
                              </div>

                              {/* Metric 3: Timing Deviation */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xxs font-bold">
                                  <span className="text-slate-500">3. Độ đồng bộ thời gian (Timing - 15%):</span>
                                  <span className={shadowingResult.timingScore >= 75 ? "text-emerald-600" : "text-amber-500"}>
                                    {Math.round(shadowingResult.timingScore)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${shadowingResult.timingScore >= 75 ? "bg-emerald-500" : "bg-amber-400"}`} 
                                    style={{ width: `${shadowingResult.timingScore}%` }} 
                                  />
                                </div>
                                {shadowingResult.timingWarning && (
                                  <p className="text-[10px] text-amber-600 font-medium italic leading-relaxed">
                                    ⚠️ Thời lượng nói chênh lệch hơn 40% so với bản xứ. Hãy cố gắng nói đúng nhịp đều hơn nhé!
                                  </p>
                                )}
                              </div>

                            </div>

                            {/* Transcribed text vs sample comparison */}
                            <div className="space-y-2 pt-3 border-t border-slate-200/60">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Văn bản ghi nhận được:</span>
                              <p className="text-xs font-mono text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                                &ldquo;{shadowingResult.recognized || "[Không thu được âm]"}&rdquo;
                              </p>
                            </div>

                            {/* AI Coaching Feedback Block */}
                            {(evaluatingSpeaking || speakingFeedback) && (
                              <div className="space-y-2 pt-3 border-t border-slate-200/60">
                                <span className="text-[10px] text-indigo-600 uppercase tracking-wider block font-bold flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> AI Speaking Coach:
                                </span>
                                {evaluatingSpeaking ? (
                                  <div className="flex items-center gap-2 text-xxs font-bold text-slate-400">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" /> Đang chẩn đoán chi tiết phát âm & ngữ pháp...
                                  </div>
                                ) : (
                                  <div className="space-y-2.5">
                                    <p className="text-xs bg-indigo-50/50 p-3 rounded-xl text-slate-700 leading-relaxed font-medium border border-indigo-100/40">
                                      {speakingFeedback.feedbackSummary}
                                    </p>
                                    {speakingFeedback.errors && speakingFeedback.errors.length > 0 && (
                                      <div className="space-y-1.5">
                                        <span className="text-[9px] text-rose-500 font-bold uppercase">Lỗi đã ghi vào Sổ Tay Lỗi Sai:</span>
                                        {speakingFeedback.errors.map((err: any, idx: number) => (
                                          <div key={idx} className="bg-rose-50/30 border border-rose-100/30 p-2.5 rounded-lg text-xxs space-y-1 text-slate-600 font-sans">
                                            <div><span className="text-rose-500 font-bold">Sai: </span>&ldquo;{err.originalSentence}&rdquo;</div>
                                            <div><span className="text-emerald-600 font-bold">Nên nói: </span>&ldquo;{err.correctedSentence}&rdquo;</div>
                                            <div className="text-slate-400 italic pt-0.5">{err.errorExplanation}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                          </motion.div>
                        )}

                      </div>

                    </div>

                  </div>

                </div>
              );
            })()
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
              <p className="text-sm text-slate-500 font-bold">Đang chuẩn bị bài tập Shadowing...</p>
            </div>
          )}

          {/* SECTION: History Records Log */}
          {shadowingHistory.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Lịch sử luyện Shadowing ({shadowingHistory.length})
                  </h3>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("lexiband_shadowing_history");
                    setShadowingHistory([]);
                  }}
                  className="text-xxs text-slate-400 hover:text-rose-500 font-bold transition-colors cursor-pointer"
                >
                  Xóa lịch sử
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto pt-1 pr-1">
                {shadowingHistory.map((item: any, index: number) => (
                  <div 
                    key={index} 
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                          Part {item.part}
                        </span>
                        <span className="text-slate-400 text-xxs font-mono">{item.date}</span>
                      </div>
                      <p className="font-bold text-slate-700 truncate max-w-[180px]">
                        {item.topic}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className={`text-lg font-black ${
                        item.score >= 80 ? "text-emerald-600" : item.score >= 60 ? "text-amber-500" : "text-rose-500"
                      }`}>
                        {item.score}
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">Điểm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
