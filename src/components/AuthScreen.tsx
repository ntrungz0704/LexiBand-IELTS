/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  BookOpen, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  Sparkles, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { 
  auth, 
  saveUserProfile,
  resetUserAllData,
  signUpCustomUser,
  signInCustomUser
} from "../utils/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from "firebase/auth";
import { motion } from "motion/react";
import firebaseConfig from "../../firebase-applet-config.json";

interface AuthScreenProps {
  onAuthSuccess: (userId: string, email: string, displayName: string) => void;
  isDarkMode?: boolean;
}

export default function AuthScreen({ onAuthSuccess, isDarkMode }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getErrorMessage = (code: string, rawMessage?: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "Địa chỉ email không hợp lệ.";
      case "auth/user-disabled":
        return "Tài khoản này đã bị vô hiệu hóa.";
      case "auth/user-not-found":
        return "Không tìm thấy tài khoản với email này. Vui lòng kiểm tra lại email hoặc bấm Đăng ký ngay.";
      case "auth/wrong-password":
        return "Mật khẩu không chính xác hoặc tài khoản này chưa được thiết lập mật khẩu (Nếu trước đây đăng nhập bằng Google, hãy bấm 'Quên mật khẩu?' bên dưới để đặt mật khẩu).";
      case "auth/email-already-in-use":
        return "Địa chỉ email đã được sử dụng bởi một tài khoản khác. Nếu trước đây bạn đã đăng nhập bằng Google với email này, vui lòng nhập email và bấm 'Quên mật khẩu?' để nhận link tạo mật khẩu và tiếp tục sử dụng!";
      case "auth/weak-password":
        return "Mật khẩu quá yếu (tối thiểu phải có 6 ký tự).";
      case "auth/operation-not-allowed":
        return "Phương thức đăng nhập này chưa được kích hoạt trong Firebase Console.";
      default:
        return `Thất bại (${code || "unknown"}). Chi tiết: ${rawMessage || "Vui lòng thử lại sau."}`;
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!isLogin && !displayName.trim()) {
      setError("Vui lòng nhập họ và tên.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Sign In
        try {
          const credential = await signInWithEmailAndPassword(auth, email, password);
          const user = credential.user;
          onAuthSuccess(user.uid, user.email || "", user.displayName || "Học viên LexiBand");
        } catch (firebaseErr: any) {
          console.warn("Standard Firebase sign-in failed, checking custom Firestore database:", firebaseErr);
          
          // Fallback to custom user registry if provider is disabled in Firebase console or user not found
          if (
            firebaseErr.code === "auth/operation-not-allowed" || 
            firebaseErr.code === "auth/unsupported-tenant-operation" ||
            firebaseErr.code === "auth/invalid-api-key" ||
            firebaseErr.code === "auth/user-not-found"
          ) {
            const customUser = await signInCustomUser(email, password);
            localStorage.setItem("lexiband_custom_user", JSON.stringify(customUser));
            onAuthSuccess(customUser.uid, customUser.email, customUser.displayName);
          } else {
            throw firebaseErr;
          }
        }
      } else {
        // Sign Up
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          const user = credential.user;
          
          // Update user display name in firebase auth
          await updateProfile(user, {
            displayName: displayName
          });

          // Save profile data to Firestore
          await saveUserProfile(user.uid, {
            email: user.email || "",
            displayName: displayName,
            createdAt: new Date().toISOString()
          });

          onAuthSuccess(user.uid, user.email || "", displayName);
        } catch (firebaseErr: any) {
          console.warn("Standard Firebase sign-up failed, using custom Firestore database:", firebaseErr);
          
          if (
            firebaseErr.code === "auth/operation-not-allowed" || 
            firebaseErr.code === "auth/unsupported-tenant-operation" ||
            firebaseErr.code === "auth/invalid-api-key"
          ) {
            const customUser = await signUpCustomUser(email, password, displayName);
            localStorage.setItem("lexiband_custom_user", JSON.stringify(customUser));
            onAuthSuccess(customUser.uid, customUser.email, customUser.displayName);
          } else {
            throw firebaseErr;
          }
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(getErrorMessage(err.code || "", err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Vui lòng nhập địa chỉ email của bạn vào ô Email trước, sau đó bấm 'Quên mật khẩu?'.");
      setSuccessMessage(null);
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage(`Hệ thống đã gửi link đổi mật khẩu đến email: ${email}. Vui lòng kiểm tra hộp thư của bạn (hộp thư đến, quảng cáo, hoặc thư rác/spam).`);
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(getErrorMessage(err.code || "", err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setError(null);
    setSuccessMessage(null);
    
    const guestUID = "guest_user";
    const guestEmail = "guest@lexiband.com";
    const guestName = "Học viên Khách";
    
    localStorage.setItem("lexiband_guest_user", JSON.stringify({
      uid: guestUID,
      email: guestEmail,
      displayName: guestName
    }));
    
    setSuccessMessage("Đăng nhập Chế độ Khách (Offline/Local) thành công! Đang chuyển hướng...");
    
    setTimeout(() => {
      onAuthSuccess(guestUID, guestEmail, guestName);
    }, 1200);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      {/* Background aesthetic decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-8 rounded-3xl shadow-xl z-10 space-y-6"
      >
        {/* App Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-3.5 rounded-2xl text-white shadow-md shadow-blue-500/10">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
              LexiBand <span className="text-[10px] bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-black border border-blue-100 dark:border-blue-800">IELTS</span>
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">Cơ sở dữ liệu đám mây cá nhân hóa</p>
          </div>
        </div>

        {/* Display Error if any */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3.5 rounded-2xl text-xs text-rose-600 dark:text-rose-400 font-medium w-full"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <span className="block font-bold">{error}</span>
            </div>
          </motion.div>
        )}

        {/* Display Success Message if any */}
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 font-medium w-full"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div className="space-y-1 w-full text-emerald-700 dark:text-emerald-300">
              <span className="block font-bold">{successMessage}</span>
            </div>
          </motion.div>
        )}

        {/* Input Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xxs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Họ và Tên</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  required={!isLogin}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xxs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="ten@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xxs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mật khẩu</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xxs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer focus:outline-hidden"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-99 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? "Đăng nhập ngay" : "Tạo tài khoản"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Informational banner about Google Auth Removal */}
        <div className="bg-blue-50/20 dark:bg-blue-950/10 border border-blue-100/30 dark:border-blue-900/20 p-3.5 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <p className="font-extrabold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Thông báo nâng cấp hệ thống:
          </p>
          Để đảm bảo tính năng đăng nhập hoạt động ổn định 100% trên mọi thiết bị (bao gồm iPhone, Safari, Facebook, Zalo, v.v.) và trên mọi tên miền riêng, chúng tôi đã chuyển hoàn toàn sang phương thức <strong>Email & Mật khẩu</strong>. 
          <p className="mt-1.5 font-semibold text-slate-700 dark:text-slate-300">
            💡 <span className="font-bold text-blue-600 dark:text-blue-400">Nếu trước đây bạn đã từng đăng nhập bằng nút Google:</span> Đừng lo lắng! Bạn chỉ cần gõ địa chỉ email Google đó của bạn vào ô Email ở trên và nhấn nút <strong>"Quên mật khẩu?"</strong> để nhận link thiết lập mật khẩu riêng. Sau đó bạn có thể đăng nhập bình thường mà không bao giờ lo bị lỗi tên miền nữa!
          </p>
        </div>

        {/* Guest Mode / Trial Experience Button */}
        <div className="border border-slate-100 dark:border-slate-800 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
          <p className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            🌟 Bạn muốn học thử hoặc chia sẻ cho bạn bè?
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Sử dụng <strong>Chế độ Khách</strong> để trải nghiệm đầy đủ lộ trình học tập được lưu trữ an toàn riêng biệt trên thiết bị này mà không cần đăng nhập hay sợ bị trùng lặp tài khoản!
          </p>
          
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-black py-2.5 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
          >
            Vào Chế độ Khách (Học trải nghiệm ngay)
          </button>
        </div>

        {/* Toggle Mode */}
        <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
          {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-blue-600 dark:text-blue-400 font-extrabold hover:underline cursor-pointer ml-0.5"
          >
            {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </p>

      </motion.div>
    </div>
  );
}
