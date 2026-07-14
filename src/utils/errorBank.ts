/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { SkillType } from "./errorBankConstants";

export interface ErrorInstance {
  original: string;
  corrected: string;
  explanation: string;
  context?: string;
  date: string;
}

export interface ErrorRecord {
  id: string; // Unique id, e.g. errorType + hash of original
  skill: SkillType;
  error_type: string;
  root_cause: string;
  specific_instance: ErrorInstance; // Latest instance
  instances: ErrorInstance[]; // History of occurrences
  frequency: number;
  first_seen_date: string;
  last_seen_date: string;
  resolved: boolean;
}

export interface ErrorBankData {
  errors: { [errorId: string]: ErrorRecord };
  updatedAt: string;
}

/**
 * Loads the user's error bank from Firestore.
 */
export async function loadErrorBank(userId: string): Promise<ErrorBankData> {
  const path = `users/${userId}/userData/errorBank`;
  try {
    const snap = await getDoc(doc(db, "users", userId, "userData", "errorBank"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        errors: data.errors || {},
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
    return { errors: {}, updatedAt: new Date().toISOString() };
  } catch (error) {
    console.error("Error loading error bank, returning fallback empty bank:", error);
    return { errors: {}, updatedAt: new Date().toISOString() };
  }
}

/**
 * Saves the user's error bank to Firestore.
 */
export async function saveErrorBank(userId: string, bank: ErrorBankData): Promise<void> {
  const path = `users/${userId}/userData/errorBank`;
  try {
    await setDoc(doc(db, "users", userId, "userData", "errorBank"), {
      ...bank,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Hash string helper for generating stable IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Adds or updates an error in the user's Unified Error Bank.
 */
export async function addOrUpdateError(
  userId: string,
  skill: SkillType,
  errorType: string,
  rootCause: string,
  original: string,
  corrected: string,
  explanation: string,
  context?: string
): Promise<ErrorBankData> {
  const bank = await loadErrorBank(userId);
  const cleanOriginal = original.trim();
  
  // Generate a unique, stable error ID based on error type and original sentence
  const errorId = `${errorType}_${simpleHash(cleanOriginal.toLowerCase())}`;
  
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  const newInstance: ErrorInstance = {
    original: cleanOriginal,
    corrected: corrected.trim(),
    explanation: explanation.trim(),
    context: context?.trim(),
    date: new Date().toISOString()
  };

  const existingRecord = bank.errors[errorId];

  if (existingRecord) {
    // If instance is already present in history, don't duplicate but update frequency
    const isDuplicateInstance = existingRecord.instances.some(
      inst => inst.original.toLowerCase() === cleanOriginal.toLowerCase() &&
              inst.corrected.toLowerCase() === corrected.toLowerCase()
    );

    const updatedInstances = isDuplicateInstance 
      ? existingRecord.instances 
      : [newInstance, ...existingRecord.instances];

    bank.errors[errorId] = {
      ...existingRecord,
      specific_instance: newInstance,
      instances: updatedInstances.slice(0, 10), // Limit to last 10 for storage efficiency
      frequency: existingRecord.frequency + 1,
      last_seen_date: today,
      resolved: false, // Mark unresolved as it was seen again
      root_cause: rootCause || existingRecord.root_cause // Update if a better one is supplied
    };
  } else {
    // Create new record
    bank.errors[errorId] = {
      id: errorId,
      skill,
      error_type: errorType,
      root_cause: rootCause || "unknown",
      specific_instance: newInstance,
      instances: [newInstance],
      frequency: 1,
      first_seen_date: today,
      last_seen_date: today,
      resolved: false
    };
  }

  bank.updatedAt = new Date().toISOString();
  await saveErrorBank(userId, bank);
  return bank;
}

/**
 * Adds multiple errors to the Error Bank at once.
 */
export async function addMultipleErrors(
  userId: string,
  errorsList: Array<{
    skill: SkillType;
    errorType: string;
    rootCause: string;
    original: string;
    corrected: string;
    explanation: string;
    context?: string;
  }>
): Promise<ErrorBankData> {
  const bank = await loadErrorBank(userId);
  const today = new Date().toISOString().split("T")[0];

  for (const err of errorsList) {
    const cleanOriginal = err.original.trim();
    const errorId = `${err.errorType}_${simpleHash(cleanOriginal.toLowerCase())}`;
    
    const newInstance: ErrorInstance = {
      original: cleanOriginal,
      corrected: err.corrected.trim(),
      explanation: err.explanation.trim(),
      context: err.context?.trim(),
      date: new Date().toISOString()
    };

    const existingRecord = bank.errors[errorId];

    if (existingRecord) {
      const isDuplicateInstance = existingRecord.instances.some(
        inst => inst.original.toLowerCase() === cleanOriginal.toLowerCase() &&
                inst.corrected.toLowerCase() === err.corrected.toLowerCase()
      );

      const updatedInstances = isDuplicateInstance 
        ? existingRecord.instances 
        : [newInstance, ...existingRecord.instances];

      bank.errors[errorId] = {
        ...existingRecord,
        specific_instance: newInstance,
        instances: updatedInstances.slice(0, 10),
        frequency: existingRecord.frequency + 1,
        last_seen_date: today,
        resolved: false,
        root_cause: err.rootCause || existingRecord.root_cause
      };
    } else {
      bank.errors[errorId] = {
        id: errorId,
        skill: err.skill,
        error_type: err.errorType,
        root_cause: err.rootCause || "unknown",
        specific_instance: newInstance,
        instances: [newInstance],
        frequency: 1,
        first_seen_date: today,
        last_seen_date: today,
        resolved: false
      };
    }
  }

  bank.updatedAt = new Date().toISOString();
  await saveErrorBank(userId, bank);
  return bank;
}

/**
 * Toggles resolved status of an error in the bank.
 */
export async function toggleResolveError(
  userId: string,
  errorId: string,
  resolved: boolean
): Promise<ErrorBankData> {
  const bank = await loadErrorBank(userId);
  if (bank.errors[errorId]) {
    bank.errors[errorId].resolved = resolved;
    bank.updatedAt = new Date().toISOString();
    await saveErrorBank(userId, bank);
  }
  return bank;
}
