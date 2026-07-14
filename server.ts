import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Writing Task 2 Feedback API
app.post("/api/writing/feedback", async (req, res) => {
  try {
    const { essay, prompt, topic } = req.body;

    if (!essay || !prompt) {
      return res.status(400).json({ error: "Missing essay or prompt" });
    }

    const systemInstruction = `You are an expert IELTS Writing examiner. Evaluate the user's IELTS Writing Task 2 essay based on the official IELTS band descriptors.
Provide strict and highly professional feedback separated clearly into the 4 core criteria:
1. Task Response (TR)
2. Coherence and Cohesion (CC)
3. Lexical Resource (LR) - Suggest academic synonym improvements (like Academic Word List or Academic Collocation List) for repeating or weak words.
4. Grammatical Range and Accuracy (GRA)

Also, perform a meticulous sentence-by-sentence proofreading. For ANY sentence containing errors (grammar, vocabulary, style, punctuation), you MUST extract the EXACT original sentence, provide the corrected version, explain the error clearly in Vietnamese, and categorize it with a specific error_type and root_cause.

You MUST use ONLY the following exact keys for error_type:
- "collocation_wrong": Incorrect word combinations
- "word_choice_unnatural": Unnatural word choices
- "word_form_incorrect": Incorrect noun/verb/adj/adv form
- "repetition_excessive": Excessive repetition
- "tense_error": Verb tense errors
- "subject_verb_agreement": Subject-verb disagreement
- "article_error": Article errors (a/an/the)
- "preposition_incorrect": Incorrect prepositions
- "run_on_sentence": Run-on sentence errors
- "sentence_fragment": Sentence fragments
- "punctuation_error": Punctuation errors
- "redundancy": Wordy or redundant expressions
- "informal_tone": Academic tone is too informal
- "cohesion_weak": Weak connecting words or cohesion

You MUST use ONLY the following exact keys for root_cause:
- "vietnamese_interference": Directly translating from Vietnamese thinking
- "overgeneralization": Generalizing a rule too far
- "insufficient_exposure": Lack of familiarity with standard academic English
- "carelessness": Simple mistakes, typos, slips
- "unknown": Unclear cause

Provide an estimated overall band range (e.g., "5.5 - 6.0") and individual band scores (e.g., "6.0") for each criteria. Do not chot (finalize) a precise single number; make it a range for the overall score. Include a professional disclaimer that this is an AI tool for training only.

Return your response STRICTLY as a JSON object adhering to the specified schema.`;

    const modelPrompt = `Topic/Theme: ${topic || "General"}
IELTS Writing Task 2 Prompt:
"${prompt}"

User's Essay:
"""
${essay}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: modelPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bandRange: {
              type: Type.STRING,
              description: "The estimated overall band range, e.g., '5.5 - 6.0' or '6.5 - 7.0'.",
            },
            criteria: {
              type: Type.OBJECT,
              properties: {
                taskResponse: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING, description: "IELTS Criteria Band Score, e.g. '6.0'" },
                    feedback: { type: Type.STRING, description: "Detailed structural feedback." },
                  },
                  required: ["score", "feedback"],
                },
                coherenceCohesion: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING, description: "IELTS Criteria Band Score, e.g. '5.5'" },
                    feedback: { type: Type.STRING, description: "Detailed Coherence & Cohesion feedback." },
                  },
                  required: ["score", "feedback"],
                },
                lexicalResource: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING, description: "IELTS Criteria Band Score, e.g. '6.0'" },
                    feedback: { type: Type.STRING, description: "Detailed Lexical Resource feedback." },
                    vocabularySuggestions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          original: { type: Type.STRING, description: "The weak or repeated word/phrase in user's text." },
                          suggested: { type: Type.STRING, description: "A high-scoring academic synonym/phrase." },
                          explanation: { type: Type.STRING, description: "Brief justification on why this improves the band." },
                        },
                        required: ["original", "suggested", "explanation"],
                      },
                    },
                  },
                  required: ["score", "feedback", "vocabularySuggestions"],
                },
                grammaticalRange: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING, description: "IELTS Criteria Band Score, e.g. '5.5'" },
                    feedback: { type: Type.STRING, description: "Detailed Grammatical Range & Accuracy feedback." },
                  },
                  required: ["score", "feedback"],
                },
              },
              required: ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRange"],
            },
            sentenceCorrections: {
              type: Type.ARRAY,
              description: "List of precise grammatical or stylistic sentence-level corrections.",
              items: {
                type: Type.OBJECT,
                properties: {
                  originalSentence: {
                    type: Type.STRING,
                    description: "The EXACT sentence with errors extracted from user's essay.",
                  },
                  correctedSentence: {
                    type: Type.STRING,
                    description: "The corrected and polished version of that sentence.",
                  },
                  errorExplanation: {
                    type: Type.STRING,
                    description: "Explanation of what error occurred and how it was fixed in Vietnamese.",
                  },
                  category: {
                    type: Type.STRING,
                    description: "Error category, must be one of: 'Grammar', 'Vocabulary', 'Punctuation', 'Style'.",
                  },
                  error_type: {
                    type: Type.STRING,
                    description: "Specific standard error type: 'collocation_wrong', 'word_choice_unnatural', 'word_form_incorrect', 'repetition_excessive', 'tense_error', 'subject_verb_agreement', 'article_error', 'preposition_incorrect', 'run_on_sentence', 'sentence_fragment', 'punctuation_error', 'redundancy', 'informal_tone', 'cohesion_weak'.",
                  },
                  root_cause: {
                    type: Type.STRING,
                    description: "Root cause of error: 'vietnamese_interference', 'overgeneralization', 'insufficient_exposure', 'carelessness', 'unknown'.",
                  },
                },
                required: ["originalSentence", "correctedSentence", "errorExplanation", "category", "error_type", "root_cause"],
              },
            },
            overallSummary: {
              type: Type.STRING,
              description: "Concluding overall summary of strengths, major areas to work on, and actionable advice.",
            },
            disclaimer: {
              type: Type.STRING,
              description: "Disclaimer stating this evaluation is AI-generated and meant for practice guidance only.",
            },
          },
          required: ["bandRange", "criteria", "sentenceCorrections", "overallSummary", "disclaimer"],
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error generating Writing Task 2 feedback:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// Speaking Practice & Shadowing Evaluation API
app.post("/api/speaking/feedback", async (req, res) => {
  try {
    const { recognizedText, targetText, topic, part } = req.body;

    if (!recognizedText) {
      return res.status(400).json({ error: "Missing recognizedText" });
    }

    const systemInstruction = `You are an expert IELTS Speaking coach. Analyze the user's spoken transcription and evaluate it.
If the practice mode is Shadowing (where a targetText model answer is provided), compare the user's spoken recognizedText with the targetText.
Identify if any differences constitute actual grammatical errors, unnatural collocations, or pronunciation/ending drops (like dropped 's'/'ed'), rather than simple minor synonyms.
If the practice mode is General Speaking, evaluate the user's spoken recognizedText directly for grammatical correctness, vocabulary appropriateness, and IELTS suitability.

Return your evaluation STRICTLY as a JSON object matching the defined schema. Use Vietnamese for explanations.

You MUST use ONLY the following exact keys for error_type:
- "collocation_wrong": Incorrect word combinations
- "word_choice_unnatural": Unnatural word choices
- "word_form_incorrect": Incorrect noun/verb/adj/adv form
- "repetition_excessive": Excessive repetition
- "tense_error": Verb tense errors
- "subject_verb_agreement": Subject-verb disagreement
- "article_error": Article errors (a/an/the)
- "preposition_incorrect": Incorrect prepositions
- "run_on_sentence": Run-on sentence errors
- "sentence_fragment": Sentence fragments
- "final_consonant_dropped": Dropped final consonant like /s/, /z/, /t/, /d/, /ed/
- "pronunciation_incorrect": Pronunciation or word stress mistakes
- "intonation_flat": Speaking with flat or monotonous voice
- "hesitation_excessive": Excessive hesitation or filler words
- "punctuation_error": Punctuation errors
- "redundancy": Wordy or redundant expressions
- "informal_tone": Academic tone is too informal
- "cohesion_weak": Weak connecting words or cohesion

You MUST use ONLY the following exact keys for root_cause:
- "vietnamese_interference": Directly translating from Vietnamese thinking
- "overgeneralization": Generalizing a rule too far
- "insufficient_exposure": Lack of familiarity with standard English
- "carelessness": Simple mistakes, slips, typos
- "unknown": Unclear cause`;

    const modelPrompt = `Practice Topic: ${topic || "General"}
IELTS Part: ${part || "Pronunciation/Shadowing"}
Target Reference Model Answer (Optional): "${targetText || ""}"
User Spoken Transcript: "${recognizedText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: modelPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasErrors: {
              type: Type.BOOLEAN,
              description: "Whether the user's speech has grammatical, collocation, word choice or final-consonant drop errors."
            },
            feedbackSummary: {
              type: Type.STRING,
              description: "A friendly coaching feedback in Vietnamese highlighting what was good and what to focus on."
            },
            errors: {
              type: Type.ARRAY,
              description: "List of precise mistakes found in the spoken transcript.",
              items: {
                type: Type.OBJECT,
                properties: {
                  originalSentence: {
                    type: Type.STRING,
                    description: "The part of the user transcript containing the error."
                  },
                  correctedSentence: {
                    type: Type.STRING,
                    description: "The corrected, native, polished version of that sentence/phrase."
                  },
                  errorExplanation: {
                    type: Type.STRING,
                    description: "A clear explanation in Vietnamese pointing out the exact issue."
                  },
                  error_type: {
                    type: Type.STRING,
                    description: "Standard error_type key."
                  },
                  root_cause: {
                    type: Type.STRING,
                    description: "Standard root_cause key."
                  }
                },
                required: ["originalSentence", "correctedSentence", "errorExplanation", "error_type", "root_cause"]
              }
            }
          },
          required: ["hasErrors", "feedbackSummary", "errors"]
        }
      }
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error evaluating speaking feedback:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// Paraphrasing Trainer API
app.post("/api/writing/paraphrase", async (req, res) => {
  try {
    const { originalSentence, userParaphrase } = req.body;

    if (!originalSentence || !userParaphrase) {
      return res.status(400).json({ error: "Missing original sentence or paraphrase attempt" });
    }

    const systemInstruction = `You are an academic English tutor focusing on teaching IELTS paraphrasing skills.
Evaluate whether the student's paraphrased sentence preserves the meaning of the original sentence while sufficiently changing its syntax, vocabulary, or grammatical structures. Avoid acknowledging mere replacements of 1-2 words as strong paraphrasing.

Return your evaluation STRICTLY as a JSON object matching the defined schema. Use Vietnamese for explanations and feedback.`;

    const modelPrompt = `Original Sentence: "${originalSentence}"
Student's Paraphrase: "${userParaphrase}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: modelPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMeaningPreserved: {
              type: Type.BOOLEAN,
              description: "Whether the user's paraphrase keeps the exact original meaning.",
            },
            isSufficientlyChanged: {
              type: Type.BOOLEAN,
              description: "Whether the syntax/vocabulary is sufficiently restructured instead of just replacing minor synonyms.",
            },
            score: {
              type: Type.INTEGER,
              description: "Overall paraphrasing effectiveness score from 1 (poor/plagiarized) to 10 (perfect academic paraphrase).",
            },
            feedback: {
              type: Type.STRING,
              description: "Detailed critique pointing out what worked and what could be improved, written in Vietnamese.",
            },
            suggestedVersion: {
              type: Type.STRING,
              description: "A professional, high-scoring IELTS model paraphrase for reference.",
            },
          },
          required: ["isMeaningPreserved", "isSufficientlyChanged", "score", "feedback", "suggestedVersion"],
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error evaluating paraphrase:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// Export app for serverless platforms like Vercel
export default app;

// Setup Vite Dev Middleware / Static Assets serving
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not running in the Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
