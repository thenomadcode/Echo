import OpenAI from "openai";
import type { AIProvider, CompleteParams, CompleteResult, Message } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 4096;

function getConfiguredModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

function getConfiguredMaxTokens(): number {
  const envValue = process.env.AI_MAX_TOKENS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MAX_TOKENS;
}

function usesResponsesAPI(model: string): boolean {
  return model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4");
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass apiKey to constructor."
      );
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model ?? getConfiguredModel();
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    if (usesResponsesAPI(this.model)) {
      return this.completeWithResponsesAPI(params);
    }

    return this.completeWithChatAPI(params);
  }

  private async completeWithResponsesAPI(params: CompleteParams): Promise<CompleteResult> {
    const { messages, systemPrompt, maxTokens, responseFormat } = params;
    // Reasoning models need many tokens for thinking + output
    const tokenLimit = Math.max(maxTokens ?? getConfiguredMaxTokens(), 16384);

    const inputItems: OpenAI.Responses.ResponseInputItem[] = messages.map((msg, index) => {
      let content = msg.content;
      if (responseFormat === "json" && index === messages.length - 1 && msg.role === "user") {
        content = `${content}\n\nRespond in JSON format.`;
      }
      return {
        type: "message" as const,
        role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content,
      };
    });

    const requestParams: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model: this.model,
      input: inputItems,
      max_output_tokens: tokenLimit,
      instructions: systemPrompt,
    };

    if (responseFormat === "json") {
      requestParams.text = {
        format: { type: "json_object" },
      };
    }

    const response = await this.client.responses.create(requestParams);

    const outputText = response.output_text ?? "";

    return {
      content: outputText,
      tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      model: response.model,
    };
  }

  private async completeWithChatAPI(params: CompleteParams): Promise<CompleteResult> {
    const { messages, systemPrompt, temperature, maxTokens, responseFormat } = params;
    const tokenLimit = maxTokens ?? getConfiguredMaxTokens();

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: Message) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: chatMessages,
      temperature: temperature ?? 0.7,
      max_tokens: tokenLimit,
    };

    if (responseFormat === "json") {
      requestParams.response_format = { type: "json_object" };
    }

    const response = await this.client.chat.completions.create(requestParams);

    const content = response.choices[0]?.message?.content ?? "";

    return {
      content,
      tokensUsed: response.usage?.total_tokens ?? 0,
      model: response.model,
    };
  }
}

export function createOpenAIProvider(apiKey?: string, model?: string): OpenAIProvider {
  return new OpenAIProvider(apiKey, model);
}
