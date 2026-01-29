/**
 * עוזר קולי AI עם ימות המשיח
 *
 * גרסה: 2.0 - Production Ready
 */

import { Hono } from "hono";
import { Resend } from "resend";
import { generateResponse } from "./claude";
import { config, replacePlaceholders, printConfig } from "./config";

// Resend client for emails
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const app = new Hono();

// מאגר שיחות פעילות
const conversations: Map<string, {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  collectedData: Record<string, string>;
}> = new Map();

// מאגר שיחות שהסתיימו (למניעת התחלה מחדש)
const completedCalls: Set<string> = new Set();

/**
 * מנקה טקסט לשליחה ל-TTS של ימות
 * חשוב: פסיקים שוברים את פורמט ה-read command!
 */
function cleanTextForTts(text: string): string {
  return text
    .replace(/ת"ז/g, "תעודת זהות")  // ת"ז -> תעודת זהות
    .replace(/[.!?;:,]/g, " ")  // כל סימני פיסוק הופכים לרווח
    .replace(/["'״׳`]/g, "")    // הסרת גרשיים ומירכאות
    .replace(/[-–—]/g, " ")     // מקפים הופכים לרווח
    .replace(/\s+/g, " ")       // רווחים כפולים הופכים לאחד
    .trim();
}

/**
 * יוצר תשובה עם בקשת הקלטה או סיום
 */
function createResponse(text: string, waitForRecording: boolean = true): string {
  const cleanText = cleanTextForTts(text);

  if (waitForRecording) {
    return `read=t-${cleanText}=record_file,no,voice,he-IL`;
  } else {
    return `id_list_message=t-${cleanText}`;
  }
}

/**
 * שולח סיכום במייל
 */
async function sendSummaryEmail(callId: string, phone: string, history: Array<{ role: string; content: string }>) {
  const email = config.notificationEmail;
  if (!email) {
    console.log("⚠️ לא הוגדר NOTIFICATION_EMAIL - לא נשלח מייל");
    return;
  }

  const summary = history.map(msg =>
    `${msg.role === "user" ? "👤 מתקשר" : "🤖 מירי"}: ${msg.content}`
  ).join("\n");

  const htmlSummary = history.map(msg =>
    `<p><strong>${msg.role === "user" ? "👤 מתקשר" : "🤖 מירי"}:</strong> ${msg.content}</p>`
  ).join("");

  console.log(`📧 סיכום לשליחה למייל ${email}:`);
  console.log(`📞 מספר: ${phone}`);
  console.log(`🆔 CallID: ${callId}`);
  console.log(`💬 שיחה:\n${summary}`);

  if (!resend) {
    console.log("⚠️ לא הוגדר RESEND_API_KEY - לא נשלח מייל");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "עוזר קולי <onboarding@resend.dev>",
      to: email,
      subject: `📞 שיחה חדשה מ-${phone} - ${config.organization.name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>📞 סיכום שיחה</h2>
          <p><strong>מספר מתקשר:</strong> ${phone}</p>
          <p><strong>מזהה שיחה:</strong> ${callId}</p>
          <p><strong>זמן:</strong> ${new Date().toLocaleString("he-IL")}</p>
          <hr>
          <h3>💬 השיחה:</h3>
          ${htmlSummary}
          <hr>
          <p style="color: #666; font-size: 12px;">נשלח אוטומטית מ-${config.organization.name}</p>
        </div>
      `
    });

    if (error) {
      console.error("❌ שגיאה בשליחת מייל:", error);
    } else {
      console.log("✅ מייל נשלח בהצלחה:", data?.id);
    }
  } catch (err) {
    console.error("❌ שגיאה בשליחת מייל:", err);
  }
}

// הכנת הפרומפט עם placeholders
const SYSTEM_PROMPT = replacePlaceholders(config.systemPrompt);
const GREETING = replacePlaceholders(config.greeting);

/**
 * Endpoint ראשי - מקבל בקשות מימות המשיח
 */
app.all("/yemot", async (c) => {
  const startTime = Date.now();

  // קבלת פרמטרים (GET או POST)
  const params = c.req.method === "GET"
    ? Object.fromEntries(new URL(c.req.url).searchParams)
    : await c.req.parseBody();

  const callId = (params.ApiCallId || params.callId || params.call_id) as string;
  const phone = (params.ApiPhone || params.phone || params.caller_id) as string;

  console.log(`\n📞 ${phone} | ${callId?.slice(0, 8)}...`);

  // בדיקה אם זו בקשת ניתוק
  if (params.hangup === "yes") {
    console.log("👋 נותק");
    conversations.delete(callId);
    completedCalls.delete(callId);
    return c.text("ok");
  }

  // בדיקה אם השיחה כבר הסתיימה
  if (completedCalls.has(callId)) {
    console.log("🔚 שיחה שהסתיימה - מנתק");
    completedCalls.delete(callId);
    return c.text("hangup");
  }

  const recordedFile = params.record_file as string;

  // שיחה חדשה או המשך?
  if (!recordedFile) {
    const existingConversation = conversations.get(callId);
    if (existingConversation && existingConversation.history.length > 0) {
      console.log("🔄 ללא הקלטה - מבקש שוב");
      return c.text("read=t-לא שמעתי אפשר לחזור=record_file,no,voice,he-IL");
    }

    // שיחה חדשה
    console.log("🆕 שיחה חדשה");
    conversations.set(callId, { history: [], collectedData: {} });

    const response = createResponse(GREETING, true);
    console.log(`📤 ${response.slice(0, 50)}...`);
    return c.text(response);
  }

  // יש הקלטה - מעבד
  let transcript = recordedFile;

  // בדיקה אם זה מספר ת"ז
  const digitsOnly = transcript.replace(/\D/g, "");
  if (digitsOnly.length >= 5 && digitsOnly.length <= 12) {
    if (digitsOnly.length === 9) {
      transcript = `${transcript} (זה ${digitsOnly.length} ספרות: ${digitsOnly})`;
    }
  }

  console.log(`🎤 "${transcript}"`);

  try {
    let conversation = conversations.get(callId);
    if (!conversation) {
      conversation = { history: [], collectedData: {} };
      conversations.set(callId, conversation);
    }

    conversation.history.push({ role: "user", content: transcript });

    // יצירת תשובה עם AI
    console.log("🤖 מייצר תשובה...");
    const aiStartTime = Date.now();
    const response = await generateResponse(SYSTEM_PROMPT, conversation.history);
    console.log(`💬 "${response}" (${Date.now() - aiStartTime}ms)`);

    conversation.history.push({ role: "assistant", content: response });

    // בדיקה אם סיימנו
    const isComplete = response.includes("תודה") && (
      response.includes("ניצור קשר") ||
      response.includes("יום טוב") ||
      response.includes("להתראות")
    );

    if (isComplete) {
      console.log("✅ סיום");
      await sendSummaryEmail(callId, phone, conversation.history);
      completedCalls.add(callId);
      conversations.delete(callId);

      const finalResponse = createResponse(response, false);
      console.log(`⏱️ סה"כ: ${Date.now() - startTime}ms`);
      return c.text(finalResponse);
    }

    // המשך שיחה
    const continueResponse = createResponse(response, true);
    console.log(`⏱️ סה"כ: ${Date.now() - startTime}ms`);
    return c.text(continueResponse);

  } catch (error) {
    console.error("❌ שגיאה:", error);
    return c.text("id_list_message=t-מצטערת קרתה שגיאה אנא נסה שוב");
  }
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    time: new Date().toISOString(),
    activeConversations: conversations.size,
    config: {
      organization: config.organization.name,
      aiProvider: config.ai.provider,
    }
  });
});

// דף בית
app.get("/", (c) => {
  return c.html(`
    <html dir="rtl">
      <head>
        <title>עוזר קולי AI - ${config.organization.name}</title>
        <style>
          body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
          h1 { color: #333; }
          .status { background: #e8f5e9; padding: 15px; border-radius: 8px; }
          code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🤖 עוזר קולי AI</h1>
        <div class="status">
          <p>✅ השרת פעיל</p>
          <p>🏢 ארגון: <strong>${config.organization.name}</strong></p>
          <p>📞 טלפון ימות: <code>${config.yemot.phone}</code></p>
          <p>🤖 מודל: <code>${config.ai.provider}</code></p>
          <p>💬 שיחות פעילות: <strong>${conversations.size}</strong></p>
        </div>
      </body>
    </html>
  `);
});

// הפעלת השרת
printConfig();
console.log(`🚀 שרת פעיל על פורט ${config.port}`);
console.log(`🔗 Webhook: https://YOUR_DOMAIN/yemot\n`);

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  fetch: app.fetch
});

console.log(`✅ Server running at http://${server.hostname}:${server.port}`);
