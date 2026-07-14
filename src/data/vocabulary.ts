/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";
import rawSeedData from "./vocabulary-seed.json";

function normalizeBand(bandStr: string): "0.0-4.0" | "4.5-5.5" | "6.0-6.5" {
  const str = String(bandStr || "").trim();
  if (str === "0.0-4.0") return "0.0-4.0";
  if (str === "4.5-5.5") return "4.5-5.5";
  if (str === "6.0-6.5") return "6.0-6.5";
  
  if (str.startsWith("0.") || str.startsWith("1.") || str.startsWith("2.") || str.startsWith("3.") || str.startsWith("4.0") || str.startsWith("4.0-")) {
    return "0.0-4.0";
  }
  if (str.startsWith("4.5") || str.startsWith("5.")) {
    return "4.5-5.5";
  }
  return "6.0-6.5";
}

function getCleanExample(wordStr: string, posStr: string, rawExample: string, rawExampleVi: string): { example: string; translation: string } {
  const ex = (rawExample || "").trim();
  const exVi = (rawExampleVi || "").trim();
  const cleaned = ex.toLowerCase();
  
  const isPlaceholder = !ex || 
    cleaned.startsWith("understanding the word") && cleaned.includes("is useful for ielts");
    
  if (!isPlaceholder) {
    return { example: ex, translation: exVi };
  }
  
  const word = wordStr.trim();
  const pos = (posStr || "").trim().toLowerCase();
  let example = "";
  let translation = "";
  
  if (pos.includes("noun") || pos === "n.") {
    example = `To achieve a high score in IELTS Writing, candidates should demonstrate a deep understanding of this ${word} and apply it in academic arguments.`;
    translation = `Để đạt điểm cao trong bài thi Viết IELTS, thí sinh nên thể hiện sự hiểu biết sâu sắc về khái niệm ${word} này và áp dụng nó vào các luận điểm học thuật.`;
  } else if (pos.includes("verb") || pos === "v.") {
    example = `Academic writers often choose to ${word} complex ideas to convey their key findings and arguments more precisely.`;
    translation = `Các tác giả viết học thuật thường chọn cách ${word} các ý tưởng phức tạp nhằm truyền tải những phát hiện và lập luận chính của họ một cách chính xác hơn.`;
  } else if (pos.includes("adj") || pos === "adjective") {
    example = `Having a ${word} approach to language learning can significantly accelerate your preparation for the speaking and listening components.`;
    translation = `Có một phương pháp tiếp cận ${word} đối với việc học ngôn ngữ có thể đẩy nhanh đáng kể quá trình ôn luyện cho phần nói và nghe của bạn.`;
  } else if (pos.includes("adv") || pos === "adverb") {
    example = `The researchers ${word} analyzed the experimental data to identify key trends, patterns, and anomalies in the system.`;
    translation = `Các nhà nghiên cứu đã phân tích dữ liệu thực nghiệm một cách ${word} để xác định các xu hướng, mô hình và dị thường chính trong hệ thống.`;
  } else {
    example = `Mastering how to apply the term ${word} in appropriate context is highly beneficial for scoring well on academic tests.`;
    translation = `Nắm vững cách áp dụng thuật ngữ ${word} trong ngữ cảnh phù hợp là điều vô cùng hữu ích để đạt điểm cao trong các bài kiểm tra học thuật.`;
  }
  
  return { example, translation };
}

export const VOCABULARY_SEED: Word[] = (rawSeedData as any[]).map((item, index) => {
  const cleanEx = getCleanExample(
    item.word,
    item.part_of_speech || "",
    item.example_sentence || item.example || "",
    item.example_sentence_vi || item.exampleTranslation || ""
  );

  return {
    id: `seed-${index + 1}`,
    word: item.word,
    band: normalizeBand(item.band),
    ipa: item.ipa || "",
    meaning: item.meaning_vi || item.meaning || "",
    definition: item.meaning_en || item.definition || "",
    example: cleanEx.example,
    exampleTranslation: cleanEx.translation,
    collocations: (item.collocations || []).map((c: any) => {
      if (typeof c === "string") return c;
      return c.phrase || "";
    }),
    synonyms: item.synonyms || [],
    topic: item.topic || "Social Issues",
    partOfSpeech: item.part_of_speech || ""
  };
});
