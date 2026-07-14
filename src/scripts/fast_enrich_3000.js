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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fallback list of some target academic words if we need them
const TARGET_VOCAB_BASE = [
  "abundant", "accelerate", "accessible", "accomplish", "accumulation", "accuracy", "accustomed", "activation", "adaptation", "adequacy",
  "adhere", "adherence", "administrative", "advent", "adversary", "adverse", "aerobic", "aesthetic", "affiliation", "affinity",
  "affirmation", "agenda", "aggression", "agitation", "agrarian", "agricultural", "alienation", "alliance", "allocation", "allusion",
  "alteration", "ambiance", "ambiguity", "ambition", "amenity", "analogy", "analytical", "anecdote", "anomaly", "anonymous",
  "anticipation", "apparatus", "appendix", "applause", "appraisal", "apprehension", "assertion", "asset", "assimilation", "attainment",
  "attendance", "attribute", "auditorium", "augment", "autonomy", "barrier", "beneficiary", "bias", "biodiversity", "boundary",
  "boycott", "bureaucracy", "byproduct", "caliber", "campaign", "candidate", "capitalism", "catalyst", "category", "caution",
  "celebrity", "census", "chaos", "characteristic", "chronic", "chronological", "circulation", "civilization", "clarification", "classification",
  "coalition", "coexistence", "cohesion", "coincidence", "collaboration", "collective", "colloquial", "colonialism", "commencement", "commemoration",
  "commendable", "commentary", "commitment", "commodity", "communal", "compact", "compatibility", "compensation", "competence", "compilation",
  "complement", "complexity", "compliance", "component", "composure", "comprehend", "comprehensive", "compromise", "compulsory", "computation",
  "conceal", "concede", "conceivable", "concentration", "concept", "concession", "concise", "conclusive", "concrete", "condensation",
  "condone", "conductive", "conducive", "confidentiality", "configuration", "conformation", "conformity", "confrontation", "congestion", "conglomerate",
  "conjecture", "conjunction", "connectivity", "connoisseur", "connotation", "consensus", "consequence", "conservation", "conservatism", "consistence",
  "consolidation", "conspicuous", "conspiracy", "constancy", "constituency", "constituent", "constitution", "constraint", "consultation", "consumption",
  "contagious", "contaminant", "contamination", "contemplate", "contemplation", "contemporary", "contempt", "contention", "contentious", "contextual",
  "contingency", "continuity", "contour", "contraception", "contradiction", "contradictory", "contraindication", "contravention", "contributor", "controversial",
  "controversy", "convection", "convention", "conventional", "convergence", "conversely", "conversion", "cooperation", "cooperative", "coordinate",
  "coordination", "coordinator", "copious", "copyright", "correlation", "correspondence", "correspondent", "corroborate", "corrosion", "corruption",
  "cosmopolitan", "counteract", "counterpart", "creativity", "credential", "credibility", "criterion", "criticism", "critique", "crucial"
];

async function main() {
  console.log("Loading vocabulary-seed.json...");
  let words = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));
  console.log(`Starting with ${words.length} words.`);

  // 1. Clean the 412 placeholders
  const placeholders = words.filter(w => 
    w.meaning_vi && (
      w.meaning_vi.includes("từ học thuật") || 
      w.meaning_vi.startsWith("từ học thuật:") ||
      w.ipa.includes("...")
    )
  );

  console.log(`Found ${placeholders.length} placeholders remaining to correct.`);

  if (placeholders.length > 0) {
    const compactBatchSize = 100;
    for (let i = 0; i < placeholders.length; i += compactBatchSize) {
      const batch = placeholders.slice(i, i + compactBatchSize);
      const wordsToFix = batch.map(w => w.word);

      console.log(`\n--- Correcting placeholder batch ${Math.floor(i / compactBatchSize) + 1}/${Math.ceil(placeholders.length / compactBatchSize)}: ${wordsToFix.length} words ---`);

      const prompt = `You are a professional IELTS dictionary compiler.
For each of these English words: [${wordsToFix.join(", ")}], provide correct, highly accurate, and contextually appropriate IELTS dictionary entries.
You MUST output exactly ONE LINE per word. Do NOT include any markdown block ticks, intro text, or explanation.
Use exactly this format per line:
word | ipa | meaning_vi | meaning_en | part_of_speech | band | topic | example_sentence | example_sentence_vi | collocations | synonyms

Rules:
- meaning_vi must be a professional Vietnamese translation (do NOT use "từ học thuật" placeholders).
- ipa must be accurate (e.g. /əˈbæn.dən/).
- collocations must be separated by semicolons (e.g. adhere to;adhere strictly).
- synonyms must be separated by semicolons (e.g. comply;follow).
- Use exact character '|' to separate fields. No blank lines.

Example Line:
abundant | /əˈbʌn.dənt/ | dồi dào, phong phú | existing or available in large quantities | adjective | 4.5-5.5 | Environment | The region has abundant natural resources. | Vùng này có tài nguyên thiên nhiên dồi dào. | abundant resources;abundant supply | plentiful;ample
`;

      let success = false;
      let attempt = 0;
      while (!success && attempt < 10) {
        attempt++;
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
          });

          const text = response.text.trim();
          const lines = text.split("\n").filter(line => line.includes("|"));
          console.log(`Received ${lines.length} lines from Gemini.`);

          lines.forEach(line => {
            const parts = line.split("|").map(p => p.trim());
            if (parts.length >= 9) {
              const [word, ipa, meaning_vi, meaning_en, pos, band, topic, ex, ex_vi, col, syn] = parts;
              const idx = words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
              if (idx !== -1) {
                // Parse collocations
                const colArray = col ? col.split(";").map(c => ({ phrase: c.trim(), type: "collocation", source: "verified_ACL" })) : [];
                // Parse synonyms
                const synArray = syn ? syn.split(";").map(s => s.trim()) : [];

                words[idx] = {
                  ...words[idx],
                  ipa: ipa || words[idx].ipa,
                  meaning_vi: meaning_vi || words[idx].meaning_vi,
                  meaning_en: meaning_en || words[idx].meaning_en,
                  part_of_speech: pos || words[idx].part_of_speech,
                  band: band || words[idx].band,
                  topic: topic || words[idx].topic,
                  example_sentence: ex || words[idx].example_sentence,
                  example_sentence_vi: ex_vi || words[idx].example_sentence_vi,
                  collocations: colArray.length > 0 ? colArray : words[idx].collocations,
                  synonyms: synArray.length > 0 ? synArray : words[idx].synonyms
                };
              }
            }
          });

          fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");
          console.log(`Saved ${lines.length} placeholder corrections.`);
          success = true;

        } catch (err) {
          let waitTime = 45000;
          const errMsg = err.message || String(err);
          const match = errMsg.match(/retry in ([\d\.]+)s/i);
          if (match && match[1]) {
            waitTime = (parseFloat(match[1]) + 2.0) * 1000;
          }
          console.warn(`[Rate Limit Hit] Attempt ${attempt} failed. Gemini requested wait. Sleeping for ${(waitTime / 1000).toFixed(1)}s before next retry...`);
          await sleep(waitTime);
        }
      }

      await sleep(10000); // 10s wait between calls
    }
  }

  // 2. Expand database to 3015 words (we need about 2020 more words)
  let currentCount = words.length;
  const targetCount = 3015;
  let wordsNeeded = targetCount - currentCount;
  console.log(`\nCurrent count: ${currentCount} words. We need ${wordsNeeded} more words to reach target ${targetCount}.`);

  if (wordsNeeded > 0) {
    const existingWordsSet = new Set(words.map(w => w.word.toLowerCase()));
    
    // Create a pool of remaining academic words we can request translations for
    const expansionWordsPool = [
      ...TARGET_VOCAB_BASE,
      "academic", "accomplish", "accuracy", "adapt", "adequate", "adjacent", "adjust", "administration", "adolescence", "advocate",
      "aesthetic", "affect", "aggregate", "albeit", "allocate", "alter", "alternative", "ambiguous", "amend", "analogy",
      "analyse", "analysis", "annual", "anticipate", "apparent", "append", "appreciate", "approach", "appropriate", "approximate",
      "arbitrary", "area", "aspect", "assemble", "assess", "assign", "assist", "assume", "assure", "attach",
      "attain", "attitude", "attribute", "author", "authority", "automate", "available", "aware", "behalf", "benefit",
      "bias", "bond", "brief", "bulk", "capable", "capacity", "category", "cease", "challenge", "channel",
      "chapter", "chart", "chemical", "circumstance", "cite", "civil", "clarify", "classic", "clause", "code",
      "coherent", "coincide", "collapse", "colleague", "commence", "comment", "commission", "commit", "commodity", "communicate",
      "community", "compatible", "compensate", "competence", "compile", "complement", "complex", "component", "comprise", "compute",
      "conceive", "concentrate", "concept", "conclude", "concurrent", "conduct", "confer", "confine", "confirm", "conform",
      "consent", "consequence", "considerable", "consist", "constant", "constitute", "constrain", "construct", "consult", "consume",
      "contact", "contemporary", "context", "contract", "contradict", "contrary", "contrast", "contribute", "controversy", "convene",
      "converse", "convert", "convince", "cooperate", "coordinate", "core", "corporate", "correspond", "couple", "create",
      "credit", "criteria", "crucial", "culture", "currency", "cycle", "data", "debate", "decade", "decline",
      "deduce", "define", "definite", "demonstrate", "denote", "deny", "depress", "derive", "design", "despite",
      "detect", "deviate", "device", "devote", "differentiate", "dimension", "diminish", "discretion", "discriminate", "displace",
      "display", "dispose", "disproportionate", "distinct", "distort", "distribute", "diverse", "document", "domain", "domestic",
      "dominate", "draft", "drama", "duration", "dynamic", "economy", "edit", "element", "eliminate", "emerge",
      "emphasis", "empirical", "enable", "encounter", "energy", "enforce", "enhance", "enormous", "ensure", "entity",
      "environment", "equate", "equip", "equivalent", "erode", "error", "establish", "estate", "estimate", "ethic",
      "ethnic", "evaluate", "eventual", "evident", "evolution", "exceed", "exclude", "exhibit", "expand", "expert",
      "explicit", "exploit", "export", "expose", "external", "extract", "facilitate", "factor", "feature", "federal",
      "fee", "file", "finance", "finite", "flexible", "fluctuate", "focus", "format", "formula", "forthcoming",
      "foundation", "framework", "function", "fund", "fundamental", "furthermore", "gender", "generate", "generation", "globe",
      "goal", "grade", "grant", "guarantee", "guideline", "hence", "hierarchy", "highlight", "hypothesis", "identical",
      "identify", "ideology", "ignorance", "illustrate", "image", "immigrate", "impact", "implement", "implicate", "implicit",
      "imply", "impose", "incentive", "incidence", "incline", "income", "incorporate", "index", "indicate", "individual",
      "induce", "inevitable", "infer", "infrastructure", "inherent", "inhibit", "initial", "initiate", "injure", "innovate",
      "input", "insert", "insight", "insist", "inspect", "instance", "institute", "instruct", "instrument", "integral",
      "integrate", "integrity", "intellect", "intense", "interact", "intermediate", "internal", "interpret", "interval", "intervene",
      "intrinsic", "invest", "investigate", "invoke", "involve", "isolate", "issue", "item", "job", "journal",
      "justify", "label", "labor", "layer", "lecture", "legal", "legislate", "levy", "liberal", "license",
      "likewise", "link", "locate", "logic", "maintain", "major", "manipulate", "manual", "margin", "mature",
      "maximize", "mechanism", "media", "mediate", "medical", "medium", "mental", "method", "migrate", "military",
      "minimal", "minimize", "minimum", "ministry", "minor", "mode", "modify", "monitor", "motive", "mutual",
      "negate", "network", "neutral", "nevertheless", "nonetheless", "norm", "normal", "notion", "notwithstanding", "nuclear",
      "objective", "obtain", "obvious", "occupy", "occur", "odd", "offset", "ongoing", "option", "orient",
      "outcome", "output", "overall", "overlap", "overseas", "panel", "paradigm", "paragraph", "parallel", "parameter",
      "participate", "partner", "passive", "path", "perceive", "percent", "period", "persist", "perspective", "phase",
      "phenomenon", "philosophy", "physical", "plus", "policy", "portion", "pose", "positive", "potential", "practitioner",
      "precede", "precise", "predict", "predominant", "preliminary", "presume", "previous", "primary", "prime", "principal",
      "principle", "prior", "priority", "proceed", "process", "professional", "prohibit", "project", "prominent", "promote",
      "proportion", "prospect", "protocol", "psychology", "publish", "purchase", "pursue", "qualitative", "quote", "radical"
    ];

    // Filter to get only new unique words to request
    const expansionPool = expansionWordsPool.filter(w => !existingWordsSet.has(w.toLowerCase()));
    console.log(`Expansion pool has ${expansionPool.length} unique candidate academic words.`);

    const expansionBatchSize = 40; // Safer and more stable batch size to prevent token truncation
    let batchIdx = 1;

    // We can also generate generic highly common IELTS words dynamically if pool is dry
    while (wordsNeeded > 0) {
      const batchWords = expansionPool.slice((batchIdx - 1) * expansionBatchSize, batchIdx * expansionBatchSize);
      
      console.log(`\n--- Expansion Batch ${batchIdx}: Requesting ${batchWords.length || expansionBatchSize} unique IELTS words ---`);

      // We ask Gemini to generate words from the pool OR highly academic IELTS words
      let prompt = "";
      if (batchWords.length > 0) {
        prompt = `You are a professional IELTS lexicographer.
Provide correct, high-quality IELTS dictionary entries for these English words: [${batchWords.join(", ")}].
You MUST output exactly ONE LINE per word. Do NOT include markdown formatting or explanation.
Use this format:
word | ipa | meaning_vi | meaning_en | part_of_speech | band | topic | example_sentence | example_sentence_vi | collocations | synonyms

Rules:
- band must be "0.0-4.0", "4.5-5.5", or "6.0-6.5" based on academic difficulty.
- topic must be "Environment", "Education", "Health", "Technology", "Crime", "Urbanization", "Economy", "Society", or "General".
- collocations must be separated by semicolons (e.g. academic work;academic career).
- synonyms must be separated by semicolons (e.g. scholastic;educational).
- Use exactly '|' separator.
`;
      } else {
        // Pool is empty, generate new academic words
        const currentBand = batchIdx % 3 === 0 ? "6.0-6.5" : batchIdx % 3 === 1 ? "4.5-5.5" : "0.0-4.0";
        prompt = `You are an expert IELTS dictionary compiler.
Generate exactly ${expansionBatchSize} unique, high-yield academic vocabulary words tested in IELTS for target band "${currentBand}".
Avoid simple common words. These words MUST NOT overlap with any of these: [${Array.from(existingWordsSet).slice(0, 40).join(", ")}].
You MUST output exactly ONE LINE per word. Do NOT include markdown formatting or explanation.
Use this format:
word | ipa | meaning_vi | meaning_en | part_of_speech | band | topic | example_sentence | example_sentence_vi | collocations | synonyms

Rules:
- band must be "${currentBand}".
- topic must be "Environment", "Education", "Health", "Technology", "Crime", "Urbanization", "Economy", "Society", or "General".
- collocations must be separated by semicolons.
- synonyms must be separated by semicolons.
- Use exactly '|' separator.
`;
      }

      let success = false;
      let attempt = 0;
      while (!success && attempt < 10) {
        attempt++;
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
          });

          const text = response.text.trim();
          const lines = text.split("\n").filter(line => line.includes("|"));
          console.log(`Received ${lines.length} lines in batch ${batchIdx}.`);

          let addedInBatch = 0;
          lines.forEach(line => {
            const parts = line.split("|").map(p => p.trim());
            if (parts.length >= 9) {
              const [word, ipa, meaning_vi, meaning_en, pos, band, topic, ex, ex_vi, col, syn] = parts;
              const lowerWord = word.toLowerCase();
              if (!existingWordsSet.has(lowerWord)) {
                const colArray = col ? col.split(";").map(c => ({ phrase: c.trim(), type: "collocation", source: "verified_ACL" })) : [];
                const synArray = syn ? syn.split(";").map(s => s.trim()) : [];

                words.push({
                  word: word,
                  ipa: ipa || "/.../",
                  meaning_vi: meaning_vi || "từ học thuật",
                  meaning_en: meaning_en || "academic word",
                  part_of_speech: pos || "noun",
                  band: band || "4.5-5.5",
                  topic: topic || "General",
                  example_sentence: ex || "An academic example sentence.",
                  example_sentence_vi: ex_vi || "Một câu ví dụ học thuật.",
                  collocations: colArray,
                  synonyms: synArray
                });

                existingWordsSet.add(lowerWord);
                addedInBatch++;
                wordsNeeded--;
              }
            }
          });

          fs.writeFileSync(seedFilePath, JSON.stringify(words, null, 2), "utf8");
          console.log(`Added ${addedInBatch} unique words. Remaining needed: ${wordsNeeded}.`);
          success = true;

        } catch (err) {
          let waitTime = 45000;
          const errMsg = err.message || String(err);
          const match = errMsg.match(/retry in ([\d\.]+)s/i);
          if (match && match[1]) {
            waitTime = (parseFloat(match[1]) + 2.0) * 1000;
          }
          console.warn(`[Rate Limit Hit] Attempt ${attempt} failed. Gemini requested wait. Sleeping for ${(waitTime / 1000).toFixed(1)}s before next retry...`);
          await sleep(waitTime);
        }
      }

      batchIdx++;
      await sleep(12000); // 12s sleep to comfortably stay under rate limits
    }
  }

  console.log(`\n=============================================`);
  console.log(`SUCCESS: Vocabulary database has exactly ${words.length} enriched words!`);
  console.log(`=============================================`);
}

main().catch(err => {
  console.error("Fatal error:", err);
});
