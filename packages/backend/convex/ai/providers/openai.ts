import type { AIProvider, CompleteParams, CompleteResult, Message } from "../types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "text" | "json_object" };
}

interface OpenAIChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass apiKey to constructor."
      );
    }
    this.apiKey = key;
    this.model = model ?? DEFAULT_MODEL;
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    const { messages, systemPrompt, temperature, maxTokens, responseFormat } = params;

    const openAIMessages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    const requestBody: OpenAIRequest = {
      model: this.model,
      messages: openAIMessages,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // OpenAI uses "json_object" for JSON response format
    if (responseFormat === "json") {
      requestBody.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      throw new Error(
        `Failed to connect to OpenAI API: ${error instanceof Error ? error.message : "Network error"}`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenAI API error (${response.status})`;

      try {
        const errorJson = JSON.parse(errorText) as OpenAIError;
        if (errorJson.error?.message) {
          errorMessage = `OpenAI API error: ${errorJson.error.message}`;
          if (errorJson.error.code) {
            errorMessage += ` (${errorJson.error.code})`;
          }
        }
      } catch {
        if (errorText) {
          errorMessage = `OpenAI API error (${response.status}): ${errorText}`;
        }
      }

      if (response.status === 401) {
        errorMessage = "OpenAI API authentication failed. Please check your API key.";
      } else if (response.status === 429) {
        errorMessage = "OpenAI API rate limit exceeded. Please try again later.";
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        errorMessage = "OpenAI API is temporarily unavailable. Please try again later.";
      }

      throw new Error(errorMessage);
    }

    let data: OpenAIResponse;
    try {
      data = (await response.json()) as OpenAIResponse;
    } catch {
      throw new Error("Failed to parse OpenAI API response as JSON");
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("OpenAI API returned no response choices");
    }

    const choice = data.choices[0];
    if (!choice?.message?.content) {
      throw new Error("OpenAI API response missing message content");
    }

    return {
      content: choice.message.content,
      tokensUsed: data.usage?.total_tokens ?? 0,
      model: data.model,
    };
  }
}

export function createOpenAIProvider(apiKey?: string, model?: string): OpenAIProvider {
  return new OpenAIProvider(apiKey, model);
}
