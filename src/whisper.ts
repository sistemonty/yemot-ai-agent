/**
 * תמלול אודיו עם OpenAI Whisper
 * תמיכה מצוינת בעברית!
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * מתמלל קובץ אודיו לטקסט
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // יצירת File object מה-buffer
    const file = new File([audioBuffer], "audio.wav", { type: "audio/wav" });

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "he", // עברית
      response_format: "text"
    });

    return response.trim();
  } catch (error) {
    console.error("❌ שגיאה בתמלול:", error);
    throw error;
  }
}
