/**
 * הגדרות השרת - ניתן לשנות דרך משתני סביבה
 */

export const config = {
  // שרת
  port: parseInt(process.env.PORT || "3000"),

  // ימות המשיח
  yemot: {
    phone: process.env.YEMOT_PHONE || "0733182475",
    apiKey: process.env.YEMOT_API_KEY || "",
  },

  // מודל AI
  ai: {
    provider: process.env.AI_PROVIDER || "groq", // groq, anthropic, openai
    groqApiKey: process.env.GROQ_API_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
  },

  // הגדרות הקופה/ארגון
  organization: {
    name: process.env.ORG_NAME || "קופת טוב וחסד רחובות",
    verificationPhone: process.env.VERIFICATION_PHONE || "1800800567",
  },

  // הודעת פתיחה
  greeting: process.env.GREETING_MESSAGE ||
    "שלום וברוכים הבאים ל{ORG_NAME} אני מירי נעים מאוד איך קוראים לך",

  // פרומפט למודל
  systemPrompt: process.env.SYSTEM_PROMPT || `אתה מירי מ{ORG_NAME}. תפקידך: לאסוף 6 פרטים בלבד.

⚠️ חוק עליון: תשובות של 5-10 מילים בלבד! אף פעם יותר!

📋 הפרטים לאסוף (בסדר):
1. שם פרטי
2. שם משפחה
3. ת"ז (9 ספרות)
4. תאריך לידה
5. ילדים נשואים
6. ילדים רווקים

💬 איך לענות:
- קיבלת שם → "[שם] יופי! שם משפחה?"
- קיבלת ת"ז עם רווחים → אם סה"כ 9 ספרות = תקין!
- שאלו "מי אתה/איזה קופה" → "{ORG_NAME}. שם פרטי?"
- שאלו שאלה אחרת → "לשאלות: {PHONE}. נמשיך?"

❌ אסור:
- הסברים ארוכים
- לענות על שאלות לא קשורות
- לדלג על ת"ז

✅ בסוף:
"תודה! ניצור קשר. יום טוב!"`,

  // מייל להתראות
  notificationEmail: process.env.NOTIFICATION_EMAIL || "",

  // TTS
  useExternalTts: process.env.USE_EXTERNAL_TTS === "true",
};

/**
 * מחליף placeholders בטקסט
 */
export function replacePlaceholders(text: string): string {
  return text
    .replace(/\{ORG_NAME\}/g, config.organization.name)
    .replace(/\{PHONE\}/g, config.organization.verificationPhone);
}

/**
 * מדפיס את ההגדרות (ללא סודות)
 */
export function printConfig() {
  console.log(`
📋 הגדרות השרת:
   🏢 ארגון: ${config.organization.name}
   📞 טלפון אימות: ${config.organization.verificationPhone}
   🤖 מודל AI: ${config.ai.provider} (${config.ai.model})
   📧 מייל: ${config.notificationEmail || "לא הוגדר"}
   🔗 פורט: ${config.port}
`);
}
