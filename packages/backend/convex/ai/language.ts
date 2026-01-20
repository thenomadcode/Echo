import { v } from "convex/values";
import { action } from "../_generated/server";
import { createOpenAIProvider } from "./providers/openai";

type LanguageCode = "en" | "es" | "pt";

const DEFAULT_LANGUAGE: LanguageCode = "en";

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
  handler: async (_ctx, args): Promise<LanguageCode> => {
    const { message } = args;

    if (!message || message.trim().length === 0) {
      return DEFAULT_LANGUAGE;
    }

    const shortMessage = message.substring(0, 200);

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages: [{ role: "user", content: shortMessage }],
        systemPrompt: LANGUAGE_DETECTION_PROMPT,
        temperature: 0,
        maxTokens: 5,
        responseFormat: "text",
      });

      const detected = result.content.trim().toLowerCase();

      if (detected === "es" || detected === "spanish") {
        return "es";
      }
      if (detected === "pt" || detected === "portuguese") {
        return "pt";
      }
      if (detected === "en" || detected === "english") {
        return "en";
      }

      return DEFAULT_LANGUAGE;
    } catch (error) {
      console.error(
        "Language detection failed, defaulting to English:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return DEFAULT_LANGUAGE;
    }
  },
});
