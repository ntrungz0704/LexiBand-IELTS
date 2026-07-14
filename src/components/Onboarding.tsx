import React, { useState, useMemo, useEffect } from "react";
import { BookOpen, Award, Compass, Sparkles, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, HelpCircle, Volume2 } from "lucide-react";
import { Word } from "../types";
import { generatePlacementTest, calculateStartingBand, generateLearningPlan, TestQuestion, LearningPlan, MainTopic, TOPIC_LABELS } from "../utils/curriculum";
import { speakWord } from "./Library";

interface OnboardingProps {
  words: Word[];
  onComplete: (plan: LearningPlan) => void;
  userEmail: string;
}

export default function Onboarding({ words, onComplete, userEmail }: OnboardingProps) {
  const [step, setStep] = useState<"welcome" | "test_intro" | "testing" | "test_result" | "setup_plan">("welcome");
  
  // Placement Test State
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  
  // User Configuration State
  const [startBand, setStartBand] = useState<"0.0-4.0" | "4.5-5.5" | "6.0-6.5">("0.0-4.0");
  const [targetBand, setTargetBand] = useState<"0.0-4.0" | "4.5-5.5" | "6.0-6.5">("6.0-6.5");
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [selectedTopics, setSelectedTopics] = useState<MainTopic[]>([]);

  // Initialize test
  const startTest = () => {
    const q = generatePlacementTest(words);
    setTestQuestions(q);
    setCurrentQuestionIdx(0);
    setAnswers({});
    setStep("testing");
  };

  // Auto-play audio on question load for enhanced pronunciation learning
  useEffect(() => {
    if (step === "testing" && testQuestions[currentQuestionIdx]) {
      const timer = setTimeout(() => {
        speakWord(testQuestions[currentQuestionIdx].word, 0.85, "en-US");
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentQuestionIdx, step, testQuestions]);

  const handleSkipTest = () => {
    setStartBand("0.0-4.0");
    setStep("setup_plan");
  };

  const handleAnswerSelect = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestionIdx]: option }));
    
    // Auto advance after 300ms for a snappy fluid feel
    setTimeout(() => {
      if (currentQuestionIdx < testQuestions.length - 1) {
        setCurrentQuestionIdx(prev => prev + 1);
      } else {
        // Test completed
        setStep("test_result");
      }
    }, 300);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const startingBandCalculated = useMemo(() => {
    if (testQuestions.length === 0) return "0.0-4.0";
    return calculateStartingBand(answers, testQuestions);
  }, [answers, testQuestions]);

  const testStats = useMemo(() => {
    let fndCorrect = 0;
    let intCorrect = 0;
    let advCorrect = 0;

    let fndTotal = 0;
    let intTotal = 0;
    let advTotal = 0;

    testQuestions.forEach((q, idx) => {
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

    return {
      fndCorrect,
      fndTotal,
      fndPercent: fndTotal > 0 ? Math.round((fndCorrect / fndTotal) * 100) : 0,
      fndPassed: fndTotal > 0 ? (fndCorrect / fndTotal) >= 0.8 : false,
      intCorrect,
      intTotal,
      intPercent: intTotal > 0 ? Math.round((intCorrect / intTotal) * 100) : 0,
      intPassed: intTotal > 0 ? (intCorrect / intTotal) >= 0.8 : false,
      advCorrect,
      advTotal,
      advPercent: advTotal > 0 ? Math.round((advCorrect / advTotal) * 100) : 0,
      advPassed: advTotal > 0 ? (advCorrect / advTotal) >= 0.8 : false,
    };
  }, [answers, testQuestions]);

  const handleConfirmTestResult = () => {
    setStartBand(startingBandCalculated);
    setStep("setup_plan");
  };

  // Live calculation of study pacing
  const planPreview = useMemo(() => {
    const bandOrder = { "0.0-4.0": 0, "4.5-5.5": 1, "6.0-6.5": 2 };
    
    // Count words in target range
    const count = words.filter(w => {
      const wIdx = bandOrder[w.band];
      return wIdx >= bandOrder[startBand] && wIdx <= bandOrder[targetBand];
    }).length;

    const totalDays = durationMonths * 30;
    const weeks = Math.floor(totalDays / 7);
    
    let checkpointCount = 0;
    if (bandOrder[startBand] <= 0 && bandOrder[targetBand] >= 0) checkpointCount++;
    if (bandOrder[startBand] <= 1 && bandOrder[targetBand] >= 1) checkpointCount++;
    if (bandOrder[startBand] <= 2 && bandOrder[targetBand] >= 2) checkpointCount++;

    const studyDaysCount = Math.max(1, totalDays - weeks - checkpointCount);
    const wordsPerDay = Math.max(5, Math.ceil(count / studyDaysCount));
    const estimatedMinutesPerDay = Math.round(wordsPerDay * 1.5 + 10); // 1.5 mins per new word, plus 10 mins review time

    return {
      wordCount: count,
      wordsPerDay,
      estimatedMinutesPerDay,
      isHeavy: wordsPerDay > 25
    };
  }, [startBand, targetBand, durationMonths, words]);

  const handleGeneratePlan = () => {
    const plan = generateLearningPlan(startBand, targetBand, durationMonths, words, selectedTopics);
    onComplete(plan);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[80vh] font-sans">
      
      {/* STEP 1: WELCOME SCREEN */}
      {step === "welcome" && (
        <div className="w-full text-center space-y-8 animate-fade-in">
          <div className="inline-flex bg-gradient-to-tr from-blue-600 to-indigo-600 p-5 rounded-3xl text-white shadow-xl mb-2">
            <BookOpen className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Chào mừng bạn đến với <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">LexiBand</span>
            </h1>
            <p className="text-slate-500 text-base max-w-lg mx-auto leading-relaxed">
              Hệ thống tự động thiết lập lộ trình học từ vựng IELTS cá nhân hóa theo trình độ hiện tại và thời gian cam kết của bạn.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl max-w-md mx-auto text-left flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-slate-800">Tài khoản học tập</p>
              <p className="text-xs text-slate-500 mt-0.5">Lộ trình và kết quả luyện tập sẽ được cá nhân hóa và gửi cập nhật định kỳ cho email <span className="font-semibold text-slate-700">{userEmail}</span>.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 max-w-md mx-auto">
            <button
              onClick={startTest}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
            >
              Làm test đầu vào (10 phút)
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleSkipTest}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-600 px-6 py-3.5 rounded-2xl font-bold text-sm cursor-pointer transition-all"
            >
              Bỏ qua & bắt đầu từ đầu
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TEST INTRO */}
      {step === "test_intro" && (
        <div className="w-full text-center space-y-6 animate-fade-in">
          <div className="inline-flex bg-amber-50 text-amber-600 p-4 rounded-2xl border border-amber-100">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Chuẩn bị làm Placement Test</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Bài test gồm 21 câu trắc nghiệm từ vựng tương ứng với các band từ Foundation đến Competent (7 câu mỗi band). Hệ thống sẽ tính toán band từ vựng thực tế của bạn.
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <button
              onClick={startTest}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              Bắt đầu ngay
            </button>
            <button
              onClick={handleSkipTest}
              className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: TESTING */}
      {step === "testing" && testQuestions.length > 0 && (
        <div className="w-full space-y-8 animate-fade-in">
          {/* Header & Progress */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Câu {currentQuestionIdx + 1} / {testQuestions.length}</span>
            <span>Trình độ: {testQuestions[currentQuestionIdx].band === "0.0-4.0" ? "Foundation" : testQuestions[currentQuestionIdx].band === "4.5-5.5" ? "Intermediate" : "Competent"}</span>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${((currentQuestionIdx + 1) / testQuestions.length) * 100}%` }}
            />
          </div>

          {/* Question area */}
          <div className="text-center space-y-3 py-6 bg-slate-50/50 border border-slate-100 rounded-3xl p-6">
            <span className="text-xxs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">Chọn nghĩa đúng của từ</span>
            <div className="flex items-center justify-center gap-3">
              <h3 className="text-4xl font-black text-slate-900 tracking-tight">{testQuestions[currentQuestionIdx].word}</h3>
              <button 
                onClick={() => speakWord(testQuestions[currentQuestionIdx].word, 0.85, "en-US")}
                className="p-2.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all cursor-pointer active:scale-95 shadow-xxs"
                title="Nghe phát âm"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 font-mono text-sm">{testQuestions[currentQuestionIdx].ipa}</p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testQuestions[currentQuestionIdx].options.map((option, idx) => {
              const isSelected = answers[currentQuestionIdx] === option;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(option)}
                  className={`w-full text-left p-4 rounded-2xl border text-sm font-bold cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  }`}
                  style={{ minHeight: "56px" }}
                >
                  <span>{option}</span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIdx === 0}
              className={`text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer`}
            >
              &larr; Câu trước
            </button>
            <button
              onClick={handleSkipTest}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Dừng test & nộp bài sớm
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: TEST RESULT */}
      {step === "test_result" && (
        <div className="w-full text-center space-y-8 animate-fade-in">
          <div className="inline-flex bg-emerald-50 text-emerald-600 p-5 rounded-full border border-emerald-100 animate-bounce">
            <Award className="w-12 h-12" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hoàn thành bài test!</h2>
            <p className="text-slate-500 text-sm">LexiBand đã đánh giá năng lực từ vựng hiện tại của bạn.</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 max-w-md mx-auto space-y-5">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Trình độ ước tính</p>
              <p className="text-3xl font-black text-blue-600 mt-1">
                {startingBandCalculated === "0.0-4.0" && "Foundation (Band 4.0)"}
                {startingBandCalculated === "4.5-5.5" && "Intermediate (Band 5.5)"}
                {startingBandCalculated === "6.0-6.5" && "Competent (Band 6.5)"}
              </p>
            </div>

            <div className="h-px bg-slate-200" />

            {/* VLT Detailed Score per Band */}
            <div className="space-y-3 text-left">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Chi tiết kết quả Vocabulary Levels Test (VLT):</p>
              
              {/* Foundation */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800">Band 0.0 - 4.0 (Foundation)</p>
                  <p className="text-xxs text-slate-400 mt-0.5">Số câu đúng: <span className="font-bold text-slate-700">{testStats.fndCorrect}/{testStats.fndTotal}</span> ({testStats.fndPercent}%)</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  testStats.fndPassed 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {testStats.fndPassed ? "ĐẠT (≥80%)" : "CHƯA ĐẠT"}
                </span>
              </div>

              {/* Intermediate */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800">Band 4.5 - 5.5 (Intermediate)</p>
                  <p className="text-xxs text-slate-400 mt-0.5">Số câu đúng: <span className="font-bold text-slate-700">{testStats.intCorrect}/{testStats.intTotal}</span> ({testStats.intPercent}%)</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  testStats.intPassed 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {testStats.intPassed ? "ĐẠT (≥80%)" : "CHƯA ĐẠT"}
                </span>
              </div>

              {/* Competent */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-800">Band 6.0 - 6.5 (Competent)</p>
                  <p className="text-xxs text-slate-400 mt-0.5">Số câu đúng: <span className="font-bold text-slate-700">{testStats.advCorrect}/{testStats.advTotal}</span> ({testStats.advPercent}%)</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  testStats.advPassed 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {testStats.advPassed ? "ĐẠT (≥80%)" : "CHƯA ĐẠT"}
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="text-left bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100/50 text-[11px] text-slate-500 leading-relaxed space-y-1">
              <p className="font-black text-slate-700">Nguyên lý chuẩn học thuật Paul Nation:</p>
              <p>Trình độ từ vựng xuất phát được xác định bởi band cao nhất mà bạn vượt qua liên tục từ thấp lên với tỷ lệ trả lời đúng đạt tối thiểu <strong>80%</strong>.</p>
            </div>
          </div>

          <button
            onClick={handleConfirmTestResult}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            Tiếp tục thiết lập lộ trình
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 5: SETUP PLAN & PREVIEW */}
      {step === "setup_plan" && (
        <div className="w-full space-y-8 animate-fade-in text-left">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Thiết lập lộ trình học</h2>
            <p className="text-slate-500 text-sm">Hệ thống sẽ tính toán và cá nhân hóa kế hoạch từng ngày cho bạn.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Control Panel */}
            <div className="space-y-6 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              {/* Start Band Status */}
              <div>
                <label className="text-xxs font-black text-slate-400 uppercase tracking-wider block mb-2">Trình độ xuất phát</label>
                <div className="flex gap-2">
                  {(["0.0-4.0", "4.5-5.5", "6.0-6.5"] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setStartBand(b)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        startBand === b
                          ? "bg-blue-50 border-blue-400 text-blue-700 shadow-xxs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-500"
                      }`}
                    >
                      {b === "0.0-4.0" && "4.0"}
                      {b === "4.5-5.5" && "5.5"}
                      {b === "6.0-6.5" && "6.5"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Band Selector */}
              <div>
                <label className="text-xxs font-black text-slate-400 uppercase tracking-wider block mb-2">Band mục tiêu</label>
                <div className="flex gap-2">
                  {(["0.0-4.0", "4.5-5.5", "6.0-6.5"] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setTargetBand(b)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        targetBand === b
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xxs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-500"
                      }`}
                    >
                      {b === "0.0-4.0" && "4.0"}
                      {b === "4.5-5.5" && "5.5"}
                      {b === "6.0-6.5" && "6.5"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Prioritization Selector */}
              <div>
                <label className="text-xxs font-black text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <span>📚 Chủ đề học tập ưu tiên</span>
                  {selectedTopics.length > 0 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                      Đã chọn {selectedTopics.length}
                    </span>
                  )}
                </label>
                <p className="text-[10px] text-slate-400 mb-2.5 leading-relaxed">
                  Hệ thống sẽ gom nhóm từ vựng của chủ đề bạn chọn thành từng bài học hệ thống và ưu tiên học trước tiên!
                </p>
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {(Object.keys(TOPIC_LABELS) as MainTopic[])
                    .filter(t => t !== "General")
                    .map(topic => {
                      const labelInfo = TOPIC_LABELS[topic];
                      const isSelected = selectedTopics.includes(topic);
                      return (
                        <button
                          type="button"
                          key={topic}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTopics(prev => prev.filter(t => t !== topic));
                            } else {
                              setSelectedTopics(prev => [...prev, topic]);
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold text-left cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xxs font-extrabold"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span className="text-xs shrink-0">{labelInfo.emoji}</span>
                          <div className="leading-tight min-w-0">
                            <p className="font-bold truncate">{labelInfo.vi}</p>
                            <p className="text-[8px] text-slate-400 truncate font-normal">{labelInfo.en}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Duration Timeframe Selector */}
              <div>
                <label className="text-xxs font-black text-slate-400 uppercase tracking-wider block mb-2">Thời hạn học tập</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 6, 9, 12].map(m => (
                    <button
                      key={m}
                      onClick={() => setDurationMonths(m)}
                      className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        durationMonths === m
                          ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xxs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-500"
                      }`}
                    >
                      {m} Tháng
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <span className="text-xxs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">Dự báo lộ trình</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xxs">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Mục tiêu học</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{planPreview.wordCount} Từ</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Từ vựng thiết yếu</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xxs">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Học mỗi ngày</p>
                    <p className="text-xl font-black text-blue-600 mt-1">≈ {planPreview.wordsPerDay} Từ</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Từ mới/ngày</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xxs flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Thời gian học ước tính</p>
                    <p className="text-lg font-black text-slate-800 mt-1">~ {planPreview.estimatedMinutesPerDay} phút / ngày</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                </div>

                {/* Heavy workload warning */}
                {planPreview.isHeavy && (
                  <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3.5 rounded-2xl text-xs flex gap-2.5 leading-relaxed">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black">Cảnh báo cường độ học cao!</p>
                      <p className="text-slate-600 mt-0.5">Lộ trình này khá nặng ({planPreview.wordsPerDay} từ mới/ngày). Bạn nên kéo dài thời gian học hơn để duy trì thói quen học tập bền bỉ.</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleGeneratePlan}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
              >
                Kích hoạt & bắt đầu lộ trình
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
