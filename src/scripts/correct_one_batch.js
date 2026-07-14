import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
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

async function main() {
  console.log("Loading vocabulary database...");
  let words = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));

  // Identify placeholders
  const placeholders = words.filter(w => 
    w.meaning_vi && (
      w.meaning_vi.includes("từ học thuật") || 
      w.meaning_vi.startsWith("từ học thuật:") ||
      w.ipa.includes("...")
    )
  );

  console.log(`Found ${placeholders.length} placeholder words remaining.`);
  if (placeholders.length === 0) {
    console.log("No placeholders remaining!");
    return;
  }

  const batchSize = 35; // Process 35 words
  const batch = placeholders.slice(0, batchSize);
  const wordsToFix = batch.map(w => w.word);

  console.log(`Translating batch of ${batch.length} words: [${wordsToFix.join(", ")}]...`);

  const prompt = `You are an expert IELTS lexicographer.
Provide correct, high-quality, professional, and contextually accurate IELTS dictionary entries for these English words: [${wordsToFix.join(", ")}].
Ensure meaning_vi is a professional Vietnamese translation appropriate for IELTS study. Do NOT use "từ học thuật" or placeholders!
Ensure ipa is the correct International Phonetic Alphabet (IPA).

For each word, return a JSON object with:
1. "word": exact spelling
2. "ipa": accurate IPA phonetic pronunciation (e.g. "/əˈbæn.dən/")
3. "meaning_vi": concise and accurate Vietnamese meaning
4. "meaning_en": clear English definition
5. "part_of_speech": noun, verb, adjective, adverb, etc.
6. "band": "0.0-4.0", "4.5-5.5", or "6.0-6.5"
7. "topic": "Environment", "Education", "Health", "Technology", "Crime", "Urbanization", "Economy", "Society", or "General"
8. "example_sentence": realistic academic English sentence
9. "example_sentence_vi": natural Vietnamese translation of the sentence
10. "collocations": array of strings (e.g. ["adhere strictly", "adhere to laws"])
11. "synonyms": array of strings
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              ipa: { type: Type.STRING },
              meaning_vi: { type: Type.STRING },
              meaning_en: { type: Type.STRING },
              part_of_speech: { type: Type.STRING },
              band: { type: Type.STRING },
              topic: { type: Type.STRING },
              example_sentence: { type: Type.STRING },
              example_sentence_vi: { type: Type.STRING },
              collocations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              synonyms: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: [
              "word", "ipa", "meaning_vi", "meaning_en", "part_of_speech", 
              "band", "topic", "example_sentence", "example_sentence_vi", 
              "collocations", "synonyms"
            ]
          }
        }
      }
    });

    const fixedBatch = JSON.parse(response.text.trim());
    console.log(`Successfully received ${fixedBatch.length} translations from Gemini.`);

    fixedBatch.forEach(fixedItem => {
      const idx = words.findIndex(w => w.word.toLowerCase() === fixedItem.word.toLowerCase());
      if (idx !== -1) {
        words[idx] = {
          ...words[idx],
          ipa: fixedItem.ipa,
          meaning_vi: fixedItem.meaning_vi,
          meaning_en: fixedItem.meaning_en,
          part_of_speech: fixedItem.part_of_speech,
          topic: fixedItem.topic,
          example_sentence: fixedItem.example_sentence,
          example_sentence_vi: fixedItem.example_sentence_vi,
          collocations: fixedItem.collocations.map(c => typeof c === 'string' ? { phrase: c, type: "collocation", source: "verified_ACL" } : c),
          synonyms: fixedItem.synonyms
        };
      }
    });

    fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");
    console.log(`Saved progress!`);

  } catch (err) {
    console.error("Error in correction:", err);
  }
}

main();
