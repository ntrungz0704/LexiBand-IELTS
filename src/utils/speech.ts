/**
 * Shared Speech Synthesis Utility to select the highest-quality premium voices 
 * available on different devices (Desktop, iOS Safari, Android Chrome).
 */

export function getBestVoice(accent: "en-US" | "en-GB" = "en-US"): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetLang = accent.toLowerCase().replace("_", "-"); // e.g. "en-us" or "en-gb"
  const langPrefix = targetLang.split("-")[0]; // "en"

  // 1. Filter voices that exactly match the target language code
  const langMatchVoices = voices.filter(v => {
    const vLang = v.lang.toLowerCase().replace("_", "-");
    return vLang === targetLang || vLang.includes(targetLang);
  });

  // 2. Filter voices that start with "en"
  const enVoices = voices.filter(v => {
    const vLang = v.lang.toLowerCase().replace("_", "-");
    return vLang.startsWith(langPrefix);
  });

  // Premium voice indicators in order of priority (especially for Google Chrome Mobile and iOS Safari)
  const premiumKeywords = [
    "siri",
    "enhanced",
    "natural",
    "google",
    "samantha",
    "daniel",
    "premium",
    "microsoft",
    "apple",
    "karen",
    "fiona",
    "tessa",
    "moira"
  ];

  // Helper to find premium voice in a candidate list
  const findPremium = (candidates: SpeechSynthesisVoice[]) => {
    for (const keyword of premiumKeywords) {
      const found = candidates.find(v => v.name.toLowerCase().includes(keyword));
      if (found) return found;
    }
    // Fallback to local service (non-cloud, faster and highly reliable on mobile)
    const local = candidates.find(v => v.localService);
    if (local) return local;

    return candidates[0] || null;
  };

  // Try finding premium voice in language matching candidates
  if (langMatchVoices.length > 0) {
    const best = findPremium(langMatchVoices);
    if (best) return best;
  }

  // Fallback: Try finding premium voice in any English candidates
  if (enVoices.length > 0) {
    const best = findPremium(enVoices);
    if (best) return best;
  }

  // Fallback: Return any matching language voice
  if (langMatchVoices.length > 0) {
    return langMatchVoices[0];
  }

  // Fallback: Return any English voice
  if (enVoices.length > 0) {
    return enVoices[0];
  }

  // Ultimate fallback
  return voices[0] || null;
}

/**
 * Robust text-to-speech speak function with premium voice selection.
 */
export function speakText(
  text: string, 
  rate: number = 0.85, 
  accent: "en-US" | "en-GB" = "en-US", 
  onStart?: () => void, 
  onEnd?: () => void
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Speech Synthesis not supported.");
    return;
  }

  try {
    // Cancel any ongoing speech to avoid overlap
    window.speechSynthesis.cancel();

    // Clean up text if needed
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose the absolute best voice
    const voice = getBestVoice(accent);
    if (voice) {
      utterance.voice = voice;
      // Force the utterance lang to match the voice lang for mobile compatibility
      utterance.lang = voice.lang;
    } else {
      utterance.lang = accent;
    }

    utterance.rate = rate;

    // Mobile platforms sometimes need volume explicitly set to 1
    utterance.volume = 1.0;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("Speech Synthesis error:", e);
    if (onEnd) onEnd();
  }
}
