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

async function test() {
  console.log("Sending diagnostic request to Gemini API...");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: "Translate 'abundant' and 'accelerate' to Vietnamese for IELTS. Return as simple JSON list of words.",
      config: {
        responseMimeType: "application/json",
      }
    });
    console.log("SUCCESS! Response from Gemini:");
    console.log(response.text);
  } catch (err) {
    console.error("FAILED! Gemini API Error:", err);
  }
}

test();
