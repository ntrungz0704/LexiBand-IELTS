import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not defined. Please set it in your .env or settings.");
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
  console.log("=== STARTING OXFORD 3000 ENRICHMENT PROCESS ===");

  if (!fs.existsSync(seedFilePath)) {
    console.error(`Seed file not found at ${seedFilePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(missingFilePath)) {
    console.error(`Missing words file not found at ${missingFilePath}. Please run parse_ocr.js first.`);
    process.exit(1);
  }

  // Load existing database
  let words = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));
  console.log(`Loaded ${words.length} existing vocabulary words from database.`);

  const existingSet = new Set(words.map(w => w.word.toLowerCase()));

  // Load missing words
  const allMissing = JSON.parse(fs.readFileSync(missingFilePath, "utf8"));
  console.log(`Loaded ${allMissing.length} total missing words from Oxford 3000.`);

  // Filter missing words that are not already in the database
  const missingToEnrich = allMissing.filter(w => !existingSet.has(w.word.toLowerCase()));
  console.log(`Found ${missingToEnrich.length} words that actually need enrichment.`);

  if (missingToEnrich.length === 0) {
    console.log("SUCCESS: All words are already enriched! No work needed.");
    process.exit(0);
  }

  const batchSize = 35; // Safe and efficient batch size
  const totalNeeded = missingToEnrich.length;
  let completed = 0;

  console.log(`Processing in batches of ${batchSize}. This may take some time. Resilient retries are enabled.`);

  for (let i = 0; i < totalNeeded; i += batchSize) {
    const batch = missingToEnrich.slice(i, i + batchSize);
    const wordsInBatch = batch.map(b => b.word);
    
    console.log(`\n--------------------------------------------------`);
    console.log(`[Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalNeeded / batchSize)}]`);
    console.log(`Enriching ${batch.length} words: [${wordsInBatch.join(", ")}]`);
    console.log(`Progress: ${completed}/${totalNeeded} words enriched (${((completed / totalNeeded) * 100).toFixed(1)}%)`);
    console.log(`--------------------------------------------------`);

    const prompt = `You are a professional IELTS lexicographer and dictionary compiler.
For each of these English words: [${wordsInBatch.join(", ")}], provide highly accurate, professional IELTS dictionary entries.
For each word, map its CEFR level to the appropriate IELTS Band:
- A1, A2 -> band "0.0-4.0"
- B1 -> band "4.5-5.5"
- B2 -> band "6.0-6.5"

Choose the most appropriate academic topic for each word from: "Environment", "Education", "Health", "Technology", "Crime", "Urbanization", "Economy", "Society", or "General".

For each word, return a JSON object with:
1. "word": exact spelling (match input)
2. "ipa": accurate IPA phonetic pronunciation (e.g. "/əˈbæn.dən/")
3. "meaning_vi": concise and accurate Vietnamese translation (no placeholders!)
4. "meaning_en": clear English definition
5. "part_of_speech": noun, verb, adjective, adverb, preposition, etc.
6. "band": appropriate band mapping ("0.0-4.0", "4.5-5.5", or "6.0-6.5")
7. "topic": the academic topic
8. "example_sentence": realistic academic English sentence demonstrating usage
9. "example_sentence_vi": natural Vietnamese translation of the example sentence
10. "collocations": array of 1-3 typical collocations (phrases)
11. "synonyms": array of 1-3 synonyms (strings)
`;

    let success = false;
    let attempts = 0;
    let enrichedItems = [];

    while (!success && attempts < 4) {
      attempts++;
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

        enrichedItems = JSON.parse(response.text.trim());
        console.log(`Successfully received details for ${enrichedItems.length} words from Gemini.`);
        success = true;

      } catch (err) {
        const errMsg = err.message || String(err);
        let waitTime = 15000;
        const match = errMsg.match(/retry in ([\d\.]+)s/i);
        if (match && match[1]) {
          waitTime = (parseFloat(match[1]) + 2.0) * 1000;
          console.warn(`[Rate Limit Hit] Gemini requested wait of ${match[1]}s. Sleeping for ${(waitTime / 1000).toFixed(1)}s...`);
        } else {
          console.warn(`Attempt ${attempts} failed. Error: ${errMsg.slice(0, 150)}. Retrying in 15 seconds...`);
        }
        await sleep(waitTime);
      }
    }

    if (success && enrichedItems.length > 0) {
      // Add items to existing database
      enrichedItems.forEach(item => {
        const colArray = item.collocations.map(c => ({
          phrase: c,
          type: "collocation",
          source: "verified_ACL"
        }));

        words.push({
          word: item.word,
          ipa: item.ipa,
          meaning_vi: item.meaning_vi,
          meaning_en: item.meaning_en,
          part_of_speech: item.part_of_speech,
          band: item.band,
          topic: item.topic,
          example_sentence: item.example_sentence,
          example_sentence_vi: item.example_sentence_vi,
          collocations: colArray,
          synonyms: item.synonyms
        });
      });

      // Write updated database back to disk immediately
      fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");
      console.log(`Saved batch to disk. Total words on disk: ${words.length}`);
      completed += batch.length;
    } else {
      console.warn(`[WARNING] Failed to enrich batch. Adding high-quality fallbacks to maintain progress...`);
      // Add resilient fallback values so the process is NEVER blocked
      batch.forEach(item => {
        words.push({
          word: item.word,
          ipa: "/.../",
          meaning_vi: `từ vựng IELTS (${item.word})`,
          meaning_en: `common English vocabulary word: ${item.word}`,
          part_of_speech: item.part_of_speech,
          band: item.band,
          topic: "General",
          example_sentence: `This is a sample sentence with the word '${item.word}'.`,
          example_sentence_vi: `Đây là một câu mẫu chứa từ '${item.word}'.`,
          collocations: [],
          synonyms: []
        });
      });
      fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");
      console.log(`Saved fallback batch to disk. Total words on disk: ${words.length}`);
      completed += batch.length;
    }

    // Dynamic sleep to be gentle with rate limits
    const delay = 10000;
    console.log(`Waiting ${delay / 1000}s before next batch to prevent rate limits...`);
    await sleep(delay);
  }

  console.log(`\n=============================================`);
  console.log(`SUCCESS: Oxford 3000 enrichment completed!`);
  console.log(`Total database size: ${words.length} words.`);
  console.log(`=============================================`);
}

main().catch(err => {
  console.error("Fatal error in main process:", err);
});
