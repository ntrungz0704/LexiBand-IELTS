import React, { useState, useEffect } from "react";
import { BookOpen, Award, Volume2, ArrowRight, CheckCircle, XCircle, Sparkles, AlertCircle } from "lucide-react";
import { Word } from "../types";
import { DailyUnit, getCleanTopic, TOPIC_LABELS } from "../utils/curriculum";
import { speakText } from "../utils/speech";

interface CurriculumPlayerProps {
  unit: DailyUnit;
  wordsInUnit: Word[];
  allWords: Word[];
  onComplete: (score: number) => void;
  onCancel: () => void;
}

export default function CurriculumPlayer({ unit, wordsInUnit, allWords, onComplete, onCancel }: CurriculumPlayerProps) {
  // Lesson phase: "learn" | "quiz" | "complete"
  const [phase, setPhase] = useState<"learn" | "quiz" | "complete">("learn");
  
  // Learning phase states
  const [currentLearnIdx, setCurrentLearnIdx] = useState(0);
  const [accent, setAccent] = useState<"en-US" | "en-GB">("en-US");

  // Quiz phase states
  const [quizQuestions, setQuizQuestions] = useState<{
    word: Word;
    question: string;
    options: string[];
    correct: string;
    selected?: string;
    isCorrect?: boolean;
    type: "meaning" | "gapfill";
  }[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [score, setScore] = useState(0);

  // Text-to-speech helper
  const speak = (text: string) => {
    speakText(text, 0.85, accent);
  };

  // Speak word when current learn index changes
  useEffect(() => {
    if (phase === "learn" && wordsInUnit[currentLearnIdx]) {
      speak(wordsInUnit[currentLearnIdx].word);
    }
  }, [currentLearnIdx, phase, wordsInUnit]);

  // Generate quiz questions once learn phase is done
  const startQuizPhase = () => {
    const questions = wordsInUnit.map(word => {
      // 50% chance of gapfill vs 50% meaning
      const isGapFill = Math.random() > 0.5 && word.example && word.example.toLowerCase().includes(word.word.toLowerCase());
      
      if (isGapFill) {
        // Gap fill
        const blankedExample = word.example.replace(new RegExp(word.word, "gi"), "_______");
        // Distractors
        const distractors = allWords
          .filter(w => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.word);

        const options = [word.word, ...distractors].sort(() => 0.5 - Math.random());

        return {
          word,
          question: blankedExample,
          options,
          correct: word.word,
          type: "gapfill" as const
        };
      } else {
        // Meaning
        const distractors = allWords
          .filter(w => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.meaning);

        const options = [word.meaning, ...distractors].sort(() => 0.5 - Math.random());

        return {
          word,
          question: `Nghĩa của từ "${word.word}" là gì?`,
          options,
          correct: word.meaning,
          type: "meaning" as const
        };
      }
    });

    setQuizQuestions(questions);
    setCurrentQuizIdx(0);
    setScore(0);
    setPhase("quiz");
  };

  const handleSelectOption = (option: string) => {
    if (quizQuestions[currentQuizIdx].selected) return; // already answered

    const updated = [...quizQuestions];
    const q = updated[currentQuizIdx];
    q.selected = option;
    q.isCorrect = option === q.correct;
    
    if (q.isCorrect) {
      setScore(prev => prev + 1);
    }

    setQuizQuestions(updated);

    // Speak word on answer for reinforcement
    speak(q.word.word);
  };

  const handleNextQuiz = () => {
    if (currentQuizIdx < quizQuestions.length - 1) {
      setCurrentQuizIdx(prev => prev + 1);
    } else {
      setPhase("complete");
    }
  };

  const currentLearnWord = wordsInUnit[currentLearnIdx];
  const currentQuiz = quizQuestions[currentQuizIdx];

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-slate-100 rounded-3xl shadow-lg p-6 md:p-8 space-y-6 animate-fade-in font-sans">
      
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2.5 py-1 rounded-full uppercase bg-blue-50 text-blue-700 tracking-wide">
            {unit.type === "new_words" ? "Daily Unit" : unit.type === "review" ? "Weekly Review" : "Band Checkpoint"}
          </span>
          <span className="text-xxs font-bold text-slate-400">Day {unit.dayNumber}</span>
        </div>
        <button 
          onClick={onCancel}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Thoát học &larr;
        </button>
      </div>

      {/* 1. LEARN PHASE */}
      {phase === "learn" && currentLearnWord && (
        <div className="space-y-6">
          {/* Progress Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase">
              <span>Học Từ Mới</span>
              <span>{currentLearnIdx + 1} / {wordsInUnit.length}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${((currentLearnIdx + 1) / wordsInUnit.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Flashcard Body */}
          <div className="bg-slate-50/50 border border-slate-100/80 rounded-3xl p-6 md:p-8 text-center space-y-6 relative overflow-hidden">
            <div className="absolute right-4 top-4">
              <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200">
                <button
                  onClick={() => setAccent("en-US")}
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                    accent === "en-US" ? "bg-white text-blue-600 shadow-xs" : "text-slate-400"
                  }`}
                >
                  US
                </button>
                <button
                  onClick={() => setAccent("en-GB")}
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                    accent === "en-GB" ? "bg-white text-blue-600 shadow-xs" : "text-slate-400"
                  }`}
                >
                  UK
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* Show topic of word */}
              {(() => {
                const topic = getCleanTopic(currentLearnWord.topic || "");
                const labelInfo = TOPIC_LABELS[topic] || { emoji: "🧭", vi: "Tổng hợp", en: "General Academic" };
                return (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black tracking-wide border border-indigo-100/40">
                    <span className="text-xs">{labelInfo.emoji}</span>
                    <span className="uppercase">{labelInfo.vi}</span>
                  </div>
                );
              })()}
              
              <h3 className="text-4xl font-black text-slate-900 tracking-tight">{currentLearnWord.word}</h3>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-mono text-slate-400">{currentLearnWord.ipa}</span>
                <button 
                  onClick={() => speak(currentLearnWord.word)}
                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors cursor-pointer"
                  title="Phát âm"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-200/50 max-w-md mx-auto" />

            <div className="space-y-4 text-left max-w-lg mx-auto">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Định nghĩa & Nghĩa</span>
                <p className="text-sm font-bold text-slate-800 mt-1">{currentLearnWord.meaning}</p>
                <p className="text-xs text-slate-500 italic mt-0.5">{currentLearnWord.definition}</p>
              </div>

              {currentLearnWord.example && (
                <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-1 shadow-xxs">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider flex items-center gap-1">
                    <span>Ví dụ thực tế</span>
                    <button 
                      onClick={() => speak(currentLearnWord.example)}
                      className="text-indigo-400 hover:text-indigo-600 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </span>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">{currentLearnWord.example}</p>
                  <p className="text-xs text-slate-400 italic mt-0.5">{currentLearnWord.exampleTranslation}</p>
                </div>
              )}

              {currentLearnWord.collocations && currentLearnWord.collocations.length > 0 && (
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Cụm từ hay gặp (Collocations)</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {currentLearnWord.collocations.map((col, idx) => (
                      <span key={idx} className="text-xxs font-bold px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Learn Phase Controls */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setCurrentLearnIdx(prev => Math.max(0, prev - 1))}
              disabled={currentLearnIdx === 0}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
            >
              &larr; Từ trước
            </button>
            {currentLearnIdx < wordsInUnit.length - 1 ? (
              <button
                onClick={() => setCurrentLearnIdx(prev => prev + 1)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-98"
              >
                Từ tiếp theo <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={startQuizPhase}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-98 shadow-sm"
              >
                Vào rèn luyện ngay &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. QUIZ PHASE */}
      {phase === "quiz" && currentQuiz && (
        <div className="space-y-6">
          {/* Progress Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase">
              <span>Luyện tập củng cố</span>
              <span>{currentQuizIdx + 1} / {quizQuestions.length}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${((currentQuizIdx + 1) / quizQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question area */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-center space-y-4">
            <span className="text-xxs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
              {currentQuiz.type === "meaning" ? "Trắc nghiệm nghĩa từ" : "Điền từ vào câu ví dụ"}
            </span>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-relaxed px-2">
              {currentQuiz.question}
            </h3>
            {currentQuiz.type === "gapfill" && (
              <button
                onClick={() => speak(currentQuiz.word.example)}
                className="text-xxs text-slate-400 font-bold hover:text-slate-600 flex items-center gap-1 mx-auto cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Nghe ví dụ gợi ý
              </button>
            )}
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuiz.options.map((option, idx) => {
              const isSelected = currentQuiz.selected === option;
              const isCorrectOpt = option === currentQuiz.correct;
              const hasAnswered = !!currentQuiz.selected;

              let btnClass = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700";
              if (hasAnswered) {
                if (isCorrectOpt) {
                  btnClass = "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xxs";
                } else if (isSelected) {
                  btnClass = "border-red-500 bg-red-50 text-red-800";
                } else {
                  btnClass = "border-slate-100 bg-slate-50/50 text-slate-400 pointer-events-none";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-4 rounded-2xl border text-sm font-bold cursor-pointer transition-all flex items-center justify-between min-h-[56px] ${btnClass}`}
                >
                  <span>{option}</span>
                  {hasAnswered && isCorrectOpt && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                  {hasAnswered && isSelected && !isCorrectOpt && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Feedback & Next */}
          {currentQuiz.selected && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentQuiz.isCorrect ? (
                  <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Chính xác!
                  </span>
                ) : (
                  <span className="text-xs font-black text-red-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Chưa đúng rồi.
                  </span>
                )}
              </div>
              <button
                onClick={handleNextQuiz}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-98 shadow-sm"
              >
                {currentQuizIdx < quizQuestions.length - 1 ? "Câu tiếp theo" : "Xem kết quả"} &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. COMPLETE PHASE */}
      {phase === "complete" && (
        <div className="text-center space-y-6 py-6 animate-fade-in">
          <div className="inline-flex bg-emerald-50 text-emerald-600 p-5 rounded-full border border-emerald-100 animate-bounce">
            <Award className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tuyệt vời, bài học hoàn tất!</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Bạn đã hoàn thành trọn vẹn lộ trình học hôm nay và củng cố thành thạo từ vựng.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-w-xs mx-auto">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Độ chính xác rèn luyện</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">
              {Math.round((score / quizQuestions.length) * 100)}%
            </p>
            <p className="text-xxs text-slate-400 mt-0.5">({score} / {quizQuestions.length} câu đúng)</p>
          </div>

          <button
            onClick={() => onComplete(Math.round((score / quizQuestions.length) * 100))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-98 transition-all"
          >
            Lưu tiến độ & Về Dashboard
          </button>
        </div>
      )}

    </div>
  );
}
