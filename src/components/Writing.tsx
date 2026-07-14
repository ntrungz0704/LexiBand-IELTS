import React, { useState, useEffect, useMemo } from "react";
import { 
  PenTool, 
  Clock, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  RotateCcw, 
  ChevronRight, 
  FileText, 
  Info, 
  Layers, 
  BookOpen, 
  ThumbsUp, 
  Check, 
  AlertCircle,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  Plus,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Word } from "../types";
import { addMultipleErrors } from "../utils/errorBank";

interface WritingProps {
  words: Word[];
  progress: any;
  user: { uid: string; email: string } | null;
}

interface CriterionDetail {
  score: string;
  feedback: string;
  vocabularySuggestions?: Array<{
    original: string;
    suggested: string;
    explanation: string;
  }>;
}

interface WritingFeedback {
  bandRange: string;
  criteria: {
    taskResponse: CriterionDetail;
    coherenceCohesion: CriterionDetail;
    lexicalResource: CriterionDetail;
    grammaticalRange: CriterionDetail;
  };
  sentenceCorrections: Array<{
    originalSentence: string;
    correctedSentence: string;
    errorExplanation: string;
    category: string;
  }>;
  overallSummary: string;
  disclaimer: string;
}

interface ParaphraseResult {
  isMeaningPreserved: boolean;
  isSufficientlyChanged: boolean;
  score: number;
  feedback: string;
  suggestedVersion: string;
}

// Curated IELTS Writing Task 2 Prompts matching App's Themes
const CURATED_PROMPTS = [
  {
    id: "p1",
    topic: "Education",
    title: "Chức năng của Đại học",
    prompt: "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake, regardless of whether the course is useful to an employer. Discuss both views and give your opinion.",
    suggestedVocab: ["educational academic standard", "vocational training", "theoretical knowledge", "employability", "curriculum"]
  },
  {
    id: "p2",
    topic: "Environment",
    title: "Trách nhiệm giải quyết Biến đổi Khí hậu",
    prompt: "Some people think that environmental problems are too big for individual countries and individual people to address. In other words, only large governments and international organizations can solve these problems. To what extent do you agree or disagree?",
    suggestedVocab: ["sustainable development", "individual responsibility", "global coordination", "greenhouse gas emission", "remedy"]
  },
  {
    id: "p3",
    topic: "Technology",
    title: "Công nghệ và Phân hóa Giàu nghèo",
    prompt: "Some people believe that the range of technology available to individuals today is increasing the gap between rich people and poor people. Others think it is having the opposite effect. Discuss both views and give your opinion.",
    suggestedVocab: ["digital divide", "technological advance", "socio-economic inequality", "accessibility", "democratization of information"]
  },
  {
    id: "p4",
    topic: "Health",
    title: "Kiểm soát béo phì",
    prompt: "In some countries, an increasing number of people are becoming overweight. Some people think that the government should introduce laws to regulate the food industry to solve this problem. To what extent do you agree or disagree?",
    suggestedVocab: ["public health concern", "regulatory measure", "nutritional value", "sedentary lifestyle", "fiscal policy"]
  },
  {
    id: "p5",
    topic: "Economy",
    title: "Xu hướng di dân ra thành phố lớn",
    prompt: "In many countries, people are moving from rural areas to live in big cities. What are the causes of this trend, and what effects does it have on both rural and urban areas?",
    suggestedVocab: ["urbanization", "rural-urban migration", "employment opportunity", "overcrowding", "infrastructure strain"]
  },
  {
    id: "p6",
    topic: "Society",
    title: "Mất đi tính gắn kết cộng đồng",
    prompt: "Modern lifestyles mean that many people do not know their neighbors, and there is no longer a sense of community in local areas. What are the causes of this problem, and what measures can be taken to solve it?",
    suggestedVocab: ["alienation", "community cohesion", "rapid urbanization", "social networking", "civic engagement"]
  }
];

// Seeded sentences for Paraphrasing Trainer
const PARAPHRASE_SENTENCES = [
  {
    id: "s1",
    topic: "Environment",
    original: "Governments should restrict greenhouse gas emissions from factories to combat global warming.",
    hints: "Nên sử dụng: 'curtail', 'industrial emissions', 'mitigate climate change'."
  },
  {
    id: "s2",
    topic: "Education",
    original: "The main purpose of school is to prepare children for their future careers.",
    hints: "Nên sử dụng: 'primary objective', 'equip', 'professional path'."
  },
  {
    id: "s3",
    topic: "Technology",
    original: "Children are using smartphones and computers too much, which leads to weak social skills.",
    hints: "Nên sử dụng: 'excessive screen time', 'detrimental effect', 'interpersonal communication'."
  },
  {
    id: "s4",
    topic: "Health",
    original: "Eating fast food regularly causes obesity and severe heart disease.",
    hints: "Nên sử dụng: 'frequent consumption', 'junk food', 'cardiovascular issues'."
  },
  {
    id: "s5",
    topic: "Society",
    original: "Young people are increasingly influenced by Western culture, leading to the loss of traditional values.",
    hints: "Nên sử dụng: 'foreign customs', 'erosion', 'cultural heritage'."
  }
];

export default function Writing({ words, user }: WritingProps) {
  const [activeSubTab, setActiveSubTab] = useState<"task2" | "paraphrase">("task2");

  // Task 2 Practice States
  const [selectedPrompt, setSelectedPrompt] = useState(CURATED_PROMPTS[0]);
  const [essay, setEssay] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(2400); // 40 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmittingEssay, setIsSubmittingEssay] = useState(false);
  const [essayFeedback, setEssayFeedback] = useState<WritingFeedback | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [essayActiveTab, setEssayActiveTab] = useState<"TR" | "CC" | "LR" | "GRA" | "All">("All");
  const [essayError, setEssayError] = useState<string | null>(null);

  // Distraction-Free & Rich Editor Helpers
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mobileTab, setMobileTab] = useState<"essay" | "feedback">("essay");
  const [showPromptDrawer, setShowPromptDrawer] = useState(false);

  const handleFormatText = (formatType: "bold" | "italic" | "bullet" | "number" | "quote") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = essay.substring(start, end);
    let replacement = "";

    switch (formatType) {
      case "bold":
        replacement = `**${selectedText || "text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "text"}*`;
        break;
      case "bullet":
        replacement = `\n- ${selectedText || "list item"}`;
        break;
      case "number":
        replacement = `\n1. ${selectedText || "list item"}`;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "quote"}`;
        break;
    }

    const before = essay.substring(0, start);
    const after = essay.substring(end);
    setEssay(before + replacement + after);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + replacement.length, start + replacement.length);
      }
    }, 50);
  };

  const handleInsertText = (textToInsert: string) => {
    if (!textareaRef.current) {
      setEssay(prev => prev + (prev ? " " : "") + textToInsert);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = essay;
    const before = currentText.substring(0, start);
    const after = currentText.substring(end);
    const newText = before + (before.endsWith(" ") || before === "" ? "" : " ") + textToInsert + (after.startsWith(" ") || after === "" ? "" : " ") + after;
    setEssay(newText);
    
    // Reset focus and cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = start + textToInsert.length + (before.endsWith(" ") || before === "" ? 0 : 1);
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  };

  // Paraphrasing States
  const [currentParaIdx, setCurrentParaIdx] = useState(0);
  const [paraphraseInput, setParaphraseInput] = useState("");
  const [isSubmittingPara, setIsSubmittingPara] = useState(false);
  const [paraResult, setParaResult] = useState<ParaphraseResult | null>(null);
  const [paraError, setParaError] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    if (!essay.trim()) return 0;
    return essay.trim().split(/\s+/).filter(Boolean).length;
  }, [essay]);

  // Handle Timer ticking
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Format Timer output
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(2400);
  };

  // Submit Essay API call
  const handleSubmitEssay = async () => {
    if (wordCount < 10) {
      setEssayError("Vui lòng viết bài luận dài hơn (tối thiểu 10 từ) trước khi gửi chấm.");
      return;
    }
    setEssayError(null);
    setIsSubmittingEssay(true);
    setEssayFeedback(null);
    setSelectedCorrection(null);
    setIsTimerRunning(false);

    try {
      const response = await fetch("/api/writing/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay,
          prompt: selectedPrompt.prompt,
          topic: selectedPrompt.topic
        })
      });

      if (!response.ok) {
        throw new Error("Không thể chấm bài viết lúc này. Vui lòng thử lại.");
      }

      const data = await response.json();
      setEssayFeedback(data);

      // Save detected errors to the central Unified Error Bank
      if (user && data.sentenceCorrections && Array.isArray(data.sentenceCorrections) && data.sentenceCorrections.length > 0) {
        const errorLogs = data.sentenceCorrections.map((corr: any) => ({
          skill: "writing" as const,
          errorType: corr.error_type || "grammar_wrong",
          rootCause: corr.root_cause || "unknown",
          original: corr.originalSentence || "",
          corrected: corr.correctedSentence || "",
          explanation: corr.errorExplanation || "",
          context: `Prompt: ${selectedPrompt?.prompt || ""}`
        }));
        try {
          await addMultipleErrors(user.uid, errorLogs);
          console.log("Successfully logged writing errors to central bank:", errorLogs.length);
        } catch (err) {
          console.error("Error logging writing errors to central bank:", err);
        }
      }
    } catch (error: any) {
      setEssayError(error.message || "Đã xảy ra lỗi hệ thống.");
    } finally {
      setIsSubmittingEssay(false);
    }
  };

  // Submit Paraphrase API call
  const handleSubmitParaphrase = async () => {
    if (!paraphraseInput.trim()) {
      setParaError("Vui lòng viết câu viết lại của bạn.");
      return;
    }
    setParaError(null);
    setIsSubmittingPara(true);
    setParaResult(null);

    try {
      const response = await fetch("/api/writing/paraphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalSentence: PARAPHRASE_SENTENCES[currentParaIdx].original,
          userParaphrase: paraphraseInput
        })
      });

      if (!response.ok) {
        throw new Error("Không thể chấm câu viết lại lúc này. Vui lòng thử lại.");
      }

      const data = await response.json();
      setParaResult(data);
    } catch (error: any) {
      setParaError(error.message || "Đã xảy ra lỗi hệ thống.");
    } finally {
      setIsSubmittingPara(false);
    }
  };

  // Next Paraphrase Sentence
  const handleNextParaphrase = () => {
    setParaphraseInput("");
    setParaResult(null);
    setParaError(null);
    setCurrentParaIdx(prev => (prev + 1) % PARAPHRASE_SENTENCES.length);
  };

  // Inline Highlight essay generator helper
  const renderHighlightedEssay = () => {
    if (!essayFeedback || !essayFeedback.sentenceCorrections) return essay;

    let text = essay;
    // Sort corrections by sentence length descending to avoid replacing nested parts incorrectly
    const corrections = [...essayFeedback.sentenceCorrections].sort(
      (a, b) => b.originalSentence.length - a.originalSentence.length
    );

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Build unique non-overlapping segments
    const matches: Array<{ start: number; end: number; correction: any }> = [];

    corrections.forEach(corr => {
      const original = corr.originalSentence.trim();
      if (!original) return;

      let pos = text.indexOf(original);
      while (pos !== -1) {
        // Ensure this match does not overlap with existing matches
        const isOverlapping = matches.some(
          m => (pos >= m.start && pos < m.end) || (pos + original.length > m.start && pos + original.length <= m.end)
        );

        if (!isOverlapping) {
          matches.push({
            start: pos,
            end: pos + original.length,
            correction: corr
          });
        }
        pos = text.indexOf(original, pos + 1);
      }
    });

    // Sort matches by starting position
    matches.sort((a, b) => a.start - b.start);

    matches.forEach((match, idx) => {
      // Add unhighlighted text leading to match
      if (match.start > lastIndex) {
        elements.push(<span key={`text-${idx}`}>{text.substring(lastIndex, match.start)}</span>);
      }

      // Add highlighted interactive span
      const isSelected = selectedCorrection?.originalSentence === match.correction.originalSentence;
      const categoryColors = {
        Grammar: "bg-red-50 border-b-2 border-red-400 hover:bg-red-100/70",
        Vocabulary: "bg-amber-50 border-b-2 border-amber-400 hover:bg-amber-100/70",
        Punctuation: "bg-indigo-50 border-b-2 border-indigo-400 hover:bg-indigo-100/70",
        Style: "bg-blue-50 border-b-2 border-blue-400 hover:bg-blue-100/70"
      };
      const colorClass = categoryColors[match.correction.category as keyof typeof categoryColors] || "bg-yellow-50 border-b-2 border-yellow-400 hover:bg-yellow-100/70";

      elements.push(
        <span
          key={`highlight-${idx}`}
          id={`err-span-${idx}`}
          onClick={() => setSelectedCorrection(match.correction)}
          className={`cursor-pointer px-1 py-0.5 rounded transition-all inline duration-200 ${colorClass} ${
            isSelected ? "ring-2 ring-blue-500 bg-blue-100/40" : ""
          }`}
          title="Click to view correction"
        >
          {text.substring(match.start, match.end)}
        </span>
      );

      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      elements.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return elements.length > 0 ? elements : essay;
  };

  return (
    <div id="writing-container" className="space-y-6 w-full">
      {/* Tab Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <PenTool className="w-6 h-6 text-blue-600" />
            IELTS Academic Writing Mentor
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            Chấm chữa văn bản bằng mô hình AI Gemini chuẩn hóa tiêu chí IELTS thật
          </p>
        </div>

        {/* Mode Buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab("task2")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "task2"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Writing Task 2 Practice
          </button>
          <button
            onClick={() => setActiveSubTab("paraphrase")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "paraphrase"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Paraphrasing Trainer
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* VIEW 1: TASK 2 PRACTICE */}
        {activeSubTab === "task2" && (
          <div className="space-y-4">
            {/* Mobile Tab Switcher when feedback is active */}
            {essayFeedback && (
              <div className="flex border border-slate-200 dark:border-slate-800 md:hidden bg-slate-50 dark:bg-slate-900 p-1 rounded-xl shadow-xxs">
                <button 
                  onClick={() => setMobileTab("essay")}
                  className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                    mobileTab === "essay" 
                      ? "bg-white dark:bg-slate-950 text-blue-600 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-800" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Bài Viết Chữa Lỗi
                </button>
                <button 
                  onClick={() => setMobileTab("feedback")}
                  className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                    mobileTab === "feedback" 
                      ? "bg-white dark:bg-slate-950 text-blue-600 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-800" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Báo Cáo Band Score
                </button>
              </div>
            )}

            <motion.div
              key="task2-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
            >
            {/* LEFT AREA: SELECTOR & EDITOR */}
            <div className={`${isDistractionFree ? "xl:col-span-12 max-w-4xl mx-auto w-full" : "xl:col-span-8"} ${essayFeedback && mobileTab !== "essay" ? "hidden md:block" : "block"} space-y-6 transition-all duration-300`}>
              {/* Prompt selection bar */}
              {!essayFeedback && !isDistractionFree && (
                <div className="hidden md:block bg-white rounded-3xl border border-slate-100 p-5 shadow-xxs space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      Bước 1: Chọn đề bài luận mẫu (IELTS Task 2)
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md">
                      {CURATED_PROMPTS.length} Đề thi chọn lọc
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {CURATED_PROMPTS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPrompt(p);
                          setEssay("");
                          setEssayFeedback(null);
                        }}
                        className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer ${
                          selectedPrompt.id === p.id
                            ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/10 text-blue-900"
                            : "bg-slate-50/50 border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            p.topic === "Education" ? "bg-purple-100 text-purple-700" :
                            p.topic === "Environment" ? "bg-emerald-100 text-emerald-700" :
                            p.topic === "Technology" ? "bg-indigo-100 text-indigo-700" :
                            p.topic === "Health" ? "bg-rose-100 text-rose-700" :
                            p.topic === "Economy" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                          }`}>
                            {p.topic}
                          </span>
                        </div>
                        <p className="text-xs font-black mt-2 line-clamp-1">{p.title}</p>
                      </button>
                    ))}
                  </div>

                  {/* Active Prompt Box */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-2">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Đề bài chi tiết:</p>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed mt-1">{selectedPrompt.prompt}</p>
                    
                    {/* Vocabulary Checklist Trigger */}
                    <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gợi ý từ vựng nâng band:</span>
                      {selectedPrompt.suggestedVocab.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => handleInsertText(v)}
                          title="Click để chèn nhanh từ vựng này vào bài viết tại con trỏ"
                          className="text-[10px] font-bold bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-200 px-2.5 py-1 rounded-full shadow-xxs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <span>{v}</span>
                          <Plus className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col min-h-[550px] transition-all duration-300">
                {/* Mobile Compact Prompt Card */}
                <div className="md:hidden bg-slate-50 p-4 border-b border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-blue-600">Đề bài: {selectedPrompt.title}</span>
                    <button
                      onClick={() => setShowPromptDrawer(true)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                    >
                      Đổi đề bài & Gợi ý
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed line-clamp-2 italic">
                    "{selectedPrompt.prompt}"
                  </p>
                </div>
                {/* Editor Top Navigation Block */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100/60 text-blue-600 rounded-xl">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        {selectedPrompt.title}
                        {isDistractionFree && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Focus Mode</span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bài luận tối thiểu 250 từ</p>
                    </div>
                  </div>

                  {/* Editor Configuration & Mode controls */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Distraction Free Switcher */}
                    <button
                      onClick={() => setIsDistractionFree(!isDistractionFree)}
                      title={isDistractionFree ? "Hiện các cột điều khiển bên cạnh" : "Ẩn các cột xung quanh để tập trung viết bài"}
                      className={`px-3 py-1.5 rounded-xl text-xxs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                        isDistractionFree 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {isDistractionFree ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          Thu nhỏ
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          Tập trung (Notion Mode)
                        </>
                      )}
                    </button>

                    {/* Timer Controls & Toggle */}
                    <button
                      onClick={() => {
                        setTimerEnabled(!timerEnabled);
                        if (!timerEnabled) {
                          setTimeLeft(2400);
                          setIsTimerRunning(false);
                        } else {
                          setIsTimerRunning(false);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xxs font-black transition-all border cursor-pointer ${
                        timerEnabled 
                          ? "bg-slate-200 text-slate-800 border-slate-300" 
                          : "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/50"
                      }`}
                    >
                      {timerEnabled ? "Tắt đếm giờ" : "Hẹn giờ thi (40p)"}
                    </button>

                    {timerEnabled && (
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-xxs">
                        <Clock className={`w-3.5 h-3.5 ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-slate-400"}`} />
                        <span className={`text-xs font-mono font-black ${timeLeft < 300 ? "text-red-600" : "text-slate-700"}`}>
                          {formatTime(timeLeft)}
                        </span>
                        <div className="flex items-center gap-1.5 ml-1 pl-1 border-l border-slate-200 text-[10px]">
                          {isTimerRunning ? (
                            <button onClick={handlePauseTimer} className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer">Dừng</button>
                          ) : (
                            <button onClick={handleStartTimer} className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer">Bắt đầu</button>
                          )}
                          <button onClick={handleResetTimer} className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer">Xóa</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notion Sticky Editing Toolbar (Format controls + Quick insert shortcuts) */}
                {!essayFeedback && (
                  <div className="sticky md:top-0 bottom-0 z-10 bg-slate-55/95 dark:bg-slate-950/95 backdrop-blur-md px-5 py-2.5 border-t md:border-t-0 md:border-b border-slate-150 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xxs">
                    {/* Left: Text formats */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/60 shadow-xxs">
                      <button
                        onClick={() => handleFormatText("bold")}
                        title="Định dạng In đậm (Bold)"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFormatText("italic")}
                        title="Định dạng In nghiêng (Italic)"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-px h-4 bg-slate-200 mx-1" />
                      <button
                        onClick={() => handleFormatText("bullet")}
                        title="Thêm danh sách dấu chấm"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFormatText("number")}
                        title="Thêm danh sách số thứ tự"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFormatText("quote")}
                        title="Chèn trích dẫn blockquote"
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle: Click-to-insert suggested vocab chips inside the sticky bar for distraction-free comfort */}
                    {isDistractionFree && (
                      <div className="hidden md:flex items-center gap-1.5 max-w-sm overflow-x-auto py-0.5 shrink-0 scrollbar-none">
                        <span className="text-[9px] font-black uppercase text-slate-400 mr-1 shrink-0">Chèn nhanh:</span>
                        {selectedPrompt.suggestedVocab.map((v, i) => (
                          <button
                            key={i}
                            onClick={() => handleInsertText(v)}
                            className="text-[9px] font-bold bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-700 px-2 py-0.5 rounded-full transition-all cursor-pointer shrink-0"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Right: Copy & Delete actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(essay);
                          alert("Đã sao chép toàn bộ bài viết vào bộ nhớ đệm!");
                        }}
                        title="Sao chép toàn bộ bài viết"
                        className="px-2.5 py-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 text-xxs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 border border-slate-200 bg-white shadow-xxs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Sao chép
                      </button>
                      <button
                        onClick={() => {
                          if (essay && confirm("Bạn có chắc chắn muốn xóa toàn bộ nội dung bài luận đang viết?")) {
                            setEssay("");
                          }
                        }}
                        disabled={!essay}
                        title="Xóa trắng bài viết để bắt đầu lại"
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl cursor-pointer border border-slate-200 bg-white shadow-xxs transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Main input layout (Toggle between interactive markup vs plain textarea) */}
                {essayFeedback ? (
                  <div className="space-y-4 p-6 flex-1 bg-slate-50/40">
                    <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 p-3.5 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs text-blue-800 font-bold">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        Bài luận của bạn đã được Gemini chữa lỗi trực tiếp. Click vào các câu tô màu để xem giải thích chi tiết.
                      </div>
                      <button 
                        onClick={() => {
                          setEssayFeedback(null);
                          setSelectedCorrection(null);
                        }}
                        className="text-xs font-black text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Viết tiếp / Thử lại
                      </button>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-200/60 text-sm text-slate-800 font-sans leading-relaxed whitespace-pre-wrap min-h-[350px] shadow-sm">
                      {renderHighlightedEssay()}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col p-0 relative bg-white">
                    {/* Notion-style Document Header area */}
                    <div className="px-8 pt-8 pb-2 space-y-4">
                      {isDistractionFree && (
                        <div className="space-y-2 pb-4 border-b border-slate-100">
                          <span className="text-[10px] font-black uppercase text-slate-400">Đang luyện tập đề bài:</span>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed italic bg-slate-50 p-3.5 rounded-2xl border border-slate-200/50">
                            "{selectedPrompt.prompt}"
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Bấm để chèn nhanh từ vựng gợi ý:</span>
                            {selectedPrompt.suggestedVocab.map((v, i) => (
                              <button
                                key={i}
                                onClick={() => handleInsertText(v)}
                                className="text-[10px] font-bold bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 px-2.5 py-0.5 rounded-full transition-all cursor-pointer"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notion-style Text Area Sheet */}
                    <textarea
                      ref={textareaRef}
                      value={essay}
                      onChange={(e) => {
                        setEssay(e.target.value);
                        if (timerEnabled && !isTimerRunning && e.target.value.length === 1) {
                          setIsTimerRunning(true);
                        }
                      }}
                      placeholder="Hãy gõ nội dung bài luận của bạn tại đây..."
                      className="flex-1 w-full min-h-[350px] px-8 py-4 focus:outline-none text-slate-800 text-sm font-sans leading-relaxed resize-none bg-white dark:bg-slate-900 placeholder-slate-350"
                    />

                    {/* Floating Word Counter for Mobile */}
                    <div className="md:hidden absolute bottom-24 right-4 z-20 bg-slate-950/80 backdrop-blur-md border border-slate-800 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                      <span className={wordCount >= 250 ? "text-emerald-400" : "text-amber-400"}>{wordCount}</span>
                      <span className="text-slate-400">/ 250 w</span>
                    </div>

                    {/* Footer Status Panel */}
                    <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-auto">
                      {/* Word count progress bar */}
                      <div className="flex-1 max-w-md space-y-1">
                        <div className="flex items-center justify-between text-xxs font-bold">
                          <span className={`${wordCount >= 250 ? "text-emerald-600" : "text-amber-500"}`}>
                            {wordCount} / 250 từ {wordCount >= 250 && "🎉 Đã đạt mục tiêu!"}
                          </span>
                          <span className="text-slate-400">Yêu cầu tối thiểu: 250 từ</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden border border-slate-200/20">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              wordCount >= 250 ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                            style={{ width: `${Math.min((wordCount / 250) * 100, 100)}%` }}
                          />
                        </div>
                        {wordCount < 250 && wordCount > 0 && (
                          <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 mt-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Cảnh báo: Viết dưới 250 từ sẽ bị trừ điểm tiêu chí Task Response!
                          </p>
                        )}
                        {essayError && (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-xxs font-black flex items-center gap-2 mt-2 animate-fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{essayError}</span>
                          </div>
                        )}
                      </div>

                      {/* Action trigger button */}
                      <button
                        onClick={handleSubmitEssay}
                        disabled={isSubmittingEssay || wordCount < 10}
                        className={`px-6 py-3.5 rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          wordCount >= 250 
                            ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-101 active:scale-99" 
                            : "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200 cursor-not-allowed"
                        }`}
                      >
                        {isSubmittingEssay ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-500 border-t-transparent" />
                            Gemini đang chấm điểm...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                            Chấm & Sửa bài luận (Free)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTIVE CLICK CORRECTION EXPLANATION PANEL */}
              {selectedCorrection && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-blue-100 p-5 shadow-sm space-y-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        selectedCorrection.category === "Grammar" ? "bg-red-50 text-red-600 border border-red-100" :
                        selectedCorrection.category === "Vocabulary" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                        selectedCorrection.category === "Punctuation" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                        "bg-blue-50 text-blue-600 border border-blue-100"
                      }`}>
                        Lỗi {selectedCorrection.category}
                      </span>
                      <h4 className="text-xs font-black text-slate-800">Chi tiết lỗi câu</h4>
                    </div>
                    <button 
                      onClick={() => setSelectedCorrection(null)}
                      className="text-xs font-black text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Đóng x
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Câu gốc của bạn:</p>
                      <p className="text-xs font-bold text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-100/40 leading-relaxed">
                        {selectedCorrection.originalSentence}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Đề xuất sửa lại:</p>
                      <p className="text-xs font-bold text-emerald-700 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/40 leading-relaxed">
                        {selectedCorrection.correctedSentence}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-700">Giải thích chi tiết: </span>
                    {selectedCorrection.errorExplanation}
                  </div>
                </motion.div>
              )}
            </div>

            <div className={`xl:col-span-4 ${essayFeedback && mobileTab !== "feedback" ? "hidden md:block" : "block"} space-y-6`}>
              {essayFeedback ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xxs space-y-5">
                  <div className="text-center pb-4 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đánh Giá Band Ước Tính</p>
                    <h3 className="text-4xl font-black text-blue-600 mt-2">{essayFeedback.bandRange}</h3>
                    <p className="text-[11px] text-slate-500 mt-1.5">Mô phỏng tiêu chí đánh giá IELTS Academic chuẩn</p>
                  </div>

                  {/* Summary Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Điểm thành phần theo 4 tiêu chí:</h4>

                    {/* TR */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">Task Response (TR)</span>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          Band {essayFeedback.criteria.taskResponse.score}
                        </span>
                      </div>
                      <p className="text-xxs text-slate-500 leading-relaxed">{essayFeedback.criteria.taskResponse.feedback}</p>
                    </div>

                    {/* CC */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">Coherence & Cohesion (CC)</span>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          Band {essayFeedback.criteria.coherenceCohesion.score}
                        </span>
                      </div>
                      <p className="text-xxs text-slate-500 leading-relaxed">{essayFeedback.criteria.coherenceCohesion.feedback}</p>
                    </div>

                    {/* LR */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">Lexical Resource (LR)</span>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          Band {essayFeedback.criteria.lexicalResource.score}
                        </span>
                      </div>
                      <p className="text-xxs text-slate-500 leading-relaxed">{essayFeedback.criteria.lexicalResource.feedback}</p>
                      
                      {/* Synonym Upgrade suggestions list */}
                      {essayFeedback.criteria.lexicalResource.vocabularySuggestions && 
                       essayFeedback.criteria.lexicalResource.vocabularySuggestions.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                          <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Đề xuất nâng cấp từ vựng (AWL/ACL):</p>
                          <div className="space-y-1">
                            {essayFeedback.criteria.lexicalResource.vocabularySuggestions.map((s, i) => (
                              <div key={i} className="bg-white p-2 rounded-xl border border-slate-200/50 text-xxs leading-relaxed">
                                <span className="text-red-500 line-through font-bold">{s.original}</span>
                                <ChevronRight className="w-3 h-3 inline mx-1 text-slate-400" />
                                <span className="text-emerald-600 font-black">{s.suggested}</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">{s.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GRA */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">Grammatical Range (GRA)</span>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          Band {essayFeedback.criteria.grammaticalRange.score}
                        </span>
                      </div>
                      <p className="text-xxs text-slate-500 leading-relaxed">{essayFeedback.criteria.grammaticalRange.feedback}</p>
                    </div>
                  </div>

                  {/* Action Summary Card */}
                  <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 text-xxs text-slate-600 space-y-1">
                    <p className="font-black text-indigo-950 flex items-center gap-1.5 mb-1 text-xs">
                      <Info className="w-4 h-4 text-indigo-600" /> Actionable Summary
                    </p>
                    <p className="leading-relaxed text-indigo-900">{essayFeedback.overallSummary}</p>
                  </div>

                  {/* Disclaimer block */}
                  <p className="text-[9px] text-slate-400 leading-relaxed text-center italic mt-2">
                    {essayFeedback.disclaimer}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xxs space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    Hướng dẫn viết bài đạt điểm cao
                  </h4>
                  <ul className="text-xs text-slate-500 space-y-2.5 leading-relaxed">
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-500 font-bold">1.</span>
                      <span><strong>Bố cục 4 đoạn:</strong> Introduction, Body 1 (luận điểm 1), Body 2 (luận điểm 2), Conclusion.</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-500 font-bold">2.</span>
                      <span><strong>Dùng từ nối (CC):</strong> Đảm bảo sử dụng từ nối một cách linh hoạt như <em>"Furthermore"</em>, <em>"Consequently"</em>, <em>"On the other hand"</em>.</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-500 font-bold">3.</span>
                      <span><strong>Học thuật hóa từ vựng (LR):</strong> Tránh lặp lại các từ cơ bản (như <em>"bad", "good", "helpful"</em>) nhiều lần. Thay vào đó dùng các từ gợi ý học thuật (AWL).</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-blue-500 font-bold">4.</span>
                      <span><strong>Kiểm soát thời gian:</strong> Khuyến khích bật đồng hồ 40 phút và luyện tập viết không tra từ điển để quen với áp lực phòng thi thật.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
          </div>
        )}

        {/* VIEW 2: PARAPHRASING TRAINER */}
        {activeSubTab === "paraphrase" && (
          <motion.div
            key="paraphrase-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Main Trainer Panel */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xxs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Paraphrasing Mini-Trainer</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kỹ năng viết lại câu - Cực tốt cho tiêu chí Lexical Resource & Grammar</p>
                  </div>
                </div>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                  Câu {currentParaIdx + 1} / {PARAPHRASE_SENTENCES.length}
                </span>
              </div>

              {/* Source Sentence Box */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Câu mẫu gốc (IELTS Academic):</span>
                  <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase">
                    {PARAPHRASE_SENTENCES[currentParaIdx].topic}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800 leading-relaxed italic">
                  "{PARAPHRASE_SENTENCES[currentParaIdx].original}"
                </p>
                <div className="text-xxs text-slate-500 pt-2 border-t border-slate-200/50">
                  <strong className="text-slate-600">Gợi ý cách viết:</strong> {PARAPHRASE_SENTENCES[currentParaIdx].hints}
                </div>
              </div>

              {/* Input section */}
              {!paraResult && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">Viết lại câu trên bằng cấu trúc/từ vựng khác nhưng giữ nguyên nghĩa:</label>
                    <textarea
                      value={paraphraseInput}
                      onChange={(e) => setParaphraseInput(e.target.value)}
                      placeholder="Nhập câu viết lại của bạn vào đây..."
                      className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-slate-50/20 text-slate-800 shadow-inner resize-y"
                    />
                  </div>

                  {paraError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xxs font-black flex items-center gap-2 animate-fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{paraError}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleNextParaphrase}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      Bỏ qua / Câu tiếp theo
                    </button>
                    <button
                      onClick={handleSubmitParaphrase}
                      disabled={isSubmittingPara || !paraphraseInput.trim()}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                        paraphraseInput.trim()
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      {isSubmittingPara ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-500 border-t-transparent" />
                          Đang chấm câu...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Gửi AI kiểm tra
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* RESULTS WORKSPACE */}
              {paraResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5 pt-3 border-t border-slate-100"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Score card */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl text-center space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Đánh giá Paraphrase</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-4xl font-black ${
                          paraResult.score >= 8 ? "text-emerald-600" :
                          paraResult.score >= 5 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {paraResult.score}
                        </span>
                        <span className="text-slate-400 text-xs font-bold">/10</span>
                      </div>
                      <p className="text-xxs text-slate-500">Mức độ hiệu quả học thuật</p>
                    </div>

                    {/* Verifications Checklist badges */}
                    <div className="md:col-span-2 space-y-2.5">
                      {/* Badge 1 */}
                      <div className="flex items-center gap-2">
                        {paraResult.isMeaningPreserved ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-700">
                          {paraResult.isMeaningPreserved 
                            ? "✓ Bảo toàn ngữ nghĩa hoàn hảo (Không lệch nghĩa)" 
                            : "✗ Lệch ngữ nghĩa so với câu gốc"}
                        </span>
                      </div>

                      {/* Badge 2 */}
                      <div className="flex items-center gap-2">
                        {paraResult.isSufficientlyChanged ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-700">
                          {paraResult.isSufficientlyChanged 
                            ? "✓ Thay đổi từ vựng & cấu trúc tốt (Đạt tiêu chuẩn paraphrase)" 
                            : "⚠ Chưa thay đổi đủ nhiều (Thay đổi quá ít hoặc chỉ thay đổi 1-2 từ)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Critique box */}
                  <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold text-blue-900 block mb-1">AI Feedback & Chữa chi tiết:</span>
                    {paraResult.feedback}
                  </div>

                  {/* Model alternative sentence */}
                  <div className="bg-emerald-50/40 border border-emerald-100/40 p-4 rounded-2xl text-xs space-y-1.5">
                    <div className="flex items-center gap-1 text-emerald-800 font-bold">
                      <ThumbsUp className="w-4 h-4 text-emerald-600" />
                      Mẫu câu viết lại hoàn hảo từ Giám khảo (Band 8.0+):
                    </div>
                    <p className="text-slate-800 font-black italic">
                      "{paraResult.suggestedVersion}"
                    </p>
                  </div>

                  {/* Next / Retry controls */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setParaResult(null);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Thử viết lại
                    </button>
                    <button
                      onClick={handleNextParaphrase}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      Câu tiếp theo <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Prompt Selector Drawer Modal */}
      <AnimatePresence>
        {showPromptDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end justify-center md:hidden"
            onClick={() => setShowPromptDrawer(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-slate-950 w-full max-h-[85vh] rounded-t-3xl p-6 overflow-y-auto space-y-6"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4.5 h-4.5 text-blue-600" />
                  Chọn đề thi & Gợi ý từ vựng
                </h3>
                <button 
                  onClick={() => setShowPromptDrawer(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Curated Prompts */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">1. Chọn đề bài luận</span>
                <div className="grid grid-cols-1 gap-2">
                  {CURATED_PROMPTS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPrompt(p);
                        setEssay("");
                        setEssayFeedback(null);
                        setShowPromptDrawer(false);
                      }}
                      className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer ${
                        selectedPrompt.id === p.id
                          ? "bg-blue-50/70 border-blue-400 dark:bg-blue-950/40 dark:border-blue-800 text-blue-900 dark:text-blue-100"
                          : "bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-350"
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase text-blue-600 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 rounded border border-blue-100 dark:border-blue-900/50 mr-2">{p.topic}</span>
                      <span className="text-xs font-bold">{p.title}</span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed line-clamp-2 italic">"{p.prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">2. Gợi ý từ vựng nên dùng</span>
                  <p className="text-[10px] text-slate-405 mt-0.5">Click để chèn nhanh từ vựng vào bài viết tại con trỏ:</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPrompt.suggestedVocab.map((v: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        handleInsertText(v);
                        setShowPromptDrawer(false);
                      }}
                      className="text-xs font-bold bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 border border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-650 dark:text-slate-350 px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{v}</span>
                      <Plus className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
