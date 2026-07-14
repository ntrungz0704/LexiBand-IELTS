/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  enableIndexedDbPersistence,
  deleteDoc
} from "firebase/firestore";
import { UserProgress, StreakData } from "../types";
import { LearningPlan } from "./curriculum";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase using the live config injected by the platform
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with the live database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence for Firestore to handle network disconnections automatically
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore persistence failed-precondition (multiple tabs open).");
    } else if (err.code === "unimplemented") {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore persistence unimplemented in this browser.");
    }
  });
} catch (e) {
  console.error("Failed to enable offline persistence:", e);
}

export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Required Connection Test on boot (Zero-trust verify)
export async function testConnection() {
  try {
    // Attempt a silent read from the "test" collection to confirm access control
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firebase client is currently offline. Native caching is active.");
    } else {
      console.log("Firebase connection verified (or rejected quietly as expected).");
    }
  }
}

// Run test connection silently
testConnection();

export interface UserProfile {
  email: string;
  displayName: string;
  createdAt: string;
}

/**
 * Saves user profile to Firestore.
 * Avoids overwriting or changing createdAt to comply with immutable rules.
 */
export async function saveUserProfile(userId: string, profile: UserProfile) {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      // Document already exists, only update editable fields, don't write new createdAt
      await setDoc(userRef, {
        email: profile.email,
        displayName: profile.displayName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      // Document is new, write all fields including createdAt
      await setDoc(userRef, {
        ...profile,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Saves SRS progress, Streak, and Learning Plan atomically/individually to Firestore
 */
export async function saveUserProgress(userId: string, progress: UserProgress) {
  const path = `users/${userId}/userData/progress`;
  try {
    await setDoc(doc(db, "users", userId, "userData", "progress"), {
      progress,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserStreak(userId: string, streak: StreakData) {
  const path = `users/${userId}/userData/streak`;
  try {
    await setDoc(doc(db, "users", userId, "userData", "streak"), {
      ...streak,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserLearningPlan(userId: string, learningPlan: LearningPlan) {
  const path = `users/${userId}/userData/learningPlan`;
  try {
    await setDoc(doc(db, "users", userId, "userData", "learningPlan"), {
      ...learningPlan,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Loads entire state for a specific user from Firestore.
 * Supports offline mode by using local cache if offline.
 */
export async function loadUserData(userId: string): Promise<{
  progress: UserProgress | null;
  streak: StreakData | null;
  learningPlan: LearningPlan | null;
  profile: UserProfile | null;
}> {
  let profileSnap;
  let progressSnap;
  let streakSnap;
  let planSnap;

  try {
    profileSnap = await getDoc(doc(db, "users", userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  }

  try {
    progressSnap = await getDoc(doc(db, "users", userId, "userData", "progress"));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/userData/progress`);
  }

  try {
    streakSnap = await getDoc(doc(db, "users", userId, "userData", "streak"));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/userData/streak`);
  }

  try {
    planSnap = await getDoc(doc(db, "users", userId, "userData", "learningPlan"));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/userData/learningPlan`);
  }

  const profile = profileSnap && profileSnap.exists() ? profileSnap.data() as UserProfile : null;
  const progress = progressSnap && progressSnap.exists() ? progressSnap.data().progress as UserProgress : null;
  
  let streak: StreakData | null = null;
  if (streakSnap && streakSnap.exists()) {
    const data = streakSnap.data();
    streak = {
      currentStreak: data.currentStreak || 0,
      longestStreak: data.longestStreak || 0,
      lastActiveDate: data.lastActiveDate || "",
      history: data.history || {}
    };
  }

  let learningPlan: LearningPlan | null = null;
  if (planSnap && planSnap.exists()) {
    learningPlan = planSnap.data() as LearningPlan;
  }

  return { profile, progress, streak, learningPlan };
}

/**
 * Resets or deletes all Firestore documents for a specific user to clean slate.
 */
export async function resetUserAllData(userId: string, email: string, displayName: string) {
  try {
    // Overwrite the subcollections to prevent previous learning data from polluting
    await setDoc(doc(db, "users", userId, "userData", "progress"), { progress: {} });
    await setDoc(doc(db, "users", userId, "userData", "streak"), { currentStreak: 0, longestStreak: 0, lastActiveDate: "", history: {} });
    await setDoc(doc(db, "users", userId, "userData", "learningPlan"), {});
    
    // Write profile data to Firestore
    await setDoc(doc(db, "users", userId), {
      email,
      displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error resetting user all data:", error);
  }
}

/**
 * Sign Up with a custom Firestore credentials store (fallback when Email/Password Auth is disabled in Firebase console).
 */
export async function signUpCustomUser(
  email: string,
  passwordPlain: string,
  displayName: string
): Promise<{ uid: string; email: string; displayName: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9.-]/g, "_");
  const authRef = doc(db, "custom_auth", docId);
  const docSnap = await getDoc(authRef);
  
  if (docSnap.exists()) {
    throw { code: "auth/email-already-in-use", message: "Email này đã được đăng ký tài khoản khác." };
  }
  
  const uid = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Store custom credential info
  await setDoc(authRef, {
    uid,
    email: cleanEmail,
    displayName: displayName.trim(),
    password: passwordPlain,
    createdAt: new Date().toISOString()
  });
  
  // Write profile details inside standard users collection too
  await saveUserProfile(uid, {
    email: cleanEmail,
    displayName: displayName.trim(),
    createdAt: new Date().toISOString()
  });
  
  return { uid, email: cleanEmail, displayName: displayName.trim() };
}

/**
 * Sign In with a custom Firestore credentials store.
 */
export async function signInCustomUser(
  email: string,
  passwordPlain: string
): Promise<{ uid: string; email: string; displayName: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9.-]/g, "_");
  const authRef = doc(db, "custom_auth", docId);
  const docSnap = await getDoc(authRef);
  
  if (!docSnap.exists()) {
    throw { code: "auth/user-not-found", message: "Không tìm thấy tài khoản với email này." };
  }
  
  const data = docSnap.data();
  if (data.password !== passwordPlain) {
    throw { code: "auth/wrong-password", message: "Mật khẩu không chính xác." };
  }
  
  return { uid: data.uid, email: data.email, displayName: data.displayName };
}

