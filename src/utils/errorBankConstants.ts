/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SkillType = "vocabulary" | "grammar" | "speaking" | "writing";

export interface ErrorTypeConfig {
  key: string;
  label: string;
  description: string;
  skill: SkillType;
}

export interface RootCauseConfig {
  key: string;
  label: string;
  description: string;
}

export const SKILL_LABELS: Record<SkillType, string> = {
  vocabulary: "Từ vựng (Vocabulary)",
  grammar: "Ngữ pháp (Grammar)",
  speaking: "Nói (Speaking)",
  writing: "Viết (Writing)"
};

export const ERROR_TYPES: Record<string, ErrorTypeConfig> = {
  // Vocabulary errors
  collocation_wrong: {
    key: "collocation_wrong",
    label: "Dùng sai kết hợp từ (Collocation Error)",
    description: "Sử dụng các cặp từ không đi chung với nhau theo thói quen của người bản xứ.",
    skill: "vocabulary"
  },
  word_choice_unnatural: {
    key: "word_choice_unnatural",
    label: "Chọn từ không tự nhiên (Unnatural Word Choice)",
    description: "Từ vựng đúng ngữ nghĩa nhưng không tự nhiên hoặc không phù hợp văn cảnh học thuật.",
    skill: "vocabulary"
  },
  word_form_incorrect: {
    key: "word_form_incorrect",
    label: "Sai dạng từ (Incorrect Word Form)",
    description: "Nhầm lẫn giữa danh từ, động từ, tính từ hoặc trạng từ.",
    skill: "vocabulary"
  },
  repetition_excessive: {
    key: "repetition_excessive",
    label: "Lặp từ quá nhiều (Excessive Repetition)",
    description: "Thiếu vốn từ đồng nghĩa dẫn đến việc lặp đi lặp lại một từ trong bài viết/nói.",
    skill: "vocabulary"
  },

  // Grammar errors
  tense_error: {
    key: "tense_error",
    label: "Sai thì của động từ (Verb Tense Error)",
    description: "Sử dụng sai thì thời (quá khứ, hiện tại, tương lai) hoặc không nhất quán trong câu.",
    skill: "grammar"
  },
  subject_verb_agreement: {
    key: "subject_verb_agreement",
    label: "Hòa hợp Chủ ngữ - Động từ (Subject-Verb Agreement)",
    description: "Động từ không chia đúng theo số ít/số nhiều của chủ ngữ.",
    skill: "grammar"
  },
  article_error: {
    key: "article_error",
    label: "Lỗi mạo từ (Article Error)",
    description: "Sử dụng sai hoặc thiếu mạo từ (a, an, the).",
    skill: "grammar"
  },
  preposition_incorrect: {
    key: "preposition_incorrect",
    label: "Sai giới từ (Incorrect Preposition)",
    description: "Dùng sai giới từ đi kèm với động từ, danh từ hoặc tính từ.",
    skill: "grammar"
  },
  run_on_sentence: {
    key: "run_on_sentence",
    label: "Câu ghép sai/Run-on (Run-on Sentence)",
    description: "Nối các mệnh đề độc lập với nhau mà không có liên từ hoặc dấu câu thích hợp.",
    skill: "grammar"
  },
  sentence_fragment: {
    key: "sentence_fragment",
    label: "Câu thiếu thành phần (Sentence Fragment)",
    description: "Viết một nhóm từ không đủ thành phần chủ-vị làm thành một câu hoàn chỉnh.",
    skill: "grammar"
  },

  // Speaking errors
  final_consonant_dropped: {
    key: "final_consonant_dropped",
    label: "Nuốt âm cuối (Dropped Final Consonant)",
    description: "Quên phát âm các âm đuôi quan trọng như /s/, /z/, /t/, /d/, /ed/.",
    skill: "speaking"
  },
  pronunciation_incorrect: {
    key: "pronunciation_incorrect",
    label: "Phát âm sai từ (Incorrect Pronunciation)",
    description: "Phát âm sai nguyên âm, phụ âm hoặc đặt sai trọng âm của từ.",
    skill: "speaking"
  },
  intonation_flat: {
    key: "intonation_flat",
    label: "Giọng điệu đều đều (Flat Intonation)",
    description: "Thiếu ngữ điệu lên xuống, không nhấn trọng âm câu hoặc từ chìa khóa.",
    skill: "speaking"
  },
  hesitation_excessive: {
    key: "hesitation_excessive",
    label: "Ngập ngừng quá mức (Excessive Hesitation)",
    description: "Ngắt quãng quá nhiều, kéo dài âm 'uh', 'ah' làm giảm độ lưu loát.",
    skill: "speaking"
  },

  // Writing errors
  punctuation_error: {
    key: "punctuation_error",
    label: "Lỗi dấu câu (Punctuation Error)",
    description: "Sử dụng sai dấu phẩy, dấu chấm, dấu chấm phẩy làm thay đổi cấu trúc câu.",
    skill: "writing"
  },
  redundancy: {
    key: "redundancy",
    label: "Trùng lặp/Thừa từ (Redundancy)",
    description: "Dùng các từ mang nghĩa trùng lặp nhau không cần thiết trong cùng một câu.",
    skill: "writing"
  },
  informal_tone: {
    key: "informal_tone",
    label: "Văn phong thân mật (Informal Tone)",
    description: "Sử dụng tiếng lóng, từ viết tắt hoặc cụm từ quá thân mật trong bài thi học thuật.",
    skill: "writing"
  },
  cohesion_weak: {
    key: "cohesion_weak",
    label: "Liên kết yếu (Weak Cohesion)",
    description: "Dùng từ nối sai ngữ cảnh hoặc chuyển ý không mượt mà giữa các câu/đoạn.",
    skill: "writing"
  }
};

export const ROOT_CAUSES: Record<string, RootCauseConfig> = {
  vietnamese_interference: {
    key: "vietnamese_interference",
    label: "Ảnh hưởng từ tiếng Việt (Vietnamese Interference)",
    description: "Dịch trực tiếp từng từ (word-by-word) hoặc áp dụng tư duy ngữ pháp tiếng Việt sang tiếng Anh."
  },
  overgeneralization: {
    key: "overgeneralization",
    label: "Khái quát hóa quá đà (Overgeneralization)",
    description: "Áp dụng một quy tắc ngữ pháp chung cho tất cả các trường hợp ngoại lệ (VD: thêm -ed cho động từ bất quy tắc)."
  },
  insufficient_exposure: {
    key: "insufficient_exposure",
    label: "Chưa va chạm đủ (Insufficient Exposure)",
    description: "Chưa được làm quen nhiều hoặc chưa ghi nhớ được cấu trúc chuẩn của người bản xứ."
  },
  carelessness: {
    key: "carelessness",
    label: "Lỗi bất cẩn (Carelessness)",
    description: "Đã biết luật nhưng mắc lỗi do viết/nói nhanh hoặc thiếu rà soát lại bài làm."
  },
  unknown: {
    key: "unknown",
    label: "Nguyên nhân khác (Other/Unknown)",
    description: "Lỗi ngẫu nhiên chưa được xác định nguyên nhân cụ thể."
  }
};
