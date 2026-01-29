/**
 * Text-to-Speech - המרת טקסט לקול
 *
 * שימוש ב-OpenAI TTS לאיכות גבוהה
 * קולות זמינים: alloy, echo, fable, onyx, nova, shimmer
 * nova - מתאים לעברית, קול נשי טבעי
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * יוצר קובץ אודיו מטקסט באמצעות OpenAI TTS
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  console.log(`🔊 TTS: ממיר "${text.substring(0, 50)}..." לאודיו`);

  const response = await openai.audio.speech.create({
    model: "tts-1", // tts-1 מהיר, tts-1-hd איכותי יותר
    voice: "nova", // קול נשי טבעי - מתאים למירי
    input: text,
    response_format: "wav" // ימות תומך ב-wav
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`✅ TTS: נוצר קובץ אודיו (${buffer.length} bytes)`);
  return buffer;
}

/**
 * מעלה קובץ אודיו לימות המשיח
 */
export async function uploadToYemot(
  audioBuffer: Buffer,
  targetPath: string
): Promise<string> {
  const token = `${process.env.YEMOT_SYSTEM}:${process.env.YEMOT_PASSWORD}`;

  console.log(`📤 מעלה קובץ לימות: ${targetPath}`);

  const formData = new FormData();
  formData.append("token", token);
  formData.append("path", targetPath);
  formData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "response.wav");

  const response = await fetch("https://www.call2all.co.il/ym/api/UploadFile", {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  console.log(`📥 תשובה מימות:`, result);

  if (result.responseStatus !== "OK") {
    throw new Error(`שגיאה בהעלאה: ${result.message || JSON.stringify(result)}`);
  }

  console.log(`✅ קובץ הועלה בהצלחה: ${targetPath}`);
  return targetPath;
}

/**
 * תהליך מלא: טקסט -> אודיו -> העלאה לימות
 * מחזיר את הנתיב להשמעה
 */
export async function generateAndUploadAudio(
  text: string,
  callId: string
): Promise<string> {
  // יצירת אודיו
  const audioBuffer = await textToSpeech(text);

  // נתיב ייחודי לכל שיחה
  const fileName = `ai_response_${Date.now()}`;
  const targetPath = `ivr2:ai_responses/${fileName}.wav`;

  // העלאה לימות
  await uploadToYemot(audioBuffer, targetPath);

  // מחזיר את הנתיב להשמעה (ללא ivr2:)
  return `ai_responses/${fileName}`;
}
