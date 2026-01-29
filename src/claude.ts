/**
 * יצירת תשובות עם Groq (Llama)
 */

import Groq from "groq-sdk";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// טעינת .env ידנית (רק אם קיים)
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    console.log("ℹ️ .env לא קיים - משתמש במשתני סביבה");
    return;
  }
  try {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join("=").trim();
        }
      }
    }
  } catch (e) {
    console.log("ℹ️ לא ניתן לטעון .env - משתמש במשתני סביבה");
  }
}

loadEnv();

const apiKey = process.env.GROQ_API_KEY;
console.log("🔑 Groq API Key loaded:", apiKey ? "✓ Yes" : "✗ No");

const groq = new Groq({
  apiKey: apiKey
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * מייצר תשובה בהתבסס על היסטוריית השיחה
 */
export async function generateResponse(
  systemPrompt: string,
  history: Message[]
): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        }))
      ]
    });

    return response.choices[0]?.message?.content || "מצטער, לא הצלחתי להבין. אפשר לחזור?";
  } catch (error) {
    console.error("❌ שגיאה ב-Groq:", error);
    throw error;
  }
}
