/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  Volume2, 
  Filter, 
  BookOpen, 
  CheckCircle, 
  Clock, 
  PlusCircle, 
  X, 
  ArrowRight,
  Sparkles,
  Award,
  Star,
  Bookmark,
  ArrowUpDown,
  SlidersHorizontal,
  Lightbulb,
  AlertTriangle,
  History,
  TrendingUp,
  FileText,
  StarOff,
  CornerDownRight,
  BookMarked
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Word, UserProgress, IELTS_BANDS, TOPICS, formatIELTSBand } from "../types";
import { getEnrichedWord, EnrichedWord } from "../utils/enrichment";
import { speakText } from "../utils/speech";
import { LearningPlan } from "../utils/curriculum";

interface LibraryProps {
  words: Word[];
  progress: UserProgress;
  onStartReview: (word: Word) => void;
  onToggleStar?: (wordId: string) => void;
  learningPlan?: LearningPlan | null;
}

export function speakWord(text: string, rate: number = 0.9, accent: "en-US" | "en-GB" = "en-US") {
  speakText(text, rate, accent);
}

export default function Library({ words, progress, onStartReview, onToggleStar, learningPlan }: LibraryProps) {
  // Advanced States
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("lexiband_recent_searches");
      return saved ? JSON.parse(saved) : ["sustain", "infrastructure", "analyze"];
    } catch {
      return ["sustain", "infrastructure", "analyze"];
    }
  });

  const popularSearches = ["significant", "environment", "identify", "economy"];

  // Core filters
  const [selectedBand, setSelectedBand] = useState<string>(() => {
    if (learningPlan && learningPlan.startBand) {
      return learningPlan.startBand;
    }
    return "All";
  });
  const [selectedTopic, setSelectedTopic] = useState<string>("All");
  const [selectedPos, setSelectedPos] = useState<string>("All");
  const [selectedCefr, setSelectedCefr] = useState<string>("All");
  const [selectedOxford, setSelectedOxford] = useState<string>("All");
  const [selectedAwl, setSelectedAwl] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Selected collection tab
  const [activeCollection, setActiveCollection] = useState<"all" | "favorites" | "today" | "weak" | "mastered" | "practice">("all");
  
  // Sort By state
  const [sortBy, setSortBy] = useState<string>("alphabet-asc");
  const [voiceAccent, setVoiceAccent] = useState<"en-US" | "en-GB">("en-US");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // 20 per page feels more premium and fits better than 24

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBand, selectedTopic, selectedPos, selectedCefr, selectedOxford, selectedAwl, selectedStatus, activeCollection, sortBy]);

  // Selected Word for Modal
  const [activeWord, setActiveWord] = useState<Word | null>(null);
  
  // Modal Active Tab
  const [modalTab, setModalTab] = useState<"overview" | "academic" | "examples" | "mistakes" | "related">("overview");

  // Filter & Sort panel toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sync recent searches to localstorage
  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      localStorage.setItem("lexiband_recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  // Autocomplete Suggestions List
  const autocompleteSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return words
      .filter(w => w.word.toLowerCase().startsWith(q))
      .map(w => w.word)
      .slice(0, 5);
  }, [words, searchQuery]);

  // Enrich all words for advanced filtering
  const enrichedWords = useMemo(() => {
    return words.map(w => getEnrichedWord(w));
  }, [words]);

  // Combined Filter and Sort Logic
  const processedWords = useMemo(() => {
    // 1. Filtering
    let results = enrichedWords.filter(word => {
      const p = progress[word.id];
      const status = p ? p.status : "new";
      const isFav = p ? !!p.isStarred : false;

      // Search matching (word, meaning, definitions, collocations, synonyms, pos, wordFamily keys)
      const q = searchQuery.toLowerCase().trim();
      let matchesSearch = true;
      if (q !== "") {
        const wfStrings = Object.values(word.wordFamily || {}).map(v => String(v).toLowerCase());
        const collocationStrings = (word.collocations || []).map(c => c.toLowerCase());
        const synonymStrings = (word.synonyms || []).map(s => s.toLowerCase());
        const phraseStrings = (word.commonPhrases || []).map(ph => ph.toLowerCase());

        matchesSearch = 
          word.word.toLowerCase().includes(q) || 
          word.meaning.toLowerCase().includes(q) ||
          word.definition.toLowerCase().includes(q) ||
          word.topic.toLowerCase().includes(q) ||
          collocationStrings.some(c => c.includes(q)) ||
          synonymStrings.some(s => s.includes(q)) ||
          phraseStrings.some(ph => ph.includes(q)) ||
          wfStrings.some(wfs => wfs.includes(q));
      }

      // Dropdown Basic Filters
      const matchesBand = selectedBand === "All" || word.band === selectedBand;
      const matchesTopic = selectedTopic === "All" || word.topic === selectedTopic;
      const matchesStatus = selectedStatus === "All" || status === selectedStatus;
      
      // Dropdown Advanced Filters
      const matchesPos = selectedPos === "All" || word.pos.toLowerCase() === selectedPos.toLowerCase();
      const matchesCefr = selectedCefr === "All" || word.cefr === selectedCefr;
      const matchesOxford = selectedOxford === "All" || word.oxfordLevel === selectedOxford;
      const matchesAwl = selectedAwl === "All" || 
        (selectedAwl === "Yes" ? word.awlLevel !== "N/A" : word.awlLevel === "N/A");

      // Custom Collection Filter Tabs
      let matchesCollection = true;
      if (activeCollection === "favorites") {
        matchesCollection = isFav;
      } else if (activeCollection === "today") {
        const todayStr = new Date().toISOString().split("T")[0];
        matchesCollection = p ? p.nextReviewDate === todayStr : false;
      } else if (activeCollection === "weak") {
        matchesCollection = p ? (p.efactor <= 2.2 && status === "learning") : false;
      } else if (activeCollection === "mastered") {
        matchesCollection = status === "mastered";
      } else if (activeCollection === "practice") {
        matchesCollection = status === "learning";
      }

      return matchesSearch && matchesBand && matchesTopic && matchesStatus &&
             matchesPos && matchesCefr && matchesOxford && matchesAwl && matchesCollection;
    });

    // 2. Sorting
    results.sort((a, b) => {
      switch (sortBy) {
        case "alphabet-asc":
          return a.word.localeCompare(b.word);
        case "alphabet-desc":
          return b.word.localeCompare(a.word);
        case "most-frequent":
          return b.frequency - a.frequency;
        case "most-difficult":
          return b.difficulty - a.difficulty;
        case "highest-band":
          return b.band.localeCompare(a.band);
        case "random":
          return (a.id.charCodeAt(0) + b.id.charCodeAt(0)) % 2 === 0 ? 1 : -1;
        default:
          return a.word.localeCompare(b.word);
      }
    });

    return results;
  }, [
    enrichedWords, progress, searchQuery, selectedBand, selectedTopic, selectedStatus,
    selectedPos, selectedCefr, selectedOxford, selectedAwl, activeCollection, sortBy
  ]);

  // Paginated list slice
  const paginatedWords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedWords.slice(startIndex, startIndex + itemsPerPage);
  }, [processedWords, currentPage]);

  const totalPages = Math.ceil(processedWords.length / itemsPerPage);

  // Handle playing TTS
  const handlePlayTTS = (e: React.MouseEvent, text: string, rate = 0.85) => {
    e.stopPropagation();
    speakWord(text, rate, voiceAccent);
  };

  // Keyboard events for autocomplete search
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveRecentSearch(searchQuery);
      setShowSuggestions(false);
    }
  };

  // Click on a search suggest badge
  const handleSuggestionClick = (term: string) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    setShowSuggestions(false);
  };

  // Navigating to related words inside modal
  const handleSelectWordByName = (wordName: string) => {
    const found = words.find(w => w.word.toLowerCase() === wordName.toLowerCase());
    if (found) {
      setActiveWord(found);
      setModalTab("overview"); // Reset tab
      speakWord(found.word, 0.9, voiceAccent);
    } else {
      speakWord(wordName, 0.9, voiceAccent);
    }
  };

  const activeEnriched = activeWord ? getEnrichedWord(activeWord) : null;

  return (
    <div className="space-y-8 animate-fade-in text-slate-700 dark:text-slate-350" id="library-section">
      
      {/* Search Header Banner */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xxs font-black text-slate-400 uppercase tracking-widest">Từ điển cá nhân hóa</span>
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Thư Viện Từ Vựng IELTS</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
          Tra cứu phát âm IPA, nghĩa Việt sâu sắc, collocations, ví dụ 4 kỹ năng và sơ đồ liên kết từ vựng chuẩn chỉnh cho IELTS.
        </p>
      </div>

      {/* 📚 GLOBAL SEARCH & SMART AUTOCOMPLETE SPOTLIGHT */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5 relative">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Main search input wrapper */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder="Tìm theo từ, nghĩa Việt, collocation, đồng nghĩa, gia đình từ..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-slate-750 dark:text-slate-100 font-semibold"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            )}
          </div>

          {/* Quick Configs Toolbar */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                showAdvancedFilters || selectedPos !== "All" || selectedCefr !== "All" || selectedOxford !== "All" || selectedAwl !== "All"
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                  : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-750"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Lọc nâng cao</span>
              {(selectedPos !== "All" || selectedCefr !== "All" || selectedOxford !== "All" || selectedAwl !== "All") && (
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
              )}
            </button>

            {/* Accent Toggle */}
            <div className="bg-slate-100 dark:bg-slate-850 p-1 rounded-xl flex border border-slate-200 dark:border-slate-750 shrink-0">
              <button
                onClick={() => setVoiceAccent("en-US")}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  voiceAccent === "en-US" 
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                }`}
              >
                US (Mỹ)
              </button>
              <button
                onClick={() => setVoiceAccent("en-GB")}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  voiceAccent === "en-GB" 
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                }`}
              >
                UK (Anh)
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion Spotlight Dropdown */}
        {showSuggestions && (searchQuery || recentSearches.length > 0) && (
          <div className="absolute top-[calc(100%-8px)] left-6 right-6 md:right-auto md:w-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 z-40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Gợi ý học tập
              </span>
              <button 
                onClick={() => setShowSuggestions(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Match Words list */}
            {autocompleteSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold block">Từ vựng tương đồng:</span>
                <div className="flex flex-wrap gap-1.5">
                  {autocompleteSuggestions.map(wordStr => (
                    <button
                      key={wordStr}
                      onClick={() => handleSuggestionClick(wordStr)}
                      className="text-xs bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-100/35 dark:border-indigo-900/30 transition-colors font-semibold cursor-pointer"
                    >
                      {wordStr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recents */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Gần đây:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map(term => (
                  <button
                    key={term}
                    onClick={() => handleSuggestionClick(term)}
                    className="text-xs bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-250/50 dark:border-slate-750 transition-colors font-semibold cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Popular trending */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-indigo-500 font-black flex items-center gap-1 uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" /> Xu hướng ôn luyện:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {popularSearches.map(term => (
                  <button
                    key={term}
                    onClick={() => handleSuggestionClick(term)}
                    className="text-xs bg-blue-50/55 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-100/40 dark:border-blue-900/30 transition-colors font-semibold cursor-pointer"
                  >
                    #{term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Basic Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-blue-500" /> IELTS Band Mục tiêu
            </label>
            <select
              value={selectedBand}
              onChange={(e) => setSelectedBand(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="All">Tất cả dải điểm</option>
              {IELTS_BANDS.map(b => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-500" /> IELTS Topic Chủ đề
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="All">Tất cả chủ đề</option>
              {TOPICS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" /> Sắp xếp danh sách
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="alphabet-asc">Mẫu tự chữ cái (A-Z)</option>
              <option value="alphabet-desc">Mẫu tự chữ cái (Z-A)</option>
              <option value="most-frequent">Ôn tập nhiều nhất (Tần suất)</option>
              <option value="most-difficult">Từ khó nhất (Độ khó)</option>
              <option value="highest-band">Yêu cầu IELTS Band cao nhất</option>
              <option value="random">Lọc ngẫu nhiên</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Part of Speech (Từ loại)</span>
                <select
                  value={selectedPos}
                  onChange={(e) => setSelectedPos(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="All">Tất cả từ loại</option>
                  <option value="Noun">Noun (Danh từ)</option>
                  <option value="Verb">Verb (Động từ)</option>
                  <option value="Adjective">Adjective (Tính từ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">CEFR Level (Chuẩn Châu Âu)</span>
                <select
                  value={selectedCefr}
                  onChange={(e) => setSelectedCefr(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="All">Tất cả cấp độ</option>
                  <option value="B1">CEFR B1 (Intermediate)</option>
                  <option value="B2">CEFR B2 (Upper-Inter)</option>
                  <option value="C1">CEFR C1 (Advanced)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Oxford Reference</span>
                <select
                  value={selectedOxford}
                  onChange={(e) => setSelectedOxford(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="All">Tất cả</option>
                  <option value="Oxford 3000">Oxford 3000 (Chính)</option>
                  <option value="Oxford 5000">Oxford 5000 (Mở rộng)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Academic Word List (AWL)</span>
                <select
                  value={selectedAwl}
                  onChange={(e) => setSelectedAwl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="All">Tất cả</option>
                  <option value="Yes">Academic List (Từ học thuật)</option>
                  <option value="No">Non-Academic (Thông dụng)</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 📑 QUICK FILTER CUSTOM COLLECTIONS PILL TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
        {[
          { id: "all", label: "Tất cả từ điển", count: words.length },
          { id: "favorites", label: "★ Sổ từ lưu trữ", count: words.filter(w => progress[w.id]?.isStarred).length },
          { id: "today", label: "📅 Cần ôn hôm nay", count: words.filter(w => {
              const todayStr = new Date().toISOString().split("T")[0];
              return progress[w.id]?.nextReviewDate === todayStr;
            }).length 
          },
          { id: "weak", label: "⚠️ Từ còn yếu (Weak)", count: words.filter(w => progress[w.id]?.efactor <= 2.2 && progress[w.id]?.status === "learning").length },
          { id: "mastered", label: "🏆 Thành thạo", count: words.filter(w => progress[w.id]?.status === "mastered").length },
          { id: "practice", label: "🔄 Luyện SRS", count: words.filter(w => progress[w.id]?.status === "learning").length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCollection(tab.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
              activeCollection === tab.id
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-black"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${activeCollection === tab.id ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid status & reset search results */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold">
        <div>
          ĐÃ LỌC: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{processedWords.length}</span> TỪ VỰNG IELTS KHỚP YÊU CẦU
        </div>
        {(searchQuery || selectedBand !== "All" || selectedTopic !== "All" || selectedPos !== "All" || selectedCefr !== "All" || selectedOxford !== "All" || selectedAwl !== "All" || activeCollection !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedBand("All");
              setSelectedTopic("All");
              setSelectedPos("All");
              setSelectedCefr("All");
              setSelectedOxford("All");
              setSelectedAwl("All");
              setSelectedStatus("All");
              setActiveCollection("all");
            }}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Đặt lại tất cả bộ lọc
          </button>
        )}
      </div>

      {/* Word Cards Grid */}
      {processedWords.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {paginatedWords.map((word) => {
              const p = progress[word.id];
              const status = p ? p.status : "new";
              const isFav = p ? !!p.isStarred : false;
              const bConfig = IELTS_BANDS.find(b => b.key === word.band);
              
              return (
                <motion.div
                  key={word.id}
                  layoutId={`word-card-${word.id}`}
                  onClick={() => {
                    setActiveWord(word);
                    setModalTab("overview");
                  }}
                  whileHover={{ y: -4, boxShadow: "0 12px 24px -4px rgba(0, 0, 0, 0.06)" }}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs cursor-pointer hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                >
                  {/* Title block */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 hover:text-indigo-600 transition-colors flex items-center gap-1.5 flex-wrap">
                          {word.word}
                          <span className="text-[10px] font-bold text-slate-400 capitalize">({word.pos})</span>
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">{word.ipa}</span>
                          <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-1.5 py-0.2 rounded-sm uppercase tracking-wider">{word.cefr}</span>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {onToggleStar && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar(word.id);
                            }}
                            className={`p-2 rounded-xl transition-all border ${
                              isFav 
                                ? "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400" 
                                : "bg-slate-50 dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            title="Lưu từ vựng"
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handlePlayTTS(e, word.word)}
                          className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100/40 dark:border-indigo-900/30 cursor-pointer"
                          title="Nghe phát âm"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Vietnamese meaning */}
                    <p className="text-xs font-extrabold text-slate-750 dark:text-slate-150 leading-snug line-clamp-2">
                      {word.meaning}
                    </p>

                    {/* Definition */}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2 italic">
                      &ldquo;{word.definition}&rdquo;
                    </p>
                  </div>

                  {/* Foot badges */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-50 dark:border-slate-800/60 flex-wrap">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${bConfig?.color || "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-350"}`}>
                        {formatIELTSBand(word.band)}
                      </span>
                      <span className="text-[9px] font-semibold bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                        {word.topic}
                      </span>
                    </div>

                    {/* Status Badge */}
                    {status === "new" && (
                      <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 flex items-center gap-1 uppercase tracking-wider">
                        <PlusCircle className="w-3 h-3" /> Mới
                      </span>
                    )}
                    {status === "learning" && (
                      <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900 flex items-center gap-1 uppercase tracking-wider animate-pulse">
                        <Clock className="w-3 h-3" /> Ôn {p?.interval}d
                      </span>
                    )}
                    {status === "mastered" && (
                      <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900 flex items-center gap-1 uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3" /> Thuộc
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Premium Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-100 dark:border-slate-800 mt-6 text-xs font-bold text-slate-500 dark:text-slate-400">
              <div>
                Đang hiển thị <span className="text-slate-800 dark:text-slate-100 font-extrabold">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedWords.length)}</span> trong số <span className="text-indigo-650 dark:text-indigo-450 font-black">{processedWords.length}</span> từ vựng IELTS
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[10px]"
                >
                  Trang đầu
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[10px]"
                >
                  Trước
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = currentPage - 2 + idx;
                  if (currentPage <= 2) {
                    pageNum = idx + 1;
                  } else if (currentPage >= totalPages - 1) {
                    pageNum = totalPages - 4 + idx;
                  }
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black cursor-pointer transition-all ${
                        currentPage === pageNum
                          ? "bg-indigo-600 border border-indigo-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[10px]"
                >
                  Kế
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[10px]"
                >
                  Trang cuối
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center border border-slate-100 dark:border-slate-800 shadow-xs max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">Không có từ vựng phù hợp</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
              Hãy thay đổi từ khóa tra cứu hoặc bấm nút "Đặt lại tất cả bộ lọc" để tìm thấy từ vựng chính xác.
            </p>
          </div>
        </div>
      )}

      {/* 🌟 IMMERSIVE HIGH-FIDELITY 5-TAB DETAIL MODAL WITH RELATED WORD NAVIGATION */}
      <AnimatePresence>
        {activeWord && activeEnriched && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[85vh] border border-slate-200 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Banner header */}
              <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative shrink-0">
                <div className="space-y-2 pr-8">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black uppercase bg-blue-600 text-white px-2.5 py-0.5 rounded-md border border-blue-500">
                      {formatIELTSBand(activeEnriched.band)}
                    </span>
                    <span className="text-[9px] font-black uppercase bg-indigo-650 text-white px-2.5 py-0.5 rounded-md border border-indigo-500">
                      Topic: {activeEnriched.topic}
                    </span>
                    {activeEnriched.awlLevel !== "N/A" && (
                      <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2.5 py-0.5 rounded-md border border-emerald-500">
                        AWL: {activeEnriched.awlLevel}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3.5 mt-1">
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {activeEnriched.word}
                    </h3>
                    <div className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                      <span className="text-[10px] font-black uppercase text-indigo-300">{activeEnriched.pos}</span>
                      <span className="text-[10px] font-black text-emerald-400">{activeEnriched.cefr}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-indigo-200 font-medium">
                    <p className="font-mono">IPA: <span className="text-white font-bold">{activeEnriched.ipa}</span></p>
                    <p>&bull;</p>
                    <p>Syllables: <span className="text-white font-semibold">{activeEnriched.syllables}</span></p>
                    <p>&bull;</p>
                    <p>Stress: <span className="text-white font-semibold">{activeEnriched.stressPosition}</span></p>
                  </div>
                </div>

                {/* Speaker play options */}
                <div className="absolute right-6 bottom-6 flex items-center gap-2">
                  {onToggleStar && (
                    <button
                      onClick={() => onToggleStar(activeEnriched.id)}
                      className={`p-2.5 rounded-xl transition-all border ${
                        progress[activeEnriched.id]?.isStarred
                          ? "bg-amber-500 text-white border-amber-400 shadow-md"
                          : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                      }`}
                      title="Sổ từ lưu trữ"
                    >
                      <Star className={`w-4 h-4 ${progress[activeEnriched.id]?.isStarred ? "fill-white" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handlePlayTTS(e, activeEnriched.word, 0.8)}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 border border-indigo-400 shadow-md transition-all flex items-center gap-1 text-xs font-bold"
                  >
                    <Volume2 className="w-4 h-4" /> US (Mỹ)
                  </button>
                  <button
                    onClick={(e) => speakWord(activeEnriched.word, 0.8, "en-GB")}
                    className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 border border-slate-750 shadow-md transition-all flex items-center gap-1 text-xs font-bold"
                  >
                    <Volume2 className="w-4 h-4" /> UK (Anh)
                  </button>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setActiveWord(null)}
                  className="absolute right-4 top-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 📑 TAB NAVIGATION FOR LEXICOGRAPHICAL META-DATA */}
              <div className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200/60 dark:border-slate-800 px-6 py-2 flex flex-wrap gap-1.5 shrink-0">
                {[
                  { id: "overview", label: "Tổng quan & Từ loại", icon: BookOpen },
                  { id: "academic", label: "Học thuật & Đồng nghĩa", icon: Award },
                  { id: "examples", label: "Ví dụ 4 kỹ năng", icon: FileText },
                  { id: "mistakes", label: "Lỗi người Việt & Mẹo", icon: Lightbulb },
                  { id: "related", label: "Họ từ liên hệ", icon: Sparkles }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      modalTab === tab.id
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-800"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Modal Body (Scrollable Workspace) */}
              <div className="p-6 overflow-y-auto space-y-6 text-slate-700 dark:text-slate-300 max-h-[50vh] shrink-1">
                
                {/* 🏷️ TAB 1: OVERVIEW */}
                {modalTab === "overview" && (
                  <div className="space-y-4">
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/60 dark:border-indigo-900/30 space-y-2">
                      <div className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Giải nghĩa từ vựng:</div>
                      <p className="text-base font-black text-indigo-950 dark:text-indigo-100 leading-relaxed">
                        {activeEnriched.meaning}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                        &ldquo;{activeEnriched.longDefinition}&rdquo;
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Nguồn gốc chuẩn:</span>
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{activeEnriched.oxfordLevel}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Mức phân chia CEFR:</span>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase">{activeEnriched.cefr} LEVEL</span>
                      </div>
                    </div>

                    {/* Word Family list */}
                    {Object.keys(activeEnriched.wordFamily).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Gia đình từ vựng (Word Family):</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(activeEnriched.wordFamily).map(([key, val]) => (
                            <div key={key} className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold capitalize">{key}:</span>
                              <span 
                                className="font-extrabold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer" 
                                onClick={() => speakWord(val || "", 0.9, voiceAccent)}
                              >
                                {val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Collocations */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Cặp liên từ hữu dụng (Collocations):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeEnriched.collocations.map((col, idx) => (
                          <span 
                            key={idx} 
                            onClick={(e) => handlePlayTTS(e, col)}
                            className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer animate-fade-in"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> {col}
                            </span>
                            <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 🏆 TAB 2: ACADEMIC & SYNONYMS */}
                {modalTab === "academic" && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Phân cấp từ đồng nghĩa theo IELTS Band:</span>
                      <div className="space-y-2.5">
                        <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-800 flex items-start gap-4">
                          <span className="text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-750 dark:text-slate-350 px-2.5 py-0.5 rounded-sm uppercase tracking-wider">Band 4.0</span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeEnriched.synonymsGrouped.band4.map((syn, i) => (
                              <button key={i} onClick={() => handleSelectWordByName(syn)} className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200 dark:hover:text-indigo-400 cursor-pointer">
                                {syn}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-800 flex items-start gap-4">
                          <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2.5 py-0.5 rounded-sm uppercase tracking-wider">Band 5.5</span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeEnriched.synonymsGrouped.band5.map((syn, i) => (
                              <button key={i} onClick={() => handleSelectWordByName(syn)} className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200 dark:hover:text-indigo-400 cursor-pointer">
                                {syn}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-800 flex items-start gap-4">
                          <span className="text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-0.5 rounded-sm uppercase tracking-wider">Band 6.5+</span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeEnriched.synonymsGrouped.band6.map((syn, i) => (
                              <button key={i} onClick={() => handleSelectWordByName(syn)} className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200 dark:hover:text-indigo-400 cursor-pointer animate-pulse">
                                {syn}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Từ trái nghĩa (Antonyms):</span>
                      <div className="flex flex-wrap gap-2">
                        {activeEnriched.antonyms.map((ant, idx) => (
                          <span key={idx} className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-100 dark:border-red-900 px-3 py-1.5 rounded-xl text-xs font-bold">
                            &ne; {ant}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Cụm cấu trúc hữu dụng (Useful Phrases):</span>
                      <div className="space-y-2">
                        {activeEnriched.commonPhrases.map((phrase, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => speakWord(phrase, 0.85, voiceAccent)}
                            className="bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold cursor-pointer transition-colors"
                          >
                            <span>&ldquo;{phrase}&rdquo;</span>
                            <Volume2 className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 📝 TAB 3: 4 SKILLS EXAMPLES */}
                {modalTab === "examples" && (
                  <div className="space-y-4">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Ngữ cảnh đề thi 4 kỹ năng chuẩn mẫu:</span>
                    
                    <div className="bg-slate-50/60 dark:bg-slate-850/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-750 dark:text-blue-300 px-2 py-0.5 rounded-sm uppercase tracking-wider">Speaking Session</span>
                        <button onClick={() => speakWord(activeEnriched.ieltsExamples.speaking, 0.9, voiceAccent)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">
                          <Volume2 className="w-3.5 h-3.5" /> Nghe
                        </button>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.speaking}&rdquo;</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pl-2.5 border-l-2 border-indigo-300">{activeEnriched.ieltsExamples.speakingTranslation}</p>
                    </div>

                    <div className="bg-slate-50/60 dark:bg-slate-850/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-750 dark:text-emerald-300 px-2 py-0.5 rounded-sm uppercase tracking-wider">Writing Task 2 Academic</span>
                        <button onClick={() => speakWord(activeEnriched.ieltsExamples.writing, 0.85, voiceAccent)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">
                          <Volume2 className="w-3.5 h-3.5" /> Nghe
                        </button>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.writing}&rdquo;</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pl-2.5 border-l-2 border-indigo-300">{activeEnriched.ieltsExamples.writingTranslation}</p>
                    </div>

                    <div className="bg-slate-50/60 dark:bg-slate-850/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-750 dark:text-amber-300 px-2 py-0.5 rounded-sm uppercase tracking-wider">Listening Monologue</span>
                        <button onClick={() => speakWord(activeEnriched.ieltsExamples.listening, 0.85, voiceAccent)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">
                          <Volume2 className="w-3.5 h-3.5" /> Nghe
                        </button>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.listening}&rdquo;</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pl-2.5 border-l-2 border-indigo-300">{activeEnriched.ieltsExamples.listeningTranslation}</p>
                    </div>

                    <div className="bg-slate-50/60 dark:bg-slate-850/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black bg-purple-50 dark:bg-purple-950/40 text-purple-750 dark:text-purple-300 px-2 py-0.5 rounded-sm uppercase tracking-wider">Reading Complex Passage</span>
                        <button onClick={() => speakWord(activeEnriched.ieltsExamples.reading, 0.85, voiceAccent)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer">
                          <Volume2 className="w-3.5 h-3.5" /> Nghe
                        </button>
                      </div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.reading}&rdquo;</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pl-2.5 border-l-2 border-indigo-300">{activeEnriched.ieltsExamples.readingTranslation}</p>
                    </div>
                  </div>
                )}

                {/* 💡 TAB 4: MISTAKES & MEMORY */}
                {modalTab === "mistakes" && (
                  <div className="space-y-4">
                    <div className="bg-rose-50/50 dark:bg-rose-950/15 p-4 rounded-2xl border border-rose-100 dark:border-rose-900 space-y-3">
                      <div className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" /> Bẫy dịch từ & Sai lầm phổ biến của người Việt:
                      </div>
                      
                      <div className="space-y-1 text-xxs font-mono">
                        <p className="text-rose-950 dark:text-rose-350 font-extrabold bg-rose-100/60 dark:bg-rose-950/40 p-2.5 rounded-xl">
                          ❌ Viết sai: &ldquo;{activeEnriched.commonMistakes.mistake}&rdquo;
                        </p>
                        <p className="text-emerald-950 dark:text-emerald-350 font-extrabold bg-emerald-100/60 dark:bg-emerald-950/40 p-2.5 rounded-xl mt-1.5">
                          ✅ Viết đúng: &ldquo;{activeEnriched.commonMistakes.correct}&rdquo;
                        </p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-2.5 border-l-2 border-rose-200 dark:border-rose-800 pt-1">
                        <strong>Giải thích lỗi sai:</strong> {activeEnriched.commonMistakes.explanation}
                      </p>
                    </div>

                    {/* Mnemonic Memory Tip */}
                    <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-900/40 space-y-2.5">
                      <div className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-500" /> Mẹo ghi nhớ siêu tốc (Mnemonic Memory Tip):
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-850 dark:text-slate-200 leading-relaxed font-semibold">
                        {activeEnriched.memoryTip.mnemonic}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-xxs font-bold text-slate-500 border-t border-amber-100 dark:border-amber-900/40">
                        <div>
                          <span className="block uppercase text-slate-400">Từ gốc (Root):</span>
                          <span className="text-slate-700 dark:text-slate-300">{activeEnriched.memoryTip.root}</span>
                        </div>
                        <div>
                          <span className="block uppercase text-slate-400">Tiền tố / Hậu tố:</span>
                          <span className="text-slate-700 dark:text-slate-300">{activeEnriched.memoryTip.prefixSuffix}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🕸️ TAB 5: RELATED WORDS */}
                {modalTab === "related" && (
                  <div className="space-y-4 animate-fade-in">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                      Họ từ vựng tương hỗ và sơ đồ liên kết:
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {activeEnriched.relatedWords.map((name, index) => {
                        const isExistInSeed = words.some(w => w.word.toLowerCase() === name.toLowerCase());
                        
                        return (
                          <button
                            key={index}
                            onClick={() => handleSelectWordByName(name)}
                            className={`p-3.5 rounded-2xl border text-xs font-bold text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                              isExistInSeed
                                ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200 border-indigo-200/50 dark:border-indigo-900/50 hover:bg-indigo-100/60 hover:scale-103 shadow-xxs"
                                : "bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                          >
                            <span className="truncate block font-black">{name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                              {isExistInSeed ? "Chuyển nhanh" : "Học phát âm"}
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xxs text-slate-450 dark:text-slate-500 leading-normal flex items-start gap-2 font-bold">
                      <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
                      <span>
                        Bấm chọn các từ có màu để chuyển nhanh trang thông tin hoặc các từ xám để nghe phát âm. Thừa kế các từ vựng chung gốc giúp bạn nâng Band từ vựng IELTS của mình nhanh nhất.
                      </span>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal footer */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end rounded-b-3xl shrink-0">
                <button
                  onClick={() => setActiveWord(null)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setActiveWord(null);
                    onStartReview(activeWord);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  Luyện tập SRS <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
