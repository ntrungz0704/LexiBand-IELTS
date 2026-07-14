/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Award, 
  Flame, 
  TrendingUp, 
  CheckCircle, 
  BookOpen, 
  Calendar,
  Sparkles,
  RefreshCw,
  Volume2,
  Star,
  Play,
  ChevronRight,
  BookMarked,
  Layers,
  FileText,
  Search,
  Bell,
  Sliders,
  Sparkle,
  X,
  Plus,
  Compass,
  Check,
  Mic
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Word, UserProgress, StreakData, IELTS_BANDS, formatIELTSBand } from "../types";
import { getEnrichedWord } from "../utils/enrichment";
import { AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { getTodayString, isDue } from "../utils/srs";
import { LearningPlan, DailyUnit, getCleanTopic, TOPIC_LABELS } from "../utils/curriculum";
import CurriculumPlayer from "./CurriculumPlayer";
import { speakText } from "../utils/speech";

// Local Speech Synthesis implementation for robust standalone behavior
export function speakWordText(text: string, accent: "en-US" | "en-GB" = "en-US") {
  speakText(text, 0.85, accent);
}

interface DashboardProps {
  words: Word[];
  progress: UserProgress;
  streak: StreakData;
  onResetProgress: () => void;
  onQuickPractice: (mode: "srs" | "quiz" | "fill-blank", type?: "all" | "due" | "new", word?: Word) => void;
  onToggleStar: (wordId: string) => void;
  setActiveTab: (tab: "dashboard" | "library" | "practice") => void;
  setSearchQuery: (q: string) => void;
  learningPlan: LearningPlan | null;
  onCompletePlanUnit: (unitIndex: number, score: number) => void;
  userName?: string;
}

export default function Dashboard({ 
  words, 
  progress, 
  streak, 
  onResetProgress,
  onQuickPractice,
  onToggleStar,
  setActiveTab,
  setSearchQuery,
  learningPlan,
  onCompletePlanUnit,
  userName = "Học viên"
}: DashboardProps) {
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExtendedStats, setShowExtendedStats] = useState(false);
  const [activeWordModal, setActiveWordModal] = useState<Word | null>(null);
  const [modalTab, setModalTab] = useState<"overview" | "academic" | "examples" | "mistakes" | "related">("overview");
  const [localSearch, setLocalSearch] = useState("");
  const [accent, setAccent] = useState<"en-US" | "en-GB">("en-US");

  // Learning Alarm / Notification State & Synchronization
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const stored = localStorage.getItem("lexiband_notifications");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return {
      enabled: false,
      reminderTime: "20:00",
      reviewAlert: true,
      streakGuard: true,
    };
  });

  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  const [inAppNotification, setInAppNotification] = useState<{ title: string; body: string; show: boolean }>({
    title: "",
    body: "",
    show: false,
  });

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      showLocalNotification("LexiBand", "Trình duyệt của bạn chưa hỗ trợ thông báo trực tiếp. Đã kích hoạt thông báo in-app!");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        const updated = { ...notificationSettings, enabled: true };
        setNotificationSettings(updated);
        localStorage.setItem("lexiband_notifications", JSON.stringify(updated));
        
        // Trigger a real browser notification!
        try {
          new Notification("LexiBand IELTS", {
            body: "Chúc mừng! Bạn đã bật thông báo nhắc học hàng ngày lúc " + notificationSettings.reminderTime + " thành công.",
            icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
          });
        } catch (e) {}
        
        showLocalNotification("LexiBand IELTS", "Bật thông báo đẩy thành công! Chúng tôi sẽ đồng hành nhắc nhở bạn học tập mỗi ngày.");
      } else {
        showLocalNotification("LexiBand", "Quyền thông báo bị từ chối hoặc chặn. Bạn có thể cho phép lại trong cài đặt trình duyệt.");
      }
    } catch (e) {
      console.warn("Error requesting notification permission", e);
    }
  };

  const showLocalNotification = (title: string, body: string) => {
    setInAppNotification({ title, body, show: true });
    setTimeout(() => {
      setInAppNotification(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  const handleToggleNotificationSetting = (key: "enabled" | "reviewAlert" | "streakGuard") => {
    const updated = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(updated);
    localStorage.setItem("lexiband_notifications", JSON.stringify(updated));
    
    if (key === "enabled" && !notificationSettings.enabled && notificationPermission !== "granted") {
      requestNotificationPermission();
    } else {
      showLocalNotification("Cập nhật cài đặt", `Đã ${updated[key] ? "Bật" : "Tắt"} mục nhắc nhở thành công.`);
    }
  };

  const handleChangeReminderTime = (time: string) => {
    const updated = { ...notificationSettings, reminderTime: time };
    setNotificationSettings(updated);
    localStorage.setItem("lexiband_notifications", JSON.stringify(updated));
    showLocalNotification("Hẹn giờ học thành công", `Giờ học hàng ngày mới đã được hẹn vào: ${time}`);
  };

  const triggerTestNotification = () => {
    // Determine the reminder text
    let message = `Học viên ơi, đến giờ học IELTS hôm nay rồi! 🎯 Lộ trình đang chờ bạn chinh phục. Hãy hoàn thành để bảo vệ chuỗi ${streak.currentStreak} ngày streak nhé! 🔥`;
    if (notificationSettings.streakGuard && streak.currentStreak > 0) {
      message = `⚡ CẢNH BÁO MẤT STREAK! Bạn sắp đánh mất chuỗi ${streak.currentStreak} ngày rèn luyện liên tiếp. Hãy học ngay 10 phút để giữ lửa! 🔥`;
    }
    
    // Send actual Notification if permitted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("LexiBand IELTS Reminder", {
          body: message,
          icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
          tag: "lexiband-study-reminder"
        });
      } catch (e) {
        console.warn("Failed to show native notification", e);
      }
    }
    
    showLocalNotification("Thông báo giả lập (Thử nghiệm)", message);
  };

  const [activeLessonUnit, setActiveLessonUnit] = useState<DailyUnit | null>(null);

  const currentUnitIdx = useMemo(() => {
    if (!learningPlan) return -1;
    return learningPlan.dailyUnits.findIndex(u => !u.completed);
  }, [learningPlan]);

  const currentUnit = useMemo(() => {
    if (currentUnitIdx === -1 || !learningPlan) return null;
    return learningPlan.dailyUnits[currentUnitIdx];
  }, [learningPlan, currentUnitIdx]);

  const wordsInUnit = useMemo(() => {
    if (!currentUnit) return [];
    return currentUnit.wordIds.map(id => words.find(w => w.id === id)).filter(Boolean) as Word[];
  }, [currentUnit, words]);

  const startedWordsCount = useMemo(() => {
    return wordsInUnit.filter(w => progress[w.id] && progress[w.id].status !== "new").length;
  }, [wordsInUnit, progress]);

  const dailyCompletionPercentage = useMemo(() => {
    if (!currentUnit) return 0;
    if (currentUnit.completed) return 100;
    const total = wordsInUnit.length;
    if (total === 0) return 0;
    return Math.min(100, Math.max(0, Math.round((startedWordsCount / total) * 100)));
  }, [currentUnit, wordsInUnit, startedWordsCount]);

  // 1. Calculate General Stats
  const stats = useMemo(() => {
    const total = words.length;
    let mastered = 0;
    let learning = 0;
    let newWords = 0;
    let starred = 0;

    words.forEach(w => {
      const p = progress[w.id];
      if (p?.isStarred) {
        starred++;
      }
      
      if (!p) {
        newWords++;
      } else if (p.status === "mastered") {
        mastered++;
      } else {
        learning++;
      }
    });

    const completionRate = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return { total, mastered, learning, newWords, completionRate, starred };
  }, [words, progress]);

  // 2. Calculate Stats by Band Category
  const bandStats = useMemo(() => {
    const bands = {
      "0.0-4.0": { total: 0, mastered: 0, learning: 0, new: 0 },
      "4.5-5.5": { total: 0, mastered: 0, learning: 0, new: 0 },
      "6.0-6.5": { total: 0, mastered: 0, learning: 0, new: 0 }
    };

    words.forEach(w => {
      const p = progress[w.id];
      const category = w.band;
      
      if (bands[category]) {
        bands[category].total++;
        if (!p) {
          bands[category].new++;
        } else if (p.status === "mastered") {
          bands[category].mastered++;
        } else {
          bands[category].learning++;
        }
      }
    });

    return bands;
  }, [words, progress]);

  // 3. Dynamic Progress Ring Dash Offset
  // Overall completion matches 58% in mockup, we tie it dynamically with a beautiful fallback
  const displayPercentage = useMemo(() => {
    const learned = stats.mastered + stats.learning;
    return stats.total > 0 ? Math.round((learned / stats.total) * 100) : 0;
  }, [stats]);

  // Let's calculate the macro words learned out of 3200 matching mockup
  const displayWordsLearned = useMemo(() => {
    return stats.mastered + stats.learning;
  }, [stats]);

  // Dynamic band calculation
  const estimatedBand = useMemo(() => {
    const fndTotal = bandStats["0.0-4.0"].total;
    const intTotal = bandStats["4.5-5.5"].total;
    const advTotal = bandStats["6.0-6.5"].total;

    const fndLearned = fndTotal > 0 ? (bandStats["0.0-4.0"].mastered + bandStats["0.0-4.0"].learning * 0.5) / fndTotal : 0;
    const intLearned = intTotal > 0 ? (bandStats["4.5-5.5"].mastered + bandStats["4.5-5.5"].learning * 0.5) / intTotal : 0;
    const advLearned = advTotal > 0 ? (bandStats["6.0-6.5"].mastered + bandStats["6.0-6.5"].learning * 0.5) / advTotal : 0;

    let band = 4.0;
    band += fndLearned * 1.0; // Foundation adds up to 1.0 band
    band += intLearned * 1.0; // Intermediate adds up to 1.0 band
    band += advLearned * 0.5; // Competent adds up to 0.5 band
    return Math.min(6.5, Math.max(4.0, band)).toFixed(1);
  }, [bandStats]);

  // SVG parameters for progress ring
  const strokeDashoffset = useMemo(() => {
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    return circumference - (displayPercentage / 100) * circumference;
  }, [displayPercentage]);

  // Dynamic Task Counts for Ôn Tập and Từ Mới
  const dueCount = useMemo(() => {
    const todayStr = getTodayString();
    return words.filter(w => {
      const p = progress[w.id];
      return p && isDue(p.nextReviewDate, todayStr);
    }).length;
  }, [words, progress]);

  const newCount = useMemo(() => {
    return words.filter(w => !progress[w.id]).length;
  }, [words, progress]);

  const todayCount = useMemo(() => {
    return streak.history[getTodayString()] || 0;
  }, [streak.history]);

  const weeklyCount = useMemo(() => {
    let sum = 0;
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(todayDate.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      sum += streak.history[dateStr] || 0;
    }
    return sum;
  }, [streak.history]);

  const monthlyCount = useMemo(() => {
    let sum = 0;
    const todayDate = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(todayDate.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      sum += streak.history[dateStr] || 0;
    }
    return sum;
  }, [streak.history]);

  const achievementsList = useMemo(() => {
    const streakCount = streak.currentStreak;
    const wordsCount = displayWordsLearned;
    
    return [
      {
        title: `🔥 ${streakCount} Day Streak`,
        desc: streakCount > 0 ? "Duy trì học tập liên tiếp" : "Bắt đầu chuỗi học tập ngay",
        checked: streakCount > 0
      },
      {
        title: `📖 ${wordsCount} Từ Đã Học`,
        desc: "Tích lũy vốn từ vựng thực tế",
        checked: wordsCount > 0
      },
      {
        title: "🏆 Academic Explorer",
        desc: "Vượt qua toàn bộ chủ đề",
        checked: stats.mastered > 0 && stats.mastered === stats.total
      },
      {
        title: "⭐ Perfect Review",
        desc: "Đạt hiệu số E-factor tối đa",
        checked: Object.values(progress).some(p => p.efactor >= 2.8)
      }
    ];
  }, [streak.currentStreak, displayWordsLearned, stats.mastered, stats.total, progress]);

  const bandProgress = useMemo(() => {
    const b1Total = bandStats["0.0-4.0"].total;
    const b1Learned = bandStats["0.0-4.0"].mastered + bandStats["0.0-4.0"].learning;
    const b1Percent = b1Total > 0 ? Math.round((b1Learned / b1Total) * 100) : 0;

    const b2Total = bandStats["4.5-5.5"].total;
    const b2Learned = bandStats["4.5-5.5"].mastered + bandStats["4.5-5.5"].learning;
    const b2Percent = b2Total > 0 ? Math.round((b2Learned / b2Total) * 100) : 0;

    const b3Total = bandStats["6.0-6.5"].total;
    const b3Learned = bandStats["6.0-6.5"].mastered + bandStats["6.0-6.5"].learning;
    const b3Percent = b3Total > 0 ? Math.round((b3Learned / b3Total) * 100) : 0;

    return {
      b1: { total: b1Total, learned: b1Learned, percent: b1Percent },
      b2: { total: b2Total, learned: b2Learned, percent: b2Percent },
      b3: { total: b3Total, learned: b3Learned, percent: b3Percent }
    };
  }, [bandStats]);

  // 4. Topic Chart Data (Doughnut Chart)
  const topicChartData = useMemo(() => {
    const topics: { [key: string]: number } = {};
    words.forEach(w => {
      topics[w.topic] = (topics[w.topic] || 0) + 1;
    });
    const entries = Object.entries(topics).map(([name, count]) => {
      return {
        name,
        value: Math.round((count / words.length) * 100),
        color: ""
      };
    }).sort((a, b) => b.value - a.value);

    const colors = ["#2563EB", "#14B8A6", "#6366F1", "#F59E0B", "#EF4444", "#94A3B8", "#10B981", "#EC4899"];
    return entries.slice(0, 6).map((entry, index) => ({
      ...entry,
      color: colors[index % colors.length]
    }));
  }, [words]);

  // 5. Band Prediction Chart Data (Line Chart)
  const bandChartData = useMemo(() => {
    return [
      { day: "Day 1", band: 4.0 },
      { day: "Day 10", band: 4.1 },
      { day: "Day 20", band: 4.2 },
      { day: "Day 30", band: 4.3 },
      { day: "Day 40", band: 4.4 },
      { day: "Day 50", band: 4.5 },
      { day: "Day 60", band: 4.6 },
      { day: "Today", band: parseFloat(estimatedBand) }
    ];
  }, [estimatedBand]);

  // 6. Representative list of 5 words for Today's Vocabulary (strictly synchronized with Today's Unit)
  const todaysVocabulary = useMemo(() => {
    if (wordsInUnit && wordsInUnit.length > 0) {
      return wordsInUnit;
    }
    return words.slice(0, 5);
  }, [wordsInUnit, words]);

  // 7. Words needing review (SRS Again/Hard list, or representative cards)
  const wordsNeedingReview = useMemo(() => {
    const list = words.filter(w => {
      const p = progress[w.id];
      return p && (p.status === "learning" || p.efactor < 2.4);
    });

    if (list.length < 5) {
      const filled = [...list];
      for (const w of words) {
        if (filled.length >= 5) break;
        if (!filled.some(x => x.id === w.id)) {
          filled.push(w);
        }
      }
      return filled;
    }
    return list.slice(0, 5);
  }, [words, progress]);

  // 8. Heatmap contributions matrix (4 weeks, 7 days)
  const heatmapData = useMemo(() => {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const rows = [
      { label: "Tuần này", offsets: [0, 1, 2, 3, 4, 5, 6] },
      { label: "Tuần trước", offsets: [7, 8, 9, 10, 11, 12, 13] },
      { label: "2 tuần trước", offsets: [14, 15, 16, 17, 18, 19, 20] },
      { label: "3 tuần trước", offsets: [21, 22, 23, 24, 25, 26, 27] }
    ];

    const today = new Date();
    
    return rows.map(row => {
      const squares = row.offsets.map(offset => {
        const d = new Date();
        d.setDate(today.getDate() - offset);
        const dateStr = d.toISOString().split("T")[0];
        const count = streak.history[dateStr] || 0;
        
        let level = 0;
        if (count > 0 && count <= 10) level = 1;
        else if (count > 10 && count <= 25) level = 2;
        else if (count > 25 && count <= 40) level = 3;
        else if (count > 40) level = 4;

        return {
          date: dateStr,
          count,
          level
        };
      }).reverse(); // Order from Mon to Sun

      return {
        label: row.label,
        squares
      };
    });
  }, [streak]);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim() !== "") {
      setSearchQuery(localSearch);
      setActiveTab("library");
    }
  };

  const handleRowClick = (word: Word) => {
    setActiveWordModal(word);
  };

  const speak = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    speakWordText(word, accent);
  };

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleStar(id);
  };

  if (activeLessonUnit) {
    return (
      <div className="py-6 md:py-12 flex justify-center items-center min-h-[600px]" id="curriculum-lesson-player-container">
        <CurriculumPlayer 
          unit={activeLessonUnit}
          wordsInUnit={wordsInUnit}
          allWords={words}
          onComplete={(score) => {
            onCompletePlanUnit(currentUnitIdx, score);
            setActiveLessonUnit(null);
          }}
          onCancel={() => setActiveLessonUnit(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12" id="dashboard-container">
      
      {/* Premium Top Navigation Inside Panel */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xxs">
        
        {/* Left Welcome Text */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">LexiBand IELTS Dashboard</h2>
            <p className="text-xs text-slate-400 font-medium">Hệ thống Spaced Repetition tối ưu Band 6.5+</p>
          </div>
        </div>

        {/* Center Search Input */}
        <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm từ vựng trong kho học thuật..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700"
          />
        </form>

        {/* Right Settings Toggle Accent */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accent:</span>
          <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200">
            <button
              onClick={() => setAccent("en-US")}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                accent === "en-US" ? "bg-white text-blue-600 shadow-xs" : "text-slate-400"
              }`}
            >
              Mỹ (US)
            </button>
            <button
              onClick={() => setAccent("en-GB")}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                accent === "en-GB" ? "bg-white text-blue-600 shadow-xs" : "text-slate-400"
              }`}
            >
              Anh (UK)
            </button>
          </div>
        </div>
      </div>

      {/* Floating In-App Premium Notification Hub */}
      <AnimatePresence>
        {inAppNotification.show && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-6 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700/50 z-50 flex items-start gap-3.5"
            id="inapp-notification-toast"
          >
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">{inAppNotification.title}</h4>
              <p className="text-xs text-slate-200 mt-1 font-semibold leading-relaxed">{inAppNotification.body}</p>
            </div>
            <button 
              onClick={() => setInAppNotification(prev => ({ ...prev, show: false }))}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer ml-1 shrink-0"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Today's Mission Master Card (Only One Primary CTA) */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6" id="todays-mission-container">
        
        {/* Decorative ambient blobs for premium feel */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/4 bottom-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-4 relative z-10 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black px-3 py-1 bg-blue-600 text-white rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-blue-500/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              Today's Mission
            </span>
            {learningPlan && (
              <span className="text-xxs font-extrabold text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-900/40">
                Ngày {currentUnit ? currentUnit.dayNumber : learningPlan.totalDays} / {learningPlan.totalDays} &bull; Lộ trình {formatIELTSBand(learningPlan.targetBand)}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Hello, {userName} <span className="animate-wave origin-bottom-right inline-block">👋</span>
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-semibold max-w-2.5xl leading-relaxed">
              {currentUnit ? (
                currentUnit.type === "new_words" ? (
                  <>Sẵn sàng bứt phá từ vựng? Nhiệm vụ chính hôm nay của bạn là học và kiểm tra ghi nhớ <span className="text-blue-400 font-extrabold">{currentUnit.wordIds.length} từ mới</span>. Bạn có <span className="text-amber-400 font-extrabold">{dueCount} từ cũ</span> cần ôn tập để bảo vệ trí nhớ lâu dài.</>
                ) : currentUnit.type === "review" ? (
                  <>Đến lúc củng cố phản xạ! Nhiệm vụ hôm nay là <span className="text-indigo-400 font-extrabold">Ôn tập tổng hợp tuần ({currentUnit.wordIds.length} từ)</span> qua Spaced Repetition.</>
                ) : (
                  <>Kiểm tra năng lực thực tế! Nhiệm vụ hôm nay là vượt qua bài thi <span className="text-emerald-400 font-extrabold">Band Checkpoint ({currentUnit.wordIds.length} từ)</span>.</>
                )
              ) : (
                <>Tuyệt vời! Bạn đã hoàn thành xuất sắc toàn bộ lộ trình học. Hiện có <span className="text-blue-400 font-extrabold">{dueCount} từ cũ</span> đến hạn ôn tập và <span className="text-slate-400 font-extrabold">{newCount} từ mới</span> tự do đang chờ.</>
              )}
            </p>
          </div>

          {/* Desktop/Tablet words preview list */}
          {currentUnit && wordsInUnit && wordsInUnit.length > 0 && (
            <div className="hidden md:block space-y-1.5 pt-1">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                <span>🎯</span> Mục tiêu từ vựng hôm nay:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                {wordsInUnit.map((w, idx) => {
                  const topic = getCleanTopic(w.topic || "");
                  const labelInfo = TOPIC_LABELS[topic] || { emoji: "🧭", vi: "Tổng hợp" };
                  return (
                    <span key={idx} className="text-[10px] font-bold px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-200 flex items-center gap-1">
                      <span>{labelInfo.emoji}</span>
                      <span>{w.word}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mobile Hero section content: Progress details, bar, and circles (Mobile < 768px) */}
          {currentUnit && (
            <div className="md:hidden space-y-4 pt-2 border-t border-slate-800/40">
              {/* Progress details */}
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">Tiến độ hôm nay</span>
                <span className="text-slate-350">{dailyCompletionPercentage}% ({startedWordsCount}/{wordsInUnit.length} từ)</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-500" 
                  style={{ width: `${dailyCompletionPercentage}%` }}
                />
              </div>

              {/* Study Flow Timeline Circles */}
              <div className="flex items-center justify-between px-1 py-2">
                {[
                  { id: "learn", label: "Learn", icon: BookOpen },
                  { id: "quiz", label: "Quiz", icon: Check },
                  { id: "speak", label: "Speak", icon: Mic },
                  { id: "shadow", label: "Shadow", icon: Volume2 },
                  { id: "review", label: "Review", icon: RefreshCw }
                ].map((step, idx) => {
                  // Compute state: completed, active, locked
                  const stepThreshold = (idx + 1) * 20;
                  const isCompleted = dailyCompletionPercentage >= stepThreshold;
                  const isActive = dailyCompletionPercentage >= (idx * 20) && dailyCompletionPercentage < stepThreshold;
                  
                  // Style configurations matching mockup
                  let circleClass = "";
                  let iconElement;

                  if (isCompleted) {
                    if (idx === 0) {
                      circleClass = "bg-white text-blue-600 border border-slate-200 shadow-sm";
                      iconElement = <BookOpen className="w-4.5 h-4.5 text-blue-600" />;
                    } else {
                      circleClass = "bg-white text-emerald-500 border border-emerald-500 shadow-sm";
                      iconElement = <Check className="w-4.5 h-4.5 text-emerald-500 stroke-[3px]" />;
                    }
                  } else if (isActive) {
                    circleClass = "bg-white text-amber-500 border-2 border-amber-500 shadow-md ring-4 ring-amber-500/10";
                    iconElement = <step.icon className="w-4.5 h-4.5 text-amber-500" />;
                  } else {
                    circleClass = "bg-white/10 text-white/35 border border-white/5";
                    iconElement = <step.icon className="w-4.5 h-4.5 text-white/35" />;
                  }

                  return (
                    <React.Fragment key={step.id}>
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${circleClass}`}>
                          {iconElement}
                        </div>
                      </div>
                      {idx < 4 && (
                        <div className="text-slate-700 text-xs font-mono font-bold">&rarr;</div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Unified Primary CTA on the Right (hidden on mobile, shown on md:) */}
        <div className="hidden md:flex relative z-10 flex-col justify-center items-stretch sm:items-start lg:items-end shrink-0 gap-3">
          <button
            onClick={() => {
              if (currentUnit) {
                setActiveLessonUnit(currentUnit);
              } else {
                onQuickPractice("srs", "due");
              }
            }}
            className="w-full lg:w-auto px-7 py-4.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 hover:scale-102 active:scale-98 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white stroke-white" />
            <span>
              {currentUnit ? "Bắt đầu Nhiệm Vụ Hôm Nay" : "Luyện Tập Ôn Tập Từ Vựng"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <div className="text-[10px] font-bold text-slate-400 flex items-center justify-center lg:justify-end gap-1.5 self-center lg:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Lộ trình cá nhân hóa đồng bộ Database
          </div>
        </div>

        {/* Mobile Large CTA: Continue Learning (shown only on mobile < 768px) */}
        <div className="md:hidden relative z-10 w-full">
          <button
            onClick={() => {
              if (currentUnit) {
                setActiveLessonUnit(currentUnit);
              } else {
                onQuickPractice("srs", "due");
              }
            }}
            className="w-full py-4.5 bg-white hover:bg-slate-50 text-blue-600 font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-md active:scale-98 transition-all cursor-pointer"
          >
            <span>Continue Learning</span>
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        
        {/* CARD 1: Learning Progress (5 columns) */}
        <div className="md:col-span-1 lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Learning Progress
            </h3>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Estimated: Band {estimatedBand}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center py-2">
            
            {/* Large Circular SVG Progress */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  className="stroke-slate-100"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="72"
                  className="stroke-blue-600 transition-all duration-1000"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 72}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="rounded"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-800 tracking-tight">
                  {displayPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Words Learned
                </span>
                <span className="text-xxs text-slate-500 font-semibold mt-1">
                  {displayWordsLearned} / {stats.total}
                </span>
              </div>
            </div>

            {/* Right Roadmaps */}
            <div className="flex-1 space-y-4 w-full">
              <div className="space-y-1">
                <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase">
                  <span>Band 0.0 - 4.0</span>
                  <span className="text-slate-600">{bandProgress.b1.learned} / {bandProgress.b1.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${bandProgress.b1.percent}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase">
                  <span>Band 4.5 - 5.5</span>
                  <span className="text-slate-600">{bandProgress.b2.learned} / {bandProgress.b2.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${bandProgress.b2.percent}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xxs font-bold text-slate-400 uppercase">
                  <span>Band 6.0 - 6.5</span>
                  <span className="text-slate-600">{bandProgress.b3.learned} / {bandProgress.b3.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${bandProgress.b3.percent}%` }} />
                </div>
              </div>
            </div>

          </div>

          <p className="text-xxs text-slate-400 leading-relaxed pt-2 border-t border-slate-50">
            🎯 Mục tiêu IELTS Band 6.5 cần học toàn bộ kho từ vựng cốt lõi ({stats.total} từ). Hãy bền bỉ học đều đặn mỗi ngày!
          </p>
        </div>

        {/* CARD 3: Learning Streak GitHub heatmap (4 columns) */}
        <div className="md:col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              Streak & Activity
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Lịch sử rèn luyện Spaced Repetition của bạn</p>
          </div>

          {/* GitHub-style Heatmap Component */}
          <div className="space-y-3 py-1">
            <div className="flex justify-between items-center text-xxs text-slate-400 font-bold mb-1">
              <span>Thứ</span>
              <div className="flex gap-4">
                <span>T2</span>
                <span>T4</span>
                <span>T6</span>
                <span>CN</span>
              </div>
            </div>

            <div className="space-y-2">
              {heatmapData.map((row, rIdx) => (
                <div key={rIdx} className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">{row.label}</span>
                  <div className="flex gap-1.5 flex-1 justify-end">
                    {row.squares.map((sq, sIdx) => {
                      let bgClass = "bg-slate-100";
                      if (sq.level === 1) bgClass = "bg-emerald-100";
                      else if (sq.level === 2) bgClass = "bg-emerald-300";
                      else if (sq.level === 3) bgClass = "bg-emerald-500";
                      else if (sq.level === 4) bgClass = "bg-emerald-700";

                      return (
                        <div
                          key={sIdx}
                          className={`w-4 h-4 rounded-xs ${bgClass} transition-colors cursor-help`}
                          title={`${sq.date}: Đã luyện ${sq.count} từ`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend indicator */}
            <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-semibold pt-2">
              <span>Ít học</span>
              <div className="w-2.5 h-2.5 bg-slate-100 rounded-xs" />
              <div className="w-2.5 h-2.5 bg-emerald-100 rounded-xs" />
              <div className="w-2.5 h-2.5 bg-emerald-300 rounded-xs" />
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
              <div className="w-2.5 h-2.5 bg-emerald-700 rounded-xs" />
              <span>Nhiều</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xxs">
            <span className="font-bold text-slate-600">Streak: {streak.currentStreak} Days 🔥</span>
            <span className="text-slate-400">Kỷ lục: {streak.longestStreak} Days 🏆</span>
          </div>
        </div>

        {/* CARD 2: Today's Review Checklist (3 columns) */}
        <div className="md:col-span-1 lg:col-span-3 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Hôm nay
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Nhiệm vụ học tập cần hoàn tất</p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Ôn tập</p>
                  <p className="text-[10px] text-slate-400">{dueCount} từ đến hạn</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700">{dueCount}</span>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Từ mới</p>
                  <p className="text-[10px] text-slate-400">{newCount} từ chưa học</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700">{newCount}</span>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Luyện tập</p>
                  <p className="text-[10px] text-slate-400">Nghe & viết chính tả</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700">15m</span>
            </div>
          </div>

          <button
            onClick={() => onQuickPractice("srs", "due")}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            Bắt đầu học ngay <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* CARD 4: Quick Practice 4 Equal subcards (12 columns full width row) */}
        <div className="md:col-span-2 lg:col-span-12 space-y-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Quick Practice</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Flashcards",
                desc: "Học từ bằng thẻ nhớ thông minh",
                color: "bg-blue-50 text-blue-600 border-blue-100",
                icon: Layers,
                mode: "srs" as const,
                type: "all" as const
              },
              {
                title: "Nghe & Chọn nghĩa",
                desc: "Nghe từ và chọn nghĩa đúng",
                color: "bg-teal-50 text-teal-600 border-teal-100",
                icon: Volume2,
                mode: "quiz" as const
              },
              {
                title: "Điền từ vào chỗ trống",
                desc: "Luyện tập với câu ví dụ",
                color: "bg-emerald-50 text-emerald-600 border-emerald-100",
                icon: FileText,
                mode: "fill-blank" as const
              },
              {
                title: "Nối từ & Collocations",
                desc: "Học cụm từ và collocations",
                color: "bg-rose-50 text-rose-600 border-rose-100",
                icon: Sparkles,
                mode: "quiz" as const
              }
            ].map((practice, idx) => (
              <div
                key={idx}
                onClick={() => onQuickPractice(practice.mode, (practice as any).type)}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xxs hover:shadow-md hover:-translate-y-1 hover:border-slate-300 transition-all cursor-pointer flex items-center gap-4 group"
              >
                <div className={`p-3 rounded-xl border ${practice.color} group-hover:scale-105 transition-transform`}>
                  <practice.icon className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                    {practice.title}
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{practice.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 5: Today's Vocabulary Table (8 columns) */}
        <div className="md:col-span-2 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Từ vựng mới hôm nay
            </h3>
            <button
              onClick={() => setActiveTab("library")}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop/Tablet Table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xxs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Word</th>
                  <th className="pb-3">IPA</th>
                  <th className="pb-3">Part of Speech</th>
                  <th className="pb-3">Meaning</th>
                  <th className="pb-3">Band</th>
                  <th className="pb-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-medium">
                {todaysVocabulary.map((word) => {
                  const isFav = progress[word.id]?.isStarred;
                  const bandLabel = formatIELTSBand(word.band);
                  const bandColor = word.band === "0.0-4.0" ? "bg-blue-50 text-blue-600 border-blue-100" : word.band === "4.5-5.5" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100";

                  return (
                    <tr 
                      key={word.id} 
                      onClick={() => handleRowClick(word)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 pl-2 font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {word.word}
                      </td>
                      <td className="py-3.5 text-slate-400 font-mono tracking-wide">
                        {word.ipa}
                      </td>
                      <td className="py-3.5 text-slate-400 italic">
                        {word.band === "0.0-4.0" ? "v." : word.band === "4.5-5.5" ? "adj." : "n."}
                      </td>
                      <td className="py-3.5 text-slate-600 font-bold max-w-[180px] truncate">
                        {word.meaning}
                      </td>
                      <td className="py-3.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${bandColor}`}>
                          {bandLabel}
                        </span>
                      </td>
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => speak(e, word.word)}
                            className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => toggleFav(e, word.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isFav 
                                ? "bg-amber-50 text-amber-500 border-amber-200" 
                                : "bg-slate-50 text-slate-300 hover:text-amber-500 hover:border-amber-200 border-slate-200"
                            }`}
                            title="Yêu thích"
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400" : ""}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table fallback cards for Mobile (< 768px) */}
          <div className="md:hidden space-y-3.5">
            {todaysVocabulary.map((word) => {
              const p = progress[word.id];
              const isFav = p?.isStarred;
              const status = p?.status || "new";
              const mastery = status === "mastered" ? 100 : status === "learning" ? 50 : 0;
              
              return (
                <div
                  key={word.id}
                  onClick={() => handleRowClick(word)}
                  className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xxs cursor-pointer flex flex-col gap-3.5 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{word.word}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{word.ipa}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {word.band === "0.0-4.0" ? "v." : word.band === "4.5-5.5" ? "adj." : "n."} &bull; Topic: {word.topic}
                      </p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => speak(e, word.word)}
                        className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100/40 dark:border-indigo-900/30 cursor-pointer"
                        title="Nghe phát âm"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => toggleFav(e, word.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isFav 
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-500 border-amber-200" 
                            : "bg-slate-50 dark:bg-slate-850 text-slate-300 hover:text-amber-500 hover:border-amber-200 border-slate-200"
                        }`}
                        title="Yêu thích"
                      >
                        <Star className={`w-4 h-4 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-normal">{word.meaning}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                      <span>Mastery Progress</span>
                      <span className="font-extrabold text-slate-650 dark:text-slate-300">{mastery}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          status === "mastered" ? "bg-emerald-500" : status === "learning" ? "bg-blue-500" : "bg-slate-300"
                        }`} 
                        style={{ width: `${mastery}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 5b: Learning Reminders & Streak Guard (4 columns) */}
        <div className="md:col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-6" id="learning-reminders-card">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500 animate-swing" />
              Reminders & Streak Guard
            </h3>
            <p className="text-[11px] text-slate-400">Nhắc học thông minh bảo vệ chuỗi học tập</p>
          </div>

          <div className="space-y-4 flex-1">
            {/* Permission Status Button/Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Quyền thông báo:</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  notificationPermission === "granted" 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                    : notificationPermission === "denied"
                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                    : "bg-amber-50 text-amber-600 border border-amber-100"
                }`}>
                  {notificationPermission === "granted" ? "Đã cấp quyền" : notificationPermission === "denied" ? "Bị chặn" : "Chưa kích hoạt"}
                </span>
              </div>
              
              {notificationPermission !== "granted" && (
                <button
                  onClick={requestNotificationPermission}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xxs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Yêu cầu quyền đẩy thông báo
                </button>
              )}
            </div>

            {/* Daily Study Alarm Settings */}
            <div className="space-y-3.5">
              
              {/* Toggle Enable Daily Reminder */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700 block">Báo thức học tập</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Nhắc nhở tự động mỗi ngày</span>
                </div>
                <button
                  onClick={() => handleToggleNotificationSetting("enabled")}
                  className={`w-10 h-6 rounded-full p-0.5 transition-all ${
                    notificationSettings.enabled ? "bg-blue-600 flex justify-end" : "bg-slate-200 flex justify-start"
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-md block transition-transform" />
                </button>
              </div>

              {/* Select Reminder Hour */}
              {notificationSettings.enabled && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 animate-fadeIn">
                  <span className="text-xxs font-bold text-slate-500">Giờ nhắc học:</span>
                  <select
                    value={notificationSettings.reminderTime}
                    onChange={(e) => handleChangeReminderTime(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xxs font-black text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  >
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hourStr = h < 10 ? `0${h}:00` : `${h}:00`;
                      return (
                        <option key={hourStr} value={hourStr}>
                          {hourStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Toggle Review Alert */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700 block">Cảnh báo từ đến hạn ôn</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Báo khi có từ vựng cần học lại</span>
                </div>
                <button
                  onClick={() => handleToggleNotificationSetting("reviewAlert")}
                  className={`w-10 h-6 rounded-full p-0.5 transition-all ${
                    notificationSettings.reviewAlert ? "bg-blue-600 flex justify-end" : "bg-slate-200 flex justify-start"
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-md block transition-transform" />
                </button>
              </div>

              {/* Toggle Streak Protection (Bảo vệ streak) */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700 block">Streak Guard 🔥</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Cảnh báo mất Streak lúc 21h00</span>
                </div>
                <button
                  onClick={() => handleToggleNotificationSetting("streakGuard")}
                  className={`w-10 h-6 rounded-full p-0.5 transition-all ${
                    notificationSettings.streakGuard ? "bg-blue-600 flex justify-end" : "bg-slate-200 flex justify-start"
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-md block transition-transform" />
                </button>
              </div>

            </div>
          </div>

          <button
            onClick={triggerTestNotification}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xxs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            Kiểm tra thông báo (Test Alert)
          </button>
        </div>

        {/* Extended Stats Collapsible Toggle */}
        <div className="col-span-12 lg:col-span-12 flex justify-center py-2">
          <button
            onClick={() => setShowExtendedStats(!showExtendedStats)}
            className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xxs transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-500" />
            {showExtendedStats ? "Thu gọn phân tích năng lực & thành tích" : "Xem thêm phân tích năng lực, thành tích & mục tiêu"}
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showExtendedStats ? "rotate-90" : ""}`} />
          </button>
        </div>

        {showExtendedStats && (
          <>
            {/* CARD 6: Topic Progress Doughnut Chart (4 columns) */}
        <div className="md:col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Tiến độ theo chủ đề
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Xem tất cả</span>
          </div>

          <div className="h-44 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {topicChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "#0f172a", border: "none", borderRadius: "12px", color: "#fff" }}
                  itemStyle={{ color: "#fff", fontSize: "11px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-lg font-black text-slate-800">{topicChartData.length} Topics</span>
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Học thuật</span>
            </div>
          </div>

          {/* Custom Legends */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 border-t border-slate-50 pt-3">
            {topicChartData.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.name}</span>
                <span className="text-slate-400 ml-auto">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 7: Words Needing Review Horizontal List (8 columns) */}
        <div className="md:col-span-2 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin-slow" />
              Từ cần ôn tập ({dueCount})
            </h3>
            <button
              onClick={() => onQuickPractice("srs", "due")}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xxs font-black rounded-lg transition-colors cursor-pointer"
            >
              Ôn tập ngay
            </button>
          </div>

          {/* Scrollable list of cards */}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {wordsNeedingReview.map((word, idx) => {
              const ratingLabels = ["Again", "Hard", "Good", "Easy"];
              const randomRatingIdx = (idx % 3); // Seed deterministic ratings
              const ratingLabel = ratingLabels[randomRatingIdx];
              const ratingColors = [
                "bg-red-50 text-red-600 border-red-100",
                "bg-amber-50 text-amber-600 border-amber-100",
                "bg-blue-50 text-blue-600 border-blue-100"
              ][randomRatingIdx];

              return (
                <div
                  key={word.id}
                  onClick={() => handleRowClick(word)}
                  className="bg-slate-50 hover:bg-slate-100/70 p-4 rounded-2xl border border-slate-200/50 shrink-0 w-44 hover:scale-102 transition-all cursor-pointer flex flex-col justify-between space-y-3"
                >
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800 tracking-tight">{word.word}</h5>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{word.ipa}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${ratingColors}`}>
                      {ratingLabel}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickPractice("srs", "all", word);
                      }}
                      className="text-[9px] font-black text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Luyện tập →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 8: Band Prediction Line Chart (4 columns) */}
        <div className="md:col-span-1 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Ước lượng band từ vựng
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Cập nhật hôm nay</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              {estimatedBand}
            </span>
            <span className="text-xs font-bold text-slate-400">Current Band</span>
            <span className="text-xxs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full ml-auto">
              Target 6.5
            </span>
          </div>

          {/* Area Chart prediction */}
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bandChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis domain={[3.5, 7.0]} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                  labelStyle={{ fontSize: "10px", fontWeight: "bold" }}
                  itemStyle={{ fontSize: "10px", color: "#2563EB" }}
                />
                <Area type="monotone" dataKey="band" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorBand)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CARD 9: Achievements (6 columns) */}
        <div className="md:col-span-1 lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Achievements
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Huy hiệu xuất sắc chinh phục IELTS Vocab</p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-1">
            {achievementsList.map((badge, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-2xl border flex flex-col justify-between space-y-1.5 transition-all ${
                  badge.checked ? "bg-white border-slate-200" : "bg-slate-50/50 border-slate-100 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-800">{badge.title}</span>
                  {badge.checked ? (
                    <span className="w-4 h-4 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-[8px] font-black">✓</span>
                  ) : (
                    <span className="w-4 h-4 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-[8px] font-black">+</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-medium leading-tight">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 10: Upcoming Goal progress (6 columns) */}
        <div className="md:col-span-1 lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              Mục tiêu học tập
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Theo dõi tiến độ hoàn thiện mục tiêu cá nhân</p>
          </div>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xxs font-bold text-slate-500">
                <span>Today&apos;s Goal (20 Words)</span>
                <span className="text-emerald-600">
                  {todayCount} / 20 Words ({Math.min(100, Math.round((todayCount / 20) * 100))}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((todayCount / 20) * 100))}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xxs font-bold text-slate-500">
                <span>Weekly Goal (150 Words)</span>
                <span className="text-blue-600">
                  {weeklyCount} / 150 Words ({Math.min(100, Math.round((weeklyCount / 150) * 100))}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((weeklyCount / 150) * 100))}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xxs font-bold text-slate-500">
                <span>Monthly Goal (600 Words)</span>
                <span className="text-indigo-600">
                  {monthlyCount} / 600 Words ({Math.min(100, Math.round((monthlyCount / 600) * 100))}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((monthlyCount / 600) * 100))}%` }} />
              </div>
            </div>
          </div>
        </div>
          </>
        )}

      </div>

      {/* Delete / Reset button styled nicely at the bottom */}
      <div className="flex justify-center pt-4 border-t border-slate-100">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="text-xxs font-extrabold text-red-500 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 animate-spin-slow" /> Reset Learning Progress
        </button>
      </div>

      {/* Custom Secure Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-2xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Xác nhận xóa tiến trình</h3>
                  <p className="text-xxs text-red-500 font-bold uppercase tracking-wider">Hành động không thể hoàn tác</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium space-y-2">
                <p>Bạn có chắc chắn muốn xóa <strong>TOÀN BỘ</strong> tiến trình học tập, lịch sử luyện tập từ vựng, Sổ Tay Lỗi Sai và reset lộ trình về mặc định?</p>
                <p className="bg-rose-50/50 dark:bg-rose-950/10 p-2.5 rounded-xl border border-rose-100/30 dark:border-rose-900/20 text-[11px] font-semibold text-rose-500">
                  ⚠️ Lưu ý: Toàn bộ tiến độ và lịch sử trên đám mây của bạn sẽ bị xóa vĩnh viễn khỏi hệ thống.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl text-xs font-black text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    onResetProgress();
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 active:scale-99 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-md shadow-red-500/10"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Word Details Modal for fully integrated interactive rows */}
      <AnimatePresence>
        {activeWordModal && (
          (() => {
            const activeEnriched = getEnrichedWord(activeWordModal);
            
            return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: "spring", duration: 0.4 }}
                  className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[85vh] border border-slate-200 text-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Banner-style Header */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
                    <div className="space-y-2 pr-8">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase bg-blue-600 text-white px-2.5 py-0.5 rounded-md border border-blue-500">
                          {formatIELTSBand(activeEnriched.band)}
                        </span>
                        <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2.5 py-0.5 rounded-md border border-indigo-500">
                          Chủ đề: {activeEnriched.topic}
                        </span>
                        {activeEnriched.awlLevel !== "N/A" && (
                          <span className="text-[10px] font-black uppercase bg-emerald-600 text-white px-2.5 py-0.5 rounded-md border border-emerald-500">
                            AWL: {activeEnriched.awlLevel}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3.5 mt-1">
                        <h3 className="text-3xl font-black text-white tracking-tight">
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

                    {/* Speaker pronunciation options */}
                    <div className="absolute right-6 bottom-6 flex items-center gap-2">
                      <button
                        onClick={() => onToggleStar(activeEnriched.id)}
                        className={`p-2 rounded-xl transition-all border ${
                          progress[activeEnriched.id]?.isStarred
                            ? "bg-amber-500 text-white border-amber-400 shadow-md"
                            : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                        }`}
                        title="Lưu vào Sổ từ vựng"
                      >
                        <Star className={`w-4 h-4 ${progress[activeEnriched.id]?.isStarred ? "fill-white" : ""}`} />
                      </button>
                      <button
                        onClick={() => speakWordText(activeEnriched.word, "en-US")}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 border border-indigo-400 shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1 text-xs font-bold"
                        title="Nghe phát âm chuẩn Mỹ"
                      >
                        <Volume2 className="w-4 h-4" /> US
                      </button>
                      <button
                        onClick={() => speakWordText(activeEnriched.word, "en-GB")}
                        className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 border border-slate-700 shadow-md transition-all flex items-center gap-1 text-xs font-bold"
                        title="Nghe phát âm chuẩn Anh"
                      >
                        <Volume2 className="w-4 h-4" /> UK
                      </button>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={() => setActiveWordModal(null)}
                      className="absolute right-4 top-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 📑 TAB NAVIGATION FOR LEXICOGRAPHICAL META-DATA */}
                  <div className="bg-slate-50 border-b border-slate-200/60 px-6 py-2 flex flex-wrap gap-1.5">
                    {[
                      { id: "overview", label: "Tổng quan & Từ loại", icon: BookOpen },
                      { id: "academic", label: "Học thuật & Từ đồng nghĩa", icon: Award },
                      { id: "examples", label: "Ví dụ 4 kỹ năng", icon: FileText },
                      { id: "mistakes", label: "Mẹo & Lỗi hay gặp", icon: Lightbulb },
                      { id: "related", label: "Hệ sinh thái từ", icon: Sparkles }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setModalTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          modalTab === tab.id
                            ? "bg-white text-indigo-600 shadow-xs border border-slate-200/50"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Modal Body (Scrollable Workspace) */}
                  <div className="p-6 overflow-y-auto space-y-6 text-slate-700 max-h-[50vh] text-xs">
                    
                    {/* 🏷️ TAB 1: OVERVIEW */}
                    {modalTab === "overview" && (
                      <div className="space-y-4">
                        {/* Definition Card */}
                        <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60 space-y-2 text-xs">
                          <div className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Nghĩa Việt & Định nghĩa chính:</div>
                          <p className="text-base font-black text-indigo-950 leading-relaxed">
                            {activeEnriched.meaning}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed italic">
                            &ldquo;{activeEnriched.longDefinition}&rdquo;
                          </p>
                        </div>

                        {/* Word Level statistics / bento grid style */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Nguồn cấp độ:</span>
                            <span className="text-xs font-extrabold text-slate-800">{activeEnriched.oxfordLevel}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/50 space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Khung CEFR:</span>
                            <span className="text-xs font-black text-indigo-600 uppercase">{activeEnriched.cefr} Level</span>
                          </div>
                        </div>

                        {/* Word Family list */}
                        {Object.keys(activeEnriched.wordFamily).length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Gia đình từ vựng (Word Family):</span>
                            <div className="grid grid-cols-2 gap-2.5">
                              {Object.entries(activeEnriched.wordFamily).map(([key, val]) => (
                                <div key={key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                                  <span className="text-slate-400 font-bold capitalize">{key}:</span>
                                  <span className="font-extrabold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => speakWordText(val || "", accent)}>
                                    {val}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collocations */}
                        <div className="space-y-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Collocations khuyên dùng cho IELTS:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeEnriched.collocations.map((col, idx) => (
                              <span 
                                key={idx} 
                                onClick={() => speakWordText(col, accent)}
                                className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> {col}
                                </span>
                                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 🏆 TAB 2: ACADEMIC & SYNONYMS */}
                    {modalTab === "academic" && (
                      <div className="space-y-5">
                        {/* Synonyms grouped by IELTS Band */}
                        <div className="space-y-3">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Từ đồng nghĩa phân cấp IELTS Band:</span>
                          <div className="space-y-2.5">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/40 flex items-start gap-4">
                              <span className="text-[10px] font-black bg-slate-300 text-slate-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Band 4.0</span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeEnriched.synonymsGrouped.band4.map((syn, i) => (
                                  <button key={i} onClick={() => {
                                    const found = words.find(w => w.word.toLowerCase() === syn.toLowerCase());
                                    if (found) { setActiveWordModal(found); setModalTab("overview"); }
                                    speakWordText(syn, accent);
                                  }} className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200">
                                    {syn}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/40 flex items-start gap-4">
                              <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Band 5.5</span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeEnriched.synonymsGrouped.band5.map((syn, i) => (
                                  <button key={i} onClick={() => {
                                    const found = words.find(w => w.word.toLowerCase() === syn.toLowerCase());
                                    if (found) { setActiveWordModal(found); setModalTab("overview"); }
                                    speakWordText(syn, accent);
                                  }} className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200">
                                    {syn}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/40 flex items-start gap-4">
                              <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Band 6.5+</span>
                              <div className="flex flex-wrap gap-1.5">
                                {activeEnriched.synonymsGrouped.band6.map((syn, i) => (
                                  <button key={i} onClick={() => {
                                    const found = words.find(w => w.word.toLowerCase() === syn.toLowerCase());
                                    if (found) { setActiveWordModal(found); setModalTab("overview"); }
                                    speakWordText(syn, accent);
                                  }} className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:text-indigo-600 hover:border-indigo-200 animate-pulse">
                                    {syn}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Antonyms */}
                        <div className="space-y-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Từ trái nghĩa (Antonyms):</span>
                          <div className="flex flex-wrap gap-2">
                            {activeEnriched.antonyms.map((ant, idx) => (
                              <span key={idx} className="bg-red-50 text-red-800 border border-red-100 px-3 py-1.5 rounded-xl text-xs font-bold">
                                &ne; {ant}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Academic common phrases */}
                        <div className="space-y-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Cụm từ liên kết hữu ích (Useful Phrases):</span>
                          <div className="space-y-2">
                            {activeEnriched.commonPhrases.map((phrase, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => speakWordText(phrase, accent)}
                                className="bg-slate-50 hover:bg-slate-100 border border-slate-100 p-3 rounded-xl flex items-center justify-between text-xs font-bold cursor-pointer transition-colors"
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
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Ví dụ phân chia 4 kỹ năng chuẩn đề thi:</span>
                        
                        {/* Speaking Card */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 space-y-2 relative">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                            <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Speaking Context</span>
                            <button onClick={() => speakWordText(activeEnriched.ieltsExamples.speaking, "en-US")} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" /> Nghe
                            </button>
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.speaking}&rdquo;</p>
                          <p className="text-[11px] text-slate-400 italic pl-2 border-l-2 border-indigo-200">{activeEnriched.ieltsExamples.speakingTranslation}</p>
                        </div>

                        {/* Writing Task 2 Card */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 space-y-2 relative">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Writing Task 2 Context</span>
                            <button onClick={() => speakWordText(activeEnriched.ieltsExamples.writing, "en-US")} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" /> Nghe
                            </button>
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.writing}&rdquo;</p>
                          <p className="text-[11px] text-slate-400 italic pl-2 border-l-2 border-indigo-200">{activeEnriched.ieltsExamples.writingTranslation}</p>
                        </div>

                        {/* Listening Card */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 space-y-2 relative">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                            <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Listening Lecture Context</span>
                            <button onClick={() => speakWordText(activeEnriched.ieltsExamples.listening, "en-US")} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" /> Nghe
                            </button>
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.listening}&rdquo;</p>
                          <p className="text-[11px] text-slate-400 italic pl-2 border-l-2 border-indigo-200">{activeEnriched.ieltsExamples.listeningTranslation}</p>
                        </div>

                        {/* Reading Card */}
                        <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 space-y-2 relative">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                            <span className="text-[10px] font-black bg-purple-50 text-purple-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">Reading Academic Text</span>
                            <button onClick={() => speakWordText(activeEnriched.ieltsExamples.reading, "en-US")} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" /> Nghe
                            </button>
                          </div>
                          <p className="text-xs font-extrabold text-slate-800 leading-relaxed">&ldquo;{activeEnriched.ieltsExamples.reading}&rdquo;</p>
                          <p className="text-[11px] text-slate-400 italic pl-2 border-l-2 border-indigo-200">{activeEnriched.ieltsExamples.readingTranslation}</p>
                        </div>
                      </div>
                    )}

                    {/* 💡 TAB 4: MISTAKES & MEMORY */}
                    {modalTab === "mistakes" && (
                      <div className="space-y-4">
                        {/* Common Mistakes */}
                        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 space-y-3">
                          <div className="text-xs font-black text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-500 animate-bounce" /> Lỗi sai thường gặp của người Việt (Vietnamese Learner Mistakes):
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs text-rose-950 font-extrabold bg-rose-100/60 p-2 rounded-lg">
                              ❌ Viết sai: <span className="font-mono">{activeEnriched.commonMistakes.mistake}</span>
                            </p>
                            <p className="text-xs text-emerald-950 font-extrabold bg-emerald-100/60 p-2 rounded-lg mt-1.5">
                              ✅ Viết đúng: <span className="font-mono">{activeEnriched.commonMistakes.correct}</span>
                            </p>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed pl-2 border-l-2 border-rose-200 pt-1">
                            <strong>Giải thích chi tiết:</strong> {activeEnriched.commonMistakes.explanation}
                          </p>
                        </div>

                        {/* Memory Tip Card */}
                        <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/60 space-y-2.5">
                          <div className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <Lightbulb className="w-4 h-4 text-amber-500" /> Mẹo ghi nhớ siêu tốc (Mnemonic Memory Tip):
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-100/60 border border-slate-200/40 px-1.5 py-0.5 rounded-sm normal-case tracking-normal">
                              Nội dung minh hoạ, tạo bởi AI
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-800 leading-relaxed font-semibold">
                            {activeEnriched.memoryTip.mnemonic}
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 text-xxs font-bold text-slate-500 border-t border-amber-100/50">
                            <div>
                              <span className="block uppercase text-slate-400">Từ gốc (Root):</span>
                              <span className="text-slate-700">{activeEnriched.memoryTip.root}</span>
                            </div>
                            <div>
                              <span className="block uppercase text-slate-400">Tiền tố / Hậu tố:</span>
                              <span className="text-slate-700">{activeEnriched.memoryTip.prefixSuffix}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 🕸️ TAB 5: RELATED WORDS ECOSYSTEM (NETWORK) */}
                    {modalTab === "related" && (
                      <div className="space-y-4">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">
                          Hệ sinh thái từ vựng liên quan (Click để chuyển đổi từ details):
                        </span>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {activeEnriched.relatedWords.map((name, index) => {
                            const isExistInSeed = words.some(w => w.word.toLowerCase() === name.toLowerCase());
                            
                            return (
                              <button
                                key={index}
                                onClick={() => {
                                  const found = words.find(w => w.word.toLowerCase() === name.toLowerCase());
                                  if (found) {
                                    setActiveWordModal(found);
                                    setModalTab("overview");
                                  }
                                  speakWordText(name, accent);
                                }}
                                className={`p-3.5 rounded-2xl border text-xs font-extrabold text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer ${
                                  isExistInSeed
                                    ? "bg-indigo-50/50 text-indigo-950 border-indigo-200/50 hover:bg-indigo-100 hover:scale-103 shadow-xxs"
                                    : "bg-slate-50 text-slate-500 border-slate-200/50 hover:bg-slate-100 hover:text-slate-800"
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

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50 text-xxs text-slate-400 leading-normal flex items-start gap-1.5 font-semibold">
                          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>
                            Các từ vựng được liên kết với nhau theo hệ phân cấp ngữ nghĩa (Semantic mapping). Bấm chọn các từ có màu Indigo để xem chi tiết hoặc từ màu Xám để phát âm luyện nói.
                          </span>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Modal Footer */}
                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-3 justify-end rounded-b-3xl">
                    <button
                      onClick={() => setActiveWordModal(null)}
                      className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={() => {
                        setActiveWordModal(null);
                        onQuickPractice("srs", "all", activeWordModal);
                      }}
                      className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
                    >
                      Bắt đầu học (SRS) <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()
        )}
      </AnimatePresence>

    </div>
  );
}
