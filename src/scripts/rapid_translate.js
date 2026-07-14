import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not defined.");
  process.exit(1);
}

const ai = new GoogleGenAI({ 
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const seedFilePath = path.join(process.cwd(), "src/data/vocabulary-seed.json");
const missingFilePath = path.join(process.cwd(), "src/data/missing_words.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("=== STARTING RAPID TRANSLATION & DATABASE COMPILATION ===");

  let words = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));
  console.log(`Current database size: ${words.length} words.`);
  const existingSet = new Set(words.map(w => w.word.toLowerCase()));

  const missing = JSON.parse(fs.readFileSync(missingFilePath, "utf8"));
  const actualMissing = missing.filter(m => !existingSet.has(m.word.toLowerCase()));
  console.log(`Need to translate and compile ${actualMissing.length} missing words.`);

  if (actualMissing.length === 0) {
    console.log("All words are already compiled! Total count: " + words.length);
    process.exit(0);
  }

  const batchSize = 150;
  const total = actualMissing.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = actualMissing.slice(i, i + batchSize);
    const wordsInBatch = batch.map(b => b.word);

    console.log(`Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(total / batchSize)}: ${batch.length} words...`);

    const prompt = `You are a professional English-Vietnamese dictionary.
Translate these English words to Vietnamese and provide a short English definition.
Words: [${wordsInBatch.join(", ")}]

You MUST output exactly ONE line per word. Do NOT include markdown code blocks, intro text, or numbering.
Use exactly this format on each line:
word | meaning_vi | meaning_en

Example format:
abandon | từ bỏ, ruồng bỏ | to leave behind or give up completely

Ensure the word matches the input spelling exactly. No extra spaces around characters. No empty lines.
`;

    let success = false;
    let attempts = 0;
    while (!success && attempts < 2) {
      attempts++;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite", // let's use the confirmed working model!
          contents: prompt,
        });

        const lines = response.text.trim().split("\n");
        let addedInBatch = 0;

        lines.forEach(line => {
          if (!line.includes("|")) return;
          const parts = line.split("|").map(p => p.trim());
          if (parts.length >= 2) {
            const wordVal = parts[0];
            const meaningVi = parts[1];
            const meaningEn = parts[2] || "to " + wordVal;

            const originalMatch = batch.find(b => b.word.toLowerCase() === wordVal.toLowerCase());
            if (originalMatch) {
              const lowerWord = wordVal.toLowerCase();
              if (!existingSet.has(lowerWord)) {
                words.push({
                  word: originalMatch.word,
                  ipa: `/${originalMatch.word}/`,
                  meaning_vi: meaningVi,
                  meaning_en: meaningEn,
                  part_of_speech: originalMatch.part_of_speech,
                  band: originalMatch.band,
                  topic: "General",
                  example_sentence: `Understanding the word '${originalMatch.word}' is useful for IELTS.`,
                  example_sentence_vi: `Hiểu từ '${originalMatch.word}' rất hữu ích cho kỳ thi IELTS.`,
                  collocations: [],
                  synonyms: []
                });
                existingSet.add(lowerWord);
                addedInBatch++;
              }
            }
          }
        });

        console.log(`Successfully translated and compiled ${addedInBatch} words.`);
        success = true;

        fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");

      } catch (err) {
        console.error(`Attempt ${attempts} failed. Error:`, err.message || err);
        await sleep(10000);
      }
    }

    await sleep(6000);
  }

  console.log(`\n=============================================`);
  console.log(`SUCCESS: Rapid compilation finished!`);
  console.log(`Total words in vocabulary-seed.json: ${words.length}`);
  console.log(`=============================================`);
}

main().catch(err => {
  console.error("Fatal error during rapid compilation:", err);
});
