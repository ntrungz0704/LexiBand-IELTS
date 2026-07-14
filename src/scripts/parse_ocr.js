import fs from "fs";
import path from "path";

const rawOcrPath = path.join(process.cwd(), "src/data/raw_ocr.txt");
const rawOcrAmericanPath = path.join(process.cwd(), "src/data/raw_ocr_american.txt");
const seedFilePath = path.join(process.cwd(), "src/data/vocabulary-seed.json");

// Robust regex that matches the start of parts of speech
// Example: "about prep., adv." -> splits at "prep."
const POS_REGEX = /(?:^|\s)(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|exclam\.|number|modal\s+v\.|auxiliary\s+v\.|indefinite\s+article|definite\s+article|auxiliary|modal)(?:\s|$|,)/i;

function cleanWord(w) {
  // Replace non-breaking spaces with standard space
  let word = w.replace(/[\xa0\u00a0]/g, " ").trim();
  // Remove numbers at the end like can1 -> can, do1 -> do
  word = word.replace(/\d+$/, "").trim();
  // If word has "a, an", take the first one or normalize it
  if (word.toLowerCase() === "a, an") {
    return "a";
  }
  return word.toLowerCase();
}

function parseStandardOcr() {
  const content = fs.readFileSync(rawOcrPath, "utf8");
  const lines = content.split("\n");
  let currentCefr = "A1";
  const wordMap = new Map();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("---")) continue;

    if (line === "A1" || line === "A2" || line === "B1" || line === "B2") {
      currentCefr = line;
      continue;
    }

    const posMatch = line.match(POS_REGEX);
    if (!posMatch) continue;

    const splitIdx = posMatch.index;
    const wordPart = line.substring(0, splitIdx).trim();
    const rest = line.substring(splitIdx).trim();

    const cleaned = cleanWord(wordPart);
    if (!cleaned) continue;

    // Collect parts of speech
    const posList = [];
    if (rest.includes("n.")) posList.push("noun");
    if (rest.includes("v.")) posList.push("verb");
    if (rest.includes("adj.")) posList.push("adjective");
    if (rest.includes("adv.")) posList.push("adverb");
    if (rest.includes("prep.")) posList.push("preposition");
    if (rest.includes("conj.")) posList.push("conjunction");
    if (rest.includes("pron.")) posList.push("pronoun");
    if (rest.includes("det.")) posList.push("determiner");
    if (rest.includes("exclam.")) posList.push("exclamation");
    if (rest.includes("number")) posList.push("numeral");

    if (posList.length === 0) {
      posList.push("noun");
    }

    if (wordMap.has(cleaned)) {
      const existing = wordMap.get(cleaned);
      posList.forEach(p => existing.parts.add(p));
      const order = { "A1": 1, "A2": 2, "B1": 3, "B2": 4 };
      if (order[currentCefr] > order[existing.cefr]) {
        existing.cefr = currentCefr;
      }
    } else {
      wordMap.set(cleaned, {
        word: wordPart,
        parts: new Set(posList),
        cefr: currentCefr
      });
    }
  }

  return wordMap;
}

function parseAmericanOcr() {
  const content = fs.readFileSync(rawOcrAmericanPath, "utf8");
  const lines = content.split("\n");
  const wordMap = new Map();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("---")) continue;

    const cefrMatches = line.match(/\b(A1|A2|B1|B2)\b/g);
    if (!cefrMatches) continue;

    const posMatch = line.match(POS_REGEX);
    if (!posMatch) continue;

    const splitIdx = posMatch.index;
    const wordPart = line.substring(0, splitIdx).trim();

    const cleaned = cleanWord(wordPart);
    if (!cleaned) continue;

    const posList = [];
    if (line.includes("n.")) posList.push("noun");
    if (line.includes("v.")) posList.push("verb");
    if (line.includes("adj.")) posList.push("adjective");
    if (line.includes("adv.")) posList.push("adverb");
    if (line.includes("prep.")) posList.push("preposition");
    if (line.includes("conj.")) posList.push("conjunction");
    if (line.includes("pron.")) posList.push("pronoun");
    if (line.includes("det.")) posList.push("determiner");
    if (line.includes("exclam.")) posList.push("exclamation");
    if (line.includes("number")) posList.push("numeral");

    if (posList.length === 0) {
      posList.push("noun");
    }

    let cefr = cefrMatches[cefrMatches.length - 1];

    if (wordMap.has(cleaned)) {
      const existing = wordMap.get(cleaned);
      posList.forEach(p => existing.parts.add(p));
      const order = { "A1": 1, "A2": 2, "B1": 3, "B2": 4 };
      if (order[cefr] > order[existing.cefr]) {
        existing.cefr = cefr;
      }
    } else {
      wordMap.set(cleaned, {
        word: wordPart,
        parts: new Set(posList),
        cefr: cefr
      });
    }
  }

  return wordMap;
}

function mergeMaps() {
  const stdMap = parseStandardOcr();
  const amMap = parseAmericanOcr();

  const merged = new Map();

  const addEntries = (map) => {
    for (const [key, value] of map.entries()) {
      if (merged.has(key)) {
        const existing = merged.get(key);
        value.parts.forEach(p => existing.parts.add(p));
        const order = { "A1": 1, "A2": 2, "B1": 3, "B2": 4 };
        if (order[value.cefr] > order[existing.cefr]) {
          existing.cefr = value.cefr;
        }
      } else {
        merged.set(key, {
          word: value.word,
          parts: new Set(value.parts),
          cefr: value.cefr
        });
      }
    }
  };

  addEntries(stdMap);
  addEntries(amMap);

  return merged;
}

function main() {
  console.log("Merging OCR sources...");
  const merged = mergeMaps();
  console.log(`Successfully merged into ${merged.size} unique words.`);

  // Load existing seed
  const existingWords = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));
  const existingSet = new Set(existingWords.map(w => w.word.toLowerCase()));
  console.log(`Current vocabulary-seed.json has ${existingWords.length} words.`);

  // Find missing words
  const missing = [];
  const bandMap = {
    "A1": "0.0-4.0",
    "A2": "0.0-4.0",
    "B1": "4.5-5.5",
    "B2": "6.0-6.5"
  };

  for (const [key, value] of merged.entries()) {
    if (!existingSet.has(key)) {
      const pos = Array.from(value.parts)[0] || "noun";
      const band = bandMap[value.cefr] || "0.0-4.0";
      missing.push({
        word: value.word,
        cefr: value.cefr,
        part_of_speech: pos,
        band: band
      });
    }
  }

  console.log(`Found ${missing.length} missing words from Oxford 3000.`);
  console.log("Saving list of missing words to /src/data/missing_words.json...");
  fs.writeFileSync(path.join(process.cwd(), "src/data/missing_words.json"), JSON.stringify(missing, null, 2), "utf8");
}

main();
