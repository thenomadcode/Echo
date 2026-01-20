import { v } from "convex/values";
import { action } from "../_generated/server";
import { createOpenAIProvider } from "./providers/openai";

type LanguageCode = "en" | "es" | "pt";

export interface LanguageResult {
  language: LanguageCode;
  tokensUsed: number;
}

const DEFAULT_LANGUAGE: LanguageCode = "en";

function extractLanguageCode(response: string): string {
  const cleaned = response
    .replace(/['"]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .trim();
  
  if (cleaned.includes("spanish") || cleaned.includes("español") || cleaned === "es") {
    return "es";
  }
  if (cleaned.includes("portuguese") || cleaned.includes("português") || cleaned === "pt") {
    return "pt";
  }
  if (cleaned.includes("english") || cleaned.includes("inglés") || cleaned === "en") {
    return "en";
  }
  
  const codeMatch = cleaned.match(/\b(es|pt|en)\b/);
  if (codeMatch) {
    return codeMatch[1];
  }
  
  return cleaned;
}

const LANGUAGE_DETECTION_PROMPT = `You are a language detector. Analyze the following message and determine if it is written in:
- English (en)
- Spanish (es)
- Portuguese (pt)

Respond with ONLY the two-letter language code: "en", "es", or "pt".
If the message is ambiguous, mixed, or in another language, respond with "en".
If the message contains only numbers, emojis, or is too short to determine, respond with "en".

Message to analyze:`;

export const detectLanguage = action({
  args: {
    message: v.string(),
  },
  handler: async (_ctx, args): Promise<LanguageResult> => {
    const { message } = args;

    if (!message || message.trim().length === 0) {
      return { language: DEFAULT_LANGUAGE, tokensUsed: 0 };
    }

    const shortMessage = message.substring(0, 200);

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages: [{ role: "user", content: shortMessage }],
        systemPrompt: LANGUAGE_DETECTION_PROMPT,
        temperature: 0,
        maxTokens: 16,
        responseFormat: "text",
      });

      const rawResponse = result.content.trim().toLowerCase();
      console.log("Language detection raw response:", rawResponse);
      
      const detected = extractLanguageCode(rawResponse);
      console.log("Language detection extracted:", detected);

      let language: LanguageCode = DEFAULT_LANGUAGE;
      if (detected === "es") {
        language = "es";
      } else if (detected === "pt") {
        language = "pt";
      } else if (detected === "en") {
        language = "en";
      }

      return { language, tokensUsed: result.tokensUsed };
    } catch (error) {
      console.error(
        "Language detection failed, defaulting to English:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return { language: DEFAULT_LANGUAGE, tokensUsed: 0 };
    }
  },
});
