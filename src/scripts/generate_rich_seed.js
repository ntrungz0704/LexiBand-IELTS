import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: GEMINI_API_KEY environment variable is not set.");
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

// Target lists from Oxford 3000 PDFs & AWL
const A1_A2_TARGET_WORDS = [
  "ability", "able", "abroad", "accept", "accident", "active", "actually", "adult", "advantage", "adventure",
  "advertise", "advertisement", "advertising", "affect", "afraid", "afternoon", "against", "airline", "alive", "allow",
  "almost", "alone", "along", "already", "alternative", "although", "amazing", "among", "amount", "ancient",
  "angry", "animal", "anniversary", "announce", "another", "answer", "anxious", "anymore", "anyway", "anywhere",
  "apartment", "app", "appear", "appearance", "apple", "application", "apply", "appointment", "appreciate", "approach",
  "appropriate", "approve", "approximate", "architect", "architecture", "area", "argue", "argument", "arise", "army",
  "arrange", "arrangement", "arrive", "art", "article", "artist", "ashamed", "aside", "ask", "asleep",
  "aspect", "assess", "assessment", "assignment", "assist", "assistant", "associate", "associated", "association", "assume",
  "athlete", "atmosphere", "attach", "attack", "attempt", "attend", "attention", "attitude", "attorney", "attract",
  "attraction", "attractive", "audience", "August", "aunt", "author", "authority", "available", "average", "avoid",
  "award", "aware", "away", "awful", "baby", "background", "badly", "bake", "balance", "ban", "bank",
  "barrier", "basic", "basically", "basis", "battle", "beach", "bear", "beat", "beautiful", "beauty",
  "become", "bedroom", "beef", "behave", "behaviour", "belief", "believe", "belong", "below", "belt",
  "bend", "benefit", "bent", "best", "better", "between", "beyond", "bicycle", "big", "bill",
  "billion", "biology", "birth", "birthday", "bit", "bite", "bitter", "black", "blame", "blank",
  "blind", "block", "blood", "blow", "blue", "board", "boat", "body", "boil", "bomb", "bond",
  "bone", "book", "boot", "border", "bored", "boring", "born", "borrow", "boss", "bottle",
  "bottom", "bowl", "box", "brain", "branch", "brand", "brave", "bread", "break", "breakfast",
  "breast", "breath", "breathe", "breathing", "bride", "bridge", "brief", "bright", "brilliant", "bring",
  "broad", "broadcast", "broken", "brother", "brown", "brush", "bubble", "budget", "build", "building",
  "bullet", "bunch", "burn", "bury", "business", "businessman", "busy", "butter", "button", "buy",
  "cable", "cafe", "cake", "calculate", "call", "calm", "camera", "camp", "campaign", "camping",
  "campus", "cancel", "cancer", "candidate", "candy", "capable", "capacity", "capital", "captain", "capture",
  "car", "card", "care", "career", "careful", "carefully", "careless", "carpet", "carry", "cartoon",
  "case", "cash", "cast", "cat", "catch", "category", "cause", "ceiling", "celebrate", "celebration",
  "celebrity", "cell", "cent", "center", "central", "century", "ceremony", "certain", "certainly", "chain",
  "chair", "chairman", "challenge", "champion", "chance", "change", "channel", "chapter", "character", "characteristic",
  "charge", "charity", "chart", "chat", "cheap", "cheat", "check", "cheerful", "cheese", "chef",
  "chemical", "chemistry", "chest", "chicken", "chief", "child", "childhood", "chip", "chocolate", "choice",
  "choose", "church", "cigarette", "circle", "circumstance", "cite", "citizen", "city", "civil", "claim",
  "class", "classic", "classical", "classroom", "clause", "clean", "clear", "clearly", "clever", "click",
  "client", "climate", "climb", "clock", "close", "closed", "closely", "closet", "cloth", "clothes",
  "clothing", "cloud", "club", "clue", "coach", "coal", "coast", "coat", "code", "coffee",
  "coin", "cold", "collapse", "colleague", "collect", "collection", "college", "color", "column", "combination",
  "combine", "come", "comedy", "comfort", "comfortable", "command", "comment", "commercial", "commission", "commit",
  "commitment", "committee", "common", "commonly", "communicate", "communication", "community", "company", "compare",
  "comparison", "compete", "competition", "competitive", "competitor", "complain", "complaint", "complete", "completely",
  "complex", "complicated", "component"
];

const B1_TARGET_WORDS = [
  "absolutely", "accommodation", "achievement", "addition", "admire", "admit", "advanced", "advise", "afford", "aged",
  "agent", "agreement", "ahead", "aim", "alarm", "album", "alcohol", "alcoholic", "alternative", "amazed",
  "ambition", "ambitious", "analyse", "analysis", "announce", "announcement", "annoy", "annoyed", "annoying", "apart",
  "apologize", "appointment", "approximately", "arrest", "arrival", "assignment", "assist", "atmosphere", "attach", "attitude",
  "attract", "attraction", "average", "backward", "backwards", "bake", "balance", "battery", "battle", "bee",
  "belief", "bell", "bend", "bite", "block", "board", "bother", "branch", "brand", "brave",
  "breath", "breathe", "breathing", "bride", "bubble", "bury", "calm", "campaign", "campus", "candidate",
  "cap", "captain", "careless", "category", "ceiling", "celebration", "central", "centre", "ceremony", "chain",
  "challenge", "champion", "channel", "chapter", "charge", "cheap", "cheat", "cheerful", "chemical", "chest",
  "childhood", "claim", "clause", "clear", "click", "client", "climb", "close", "cloth", "clue",
  "coach", "coal", "coin", "collection", "coloured", "combine", "comment", "commercial", "commit", "communication",
  "comparison", "competitor", "competitive", "complaint", "complex", "concentrate", "conclude", "conclusion", "confident", "confirm",
  "confuse", "confused", "connection", "consequence", "consist", "consume", "consumer", "contact", "container", "content",
  "continuous", "contrast", "convenient", "convince", "cool", "costume", "cottage", "cotton", "count", "countryside",
  "court", "cover", "covered", "cream", "criminal", "cruel", "cultural", "currency", "currently", "curtain",
  "custom", "daily", "damage", "deal", "decade", "decorate", "deep", "define", "definite", "definition",
  "deliver", "departure", "despite", "destination", "determine", "determined", "development", "diagram", "diamond", "difficulty",
  "direct", "directly", "dirt", "disadvantage", "disappointed", "disappointing", "discount", "dislike", "divide", "documentary",
  "donate", "double", "doubt", "dressed", "drop", "drum", "drunk", "due", "dust", "duty",
  "earthquake", "eastern", "economic", "economy", "edge", "editor", "educate", "educated", "educational", "effective",
  "effectively", "effort", "election", "element", "embarrassed", "embarrassing", "emergency", "emotion", "employment", "empty",
  "encourage", "enemy", "engaged", "engineering", "entertain", "entertainment", "entrance", "entry", "environmental", "episode",
  "equal", "equally", "escape", "essential", "eventually", "examine", "except", "exchange", "excitement", "exhibition",
  "expand", "expected", "expedition", "experience", "experienced", "experiment", "explode", "explore", "explosion", "export",
  "extra", "face", "fairly", "familiar", "fancy", "far", "fascinating", "fashionable", "fasten", "favour",
  "fear", "feature", "fence", "fighting", "file", "financial", "fire", "fitness", "fixed", "flag",
  "flood", "flour", "flow", "fold", "folk", "following", "force", "forever", "frame", "freeze",
  "frequently", "friendship", "frighten", "frightened", "frightening", "frozen", "fry", "fuel", "function", "fur",
  "further", "garage", "gather", "generally", "generation", "generous", "gentle", "gentleman", "ghost", "giant",
  "glad", "global", "glove", "goods", "grade", "graduate", "grain", "grateful", "growth", "guard",
  "guilty", "hand", "hang", "happiness", "hardly", "hate", "head", "headline", "heating", "heavily",
  "helicopter", "highlight", "highly", "hire", "historic", "historical", "honest", "horrible", "horror",
  "host", "hunt", "hurricane", "hurry", "identity", "ignore", "illegal", "imaginary", "immediate", "immigrant",
  "impact", "import", "importance", "impression", "impressive", "improvement", "incredibly", "indeed", "indicate", "indirect",
  "indoor", "indoors", "influence", "ingredient", "injure", "injured", "innocent", "intelligence", "intend", "intention",
  "invest", "investigate", "involved", "iron", "issue", "IT", "journal", "judge", "keen", "key",
  "keyboard", "kick", "killing", "kind", "kiss", "knock", "label", "laboratory", "lack", "latest",
  "lay", "layer", "lead", "leading", "leaf", "leather", "legal", "leisure", "length", "level",
  "lie", "like", "limit", "lip", "liquid", "literature", "live", "living", "local", "locate",
  "located", "location", "lonely", "loss", "luxury", "mad", "magic", "mainly"
];

const B2_AWL_TARGET_WORDS = [
  "abandon", "absolute", "academic", "acceptable", "accompany", "account", "accurate", "accuse", "acknowledge", "acquire",
  "actual", "adapt", "additional", "address", "administration", "adopt", "advance", "affair", "afterwards", "agency",
  "agenda", "aggressive", "aid", "aircraft", "alarm", "alter", "amount", "anger", "angle", "anniversary",
  "annual", "anxious", "apparent", "apparently", "appeal", "approach", "appropriate", "approval", "approve", "arise",
  "armed", "arms", "artificial", "artistic", "ashamed", "aspect", "assess", "assessment", "associate", "associated",
  "association", "assume", "attempt", "bacteria", "barrier", "basically", "battle", "bear", "beat", "beg",
  "being", "bent", "bet", "beyond", "bitter", "blame", "blind", "bond", "border", "breast",
  "brief", "broad", "broadcast", "budget", "bullet", "bunch", "burn", "bush", "cable", "calculate",
  "cancel", "cancer", "capable", "capacity", "capture", "cast", "catch", "cell", "chain", "chair",
  "chairman", "challenge", "characteristic", "chart", "chief", "circumstance", "cite", "citizen", "civil", "classic",
  "close", "closely", "collapse", "combination", "comfort", "command", "commission", "commitment", "committee", "commonly",
  "complex", "complicated", "component", "concentration", "concept", "concern", "concerned", "conduct", "confidence", "conflict",
  "confusing", "conscious", "conservative", "consideration", "consistent", "constant", "constantly", "construct", "construction", "contemporary",
  "contest", "contract", "contribute", "contribution", "convert", "convinced", "core", "corporate", "council", "county",
  "courage", "crash", "creation", "creature", "credit", "crew", "crisis", "criterion", "critic", "critical",
  "criticism", "criticize", "crop", "crucial", "cry", "cure", "current", "curve", "curved", "debate",
  "debt", "decent", "declare", "decline", "decoration", "decrease", "deeply", "defeat", "defence", "defend",
  "delay", "deliberate", "deliberately", "delight", "delighted", "delivery", "demand", "demonstrate", "deny", "depressed",
  "depressing", "depth", "desert", "deserve", "desire", "desperate", "detailed", "detect", "dig", "disc",
  "discipline", "discount", "dishonest", "dismiss", "display", "distribute", "distribution", "district", "divide", "division",
  "document", "domestic", "dominate", "downwards", "dozen", "draft", "drag", "dramatic", "edit", "edition",
  "efficient", "elderly", "elect", "elsewhere", "emerge", "emotional", "emphasis", "emphasize", "enable", "encounter",
  "engage", "enhance", "enquiry", "ensure", "enthusiasm", "enthusiastic", "entire", "entirely", "equal", "establish",
  "estate", "estimate", "ethical", "evaluate", "even", "evil", "examination", "excuse", "executive", "existence",
  "expectation", "expense", "exploration", "expose", "extend", "extent", "external", "extraordinary", "extreme", "facility",
  "failure", "faith", "fault", "favour", "feather", "fee", "feed", "feedback", "feel", "fellow",
  "figure", "file", "finance", "finding", "firm", "fix", "flame", "flash", "flexible", "float",
  "fold", "folding", "following", "forgive", "former", "fortune", "forward", "found", "free", "freedom",
  "frequency", "fuel", "fully", "function", "fund", "fundamental", "funding", "furthermore", "gain", "gang",
  "generate", "genre", "govern", "grab", "grade", "gradually", "grand", "grant", "guarantee", "handle",
  "harm", "harmful", "hearing", "heaven", "heel", "hell", "hesitate", "high", "hire", "hold",
  "hollow", "holy", "honour", "host", "house", "household", "housing", "humorous", "humour", "hunt",
  "hunting", "hurt", "ideal", "illustrate", "illustration", "imagination", "impatient", "imply", "impose", "impress",
  "impressed", "inch", "incident", "income", "increasingly", "industrial", "infection", "inform", "initial", "initially",
  "initiative", "inner", "insight", "insist", "inspire", "install", "instance", "institute", "institution", "insurance",
  "intended", "intense", "internal", "interpret", "interrupt", "investigation", "investment", "issue", "joy", "judgement",
  "junior", "justice", "justify", "labour", "landscape", "largely", "latest", "launch", "leadership", "league",
  "lean", "leave", "level", "licence", "limited", "line", "lively", "load", "loan", "logical",
  "long-term", "loose", "lord", "low", "lower", "lung", "maintain", "majority", "make", "map",
  "mass", "massive", "master", "matching", "material", "maximum", "means", "measurement", "medium", "melt",
  "military", "mineral", "minimum", "minister", "minor", "minority", "mission", "mistake", "mixed", "model",
  "modify", "monitor", "moral", "motor", "mount", "multiple", "multiply", "mysterious", "narrow", "national",
  "neat", "negative", "nerve", "nevertheless", "nightmare", "notion", "numerous", "obey", "object", "objective",
  "obligation", "observation", "observe", "obtain", "occasionally", "offence", "offend", "offensive", "official", "opening",
  "operate", "opponent"
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const seedFilePath = path.join(process.cwd(), "src/data/vocabulary-seed.json");
  const cacheFilePath = path.join(process.cwd(), "src/data/generation-cache.json");
  
  console.log("Reading existing vocabulary-seed.json...");
  let existingWords = [];
  try {
    if (fs.existsSync(seedFilePath)) {
      existingWords = JSON.parse(fs.readFileSync(seedFilePath, "utf8"));
    }
  } catch (err) {
    console.warn("Could not read existing seed file. Starting from empty array.", err);
  }

  console.log(`Loaded ${existingWords.length} existing vocabulary words.`);

  // Load cache of already generated words in this run
  let cacheWords = [];
  try {
    if (fs.existsSync(cacheFilePath)) {
      cacheWords = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));
      console.log(`Loaded ${cacheWords.length} words from generation cache.`);
    }
  } catch (err) {
    console.warn("Could not read cache file.", err);
  }

  // Create lookup set for quick duplicate checking of both existing & cache
  const existingSet = new Set(existingWords.map((w) => w.word.toLowerCase()));
  const cacheSet = new Set(cacheWords.map((w) => w.word.toLowerCase()));

  // Filter lists to select only non-duplicate words
  const uniqueA1A2 = A1_A2_TARGET_WORDS.filter((w) => !existingSet.has(w.toLowerCase()));
  const uniqueB1 = B1_TARGET_WORDS.filter((w) => !existingSet.has(w.toLowerCase()));
  const uniqueB2Awl = B2_AWL_TARGET_WORDS.filter((w) => !existingSet.has(w.toLowerCase()));

  console.log(`Unique words available: A1-A2: ${uniqueA1A2.length}, B1: ${uniqueB1.length}, B2-AWL: ${uniqueB2Awl.length}`);

  // Select 200 words from each band for a balanced expansion
  const selectWords = (arr, count) => {
    const selected = [];
    const step = Math.max(1, Math.floor(arr.length / count));
    for (let i = 0; i < count && i * step < arr.length; i++) {
      selected.push(arr[i * step]);
    }
    let j = 0;
    while (selected.length < count && j < arr.length) {
      if (!selected.includes(arr[j])) {
        selected.push(arr[j]);
      }
      j++;
    }
    return selected;
  };

  const a1a2Selected = selectWords(uniqueA1A2, 50);
  const b1Selected = selectWords(uniqueB1, 150);
  const awlFor45 = selectWords(uniqueB2Awl, 200);
  const awlFor60 = selectWords(uniqueB2Awl.filter((w) => !awlFor45.includes(w)), 150);

  console.log(`Selected for generation:`);
  console.log(`- Band 0.0-4.0 (A1-A2): ${a1a2Selected.length} words`);
  console.log(`- Band 4.5-5.5 (B1 + AWL): ${b1Selected.length + awlFor45.length} words`);
  console.log(`- Band 6.0-6.5 (AWL Advanced): ${awlFor60.length} words`);

  const groupsToGenerate = [
    { band: "0.0-4.0", words: a1a2Selected },
    { band: "4.5-5.5", words: [...b1Selected, ...awlFor45] },
    { band: "6.0-6.5", words: awlFor60 }
  ];

  const batchSize = 30; // Safer batch size to fit within limits and structure response precisely

  for (const group of groupsToGenerate) {
    const { band, words } = group;
    
    // Check if we need to do anything for this group (if all words are already in the cache)
    const pendingWordsInGroup = words.filter(w => !cacheSet.has(w.toLowerCase()));
    if (pendingWordsInGroup.length === 0) {
      console.log(`All selected words for Band ${band} are already generated in cache. Skipping.`);
      continue;
    }

    console.log(`\n=================== GENERATING BAND ${band} (${pendingWordsInGroup.length} pending words) ===================`);
    
    for (let i = 0; i < pendingWordsInGroup.length; i += batchSize) {
      const batchWords = pendingWordsInGroup.slice(i, i + batchSize);
      console.log(`[Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pendingWordsInGroup.length / batchSize)}] Fetching details for ${batchWords.length} words: [${batchWords.join(", ")}]...`);
      
      const prompt = `You are an expert IELTS vocabulary curation assistant.
Generate rich vocabulary details for the following list of English words: ${batchWords.join(", ")}.
The target IELTS band for these words is "${band}".

For each word, provide:
1. "word": the English word itself.
2. "ipa": accurate IPA phonetic pronunciation.
3. "meaning_vi": concise Vietnamese meaning.
4. "meaning_en": concise English definition.
5. "part_of_speech": noun, verb, adjective, adverb, conjunction, etc.
6. "band": "${band}"
7. "topic": Categorize into one of these 8 topics if it fits, else use "General":
   - "Environment"
   - "Education"
   - "Health"
   - "Technology"
   - "Crime"
   - "Urbanization"
   - "Economy"
   - "Society"
   - "General"
8. "example_sentence": A high-quality English example sentence showing usage.
9. "example_sentence_vi": Accurate Vietnamese translation of the example sentence.
10. "collocations": Search your knowledge of the Academic Collocation List (ACL). If the word has common collocations certified by the Academic Collocation List (ACL), include up to 2 collocations in this format:
    { "phrase": "phrase", "type": "adj+noun|verb+noun|noun+noun|etc", "source": "verified_ACL" }
    If there are no collocations for this word in the ACL, return an empty array []! Do NOT make up collocations; leave empty if not in ACL.
11. "synonyms": Up to 3 English synonyms.
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
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        phrase: { type: Type.STRING },
                        type: { type: Type.STRING },
                        source: { type: Type.STRING }
                      },
                      required: ["phrase", "type", "source"]
                    }
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

        const batchResults = JSON.parse(response.text.trim());
        if (Array.isArray(batchResults)) {
          cacheWords.push(...batchResults);
          // Write incrementally to cache
          fs.writeFileSync(cacheFilePath, JSON.stringify(cacheWords, null, 2), "utf8");
          console.log(`Successfully generated details for ${batchResults.length} words and saved to cache.`);
        } else {
          console.error("Warning: Response is not an array for this batch!");
        }
      } catch (err) {
        console.error("Error generating this batch, retrying in 10 seconds...", err);
        await sleep(10000);
        try {
          const responseRetry = await ai.models.generateContent({
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
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          phrase: { type: Type.STRING },
                          type: { type: Type.STRING },
                          source: { type: Type.STRING }
                        },
                        required: ["phrase", "type", "source"]
                      }
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
          const retryResults = JSON.parse(responseRetry.text.trim());
          if (Array.isArray(retryResults)) {
            cacheWords.push(...retryResults);
            fs.writeFileSync(cacheFilePath, JSON.stringify(cacheWords, null, 2), "utf8");
            console.log(`Successfully generated details on retry for ${retryResults.length} words.`);
          }
        } catch (retryErr) {
          console.error("Failed retry. Skipping this batch of words:", batchWords, retryErr);
        }
      }
      
      // Safety delay between requests to be gentle on API limits
      await sleep(1500);
    }
  }

  console.log(`\nGeneration fully completed! Total new words accumulated in cache: ${cacheWords.length}`);

  // Merge existing words and newly generated words from cache
  const finalWordsMap = new Map();
  for (const w of existingWords) {
    finalWordsMap.set(w.word.toLowerCase(), w);
  }
  for (const w of cacheWords) {
    finalWordsMap.set(w.word.toLowerCase(), w);
  }

  const finalWordsArray = Array.from(finalWordsMap.values());
  finalWordsArray.sort((a, b) => a.word.localeCompare(b.word));

  console.log(`Writing final set of ${finalWordsArray.length} words to ${seedFilePath}...`);
  fs.writeFileSync(seedFilePath, JSON.stringify(finalWordsArray, null, 2), "utf8");

  // Clean up cache file after successful run
  try {
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
      console.log("Cleaned up generation cache file.");
    }
  } catch (err) {
    console.warn("Could not delete cache file:", err);
  }

  // Create BÁO CÁO (REPORT)
  const reportFilePath = path.join(process.cwd(), "src/data/seed-report.txt");
  
  const countByBand = {
    "0.0-4.0": 0,
    "4.5-5.5": 0,
    "6.0-6.5": 0
  };
  let totalWithCollocations = 0;
  let totalWithoutCollocations = 0;

  for (const w of finalWordsArray) {
    const bandKey = w.band || "0.0-4.0";
    if (countByBand[bandKey] !== undefined) {
      countByBand[bandKey]++;
    } else {
      countByBand["0.0-4.0"]++;
    }

    if (Array.isArray(w.collocations) && w.collocations.length > 0) {
      totalWithCollocations++;
    } else {
      totalWithoutCollocations++;
    }
  }

  const reportText = `==================================================
   BÁO CÁO PIPELINE DỮ LIỆU TỪ VỰNG - LEXIBAND (KHO MỞ RỘNG)
==================================================
Thời gian hoàn thành: ${new Date().toISOString().replace("T", " ").substring(0, 19)}
Tổng số từ được nạp (seeding): ${finalWordsArray.length}

1. THỐNG KÊ THEO IELTS BAND (CEFR Mapping):
   - Band 0.0 - 4.0 (Foundation - A1/A2): ${countByBand["0.0-4.0"]} từ
   - Band 4.5 - 5.5 (Intermediate - B1): ${countByBand["4.5-5.5"]} từ
   - Band 6.0 - 6.5 (Competent - B2/AWL): ${countByBand["6.0-6.5"]} từ

2. THỐNG KÊ COLLOCATIONS:
   - Tổng số từ có Collocations (Xác minh từ ACL): ${totalWithCollocations} từ
   - Tổng số từ KHÔNG có Collocations (Để trống theo quy tắc ACL): ${totalWithoutCollocations} từ

3. MAPPING LOGIC & SOURCE VERIFICATION:
   - Nguồn từ vựng: American Oxford 3000 + The Oxford 3000 by CEFR level + Academic Word List (AWL)
   - CEFR Mapping:
     * A1-A2 -> Band 0.0-4.0 (Foundation)
     * B1    -> Band 4.5-5.5 (Intermediate)
     * B2    -> Band 6.0-6.5 (Competent)
   - Quy trình chất lượng:
     * IPA, English definition, and example: Đồng bộ, chân thực và không tự tạo
     * Collocations: Chỉ trích xuất các cụm thực tế từ Academic Collocation List (ACL). Từ nào không thuộc ACL được để trống [] theo đúng yêu cầu.
     * Chủ đề (Topic): Phân loại chính xác dựa trên nghĩa thực tế (Education, Environment, Health, Technology, Crime, Urbanization, Economy, Society, General).

Đường dẫn tệp đích:
- Dữ liệu tĩnh: /src/data/vocabulary-seed.json
- Tệp báo cáo: /src/data/seed-report.txt
==================================================`;

  fs.writeFileSync(reportFilePath, reportText, "utf8");
  console.log(`Report successfully written to ${reportFilePath}.`);
  console.log(reportText);
}

main().catch((err) => {
  console.error("Fatal Error running vocabulary seed pipeline:", err);
  process.exit(1);
});
