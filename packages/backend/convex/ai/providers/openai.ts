import OpenAI from "openai";
import type { Tool, ToolCall } from "../tools";
import type { AIProvider, CompleteParams, CompleteResult, Message } from "../types";

const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_MAX_TOKENS = 4096;

export interface CompleteWithToolsParams {
	messages: Message[];
	systemPrompt: string;
	tools: Tool[];
	temperature?: number;
	maxTokens?: number;
}

export interface CompleteWithToolsResult {
	content: string | null;
	toolCalls: ToolCall[];
	tokensUsed: number;
	model: string;
}

function getConfiguredModel(): string {
	return process.env.AI_MODEL || DEFAULT_MODEL;
}

function getConfiguredMaxTokens(): number {
	const envValue = process.env.AI_MAX_TOKENS;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return DEFAULT_MAX_TOKENS;
}

function usesResponsesAPI(model: string): boolean {
	return model.startsWith("gpt-5") || model.startsWith("o3") || model.startsWith("o4");
}

function usesMaxCompletionTokens(model: string): boolean {
	return (
		model.startsWith("o1") ||
		model.startsWith("o3") ||
		model.startsWith("o4") ||
		model.startsWith("gpt-4o") ||
		model.startsWith("gpt-5")
	);
}

function supportsTemperature(model: string): boolean {
	return (
		!model.startsWith("o1") &&
		!model.startsWith("o3") &&
		!model.startsWith("o4") &&
		!model.startsWith("gpt-5")
	);
}

export class OpenAIProvider implements AIProvider {
	private client: OpenAI;
	private model: string;

	constructor(apiKey?: string, model?: string) {
		const key = apiKey ?? process.env.OPENAI_API_KEY;
		if (!key) {
			throw new Error(
				"OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass apiKey to constructor.",
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

		const tempParam = supportsTemperature(this.model) ? { temperature: temperature ?? 0.7 } : {};

		const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
			model: this.model,
			messages: chatMessages,
			max_tokens: tokenLimit,
			...tempParam,
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

	private async completeWithToolsUsingResponsesAPI(
		params: CompleteWithToolsParams,
	): Promise<CompleteWithToolsResult> {
		const { messages, systemPrompt, tools, maxTokens } = params;
		const tokenLimit = Math.max(maxTokens ?? getConfiguredMaxTokens(), 16384);

		const toolsJson = JSON.stringify(
			tools
				.filter(
					(t): t is OpenAI.Chat.ChatCompletionTool & { type: "function" } => t.type === "function",
				)
				.map((t) => ({
					name: t.function.name,
					description: t.function.description,
					parameters: t.function.parameters,
				})),
			null,
			2,
		);

		const enhancedSystemPrompt = `${systemPrompt}

## TOOL CALLING (CRITICAL)

You have access to tools. When you need to use a tool:
- Include the tool call in "tool_calls" array with name and arguments
- Optionally include a "message" to say something to the customer BEFORE tool execution

Available tools:
${toolsJson}

RULES:
- Use "tool_calls" array even for single tool (can be empty if no tools needed)
- If no tools needed, just include your response in "message"
- NEVER make up tool results - only call tools, don't simulate their output`;

		const inputItems: OpenAI.Responses.ResponseInputItem[] = messages.map((msg, index) => {
			let content = msg.content;
			if (index === messages.length - 1 && msg.role === "user") {
				content = `${content}\n\nIMPORTANT: Respond with valid JSON in the format described.`;
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
			instructions: enhancedSystemPrompt,
			text: {
				format: { type: "json_object" },
			},
		};

		const response = await this.client.responses.create(requestParams);
		const responseText = response.output_text ?? "";

		let parsedResponse: { tool_calls?: ToolCall[]; message?: string } | null = null;
		try {
			parsedResponse = JSON.parse(responseText) as {
				tool_calls?: ToolCall[];
				message?: string;
			};
		} catch {
			console.error("[OpenAI] Failed to parse gpt-5-nano tool response as JSON:", responseText);
			return {
				content: responseText,
				toolCalls: [],
				tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
				model: response.model,
			};
		}

		const toolCalls = parsedResponse?.tool_calls ?? [];
		const content = parsedResponse?.message ?? null;

		console.log(
			`[OpenAI] gpt-5-nano returned ${toolCalls.length} tool calls:`,
			toolCalls.map((tc) => tc.name),
		);

		return {
			content,
			toolCalls,
			tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
			model: response.model,
		};
	}

	async completeWithTools(params: CompleteWithToolsParams): Promise<CompleteWithToolsResult> {
		if (usesResponsesAPI(this.model)) {
			return this.completeWithToolsUsingResponsesAPI(params);
		}

		const { messages, systemPrompt, tools, temperature, maxTokens } = params;
		const tokenLimit = maxTokens ?? getConfiguredMaxTokens();

		const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...messages.map((msg: Message) => ({
				role: msg.role as "user" | "assistant",
				content: msg.content,
			})),
		];

		const tokenParam = usesMaxCompletionTokens(this.model)
			? { max_completion_tokens: tokenLimit }
			: { max_tokens: tokenLimit };

		const tempParam = supportsTemperature(this.model) ? { temperature: temperature ?? 0.7 } : {};

		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: chatMessages,
			tools: tools,
			tool_choice: "auto",
			...tempParam,
			...tokenParam,
		});

		const message = response.choices[0]?.message;
		const content = message?.content ?? null;
		const toolCalls: ToolCall[] = [];

		if (message?.tool_calls) {
			for (const tc of message.tool_calls) {
				if (tc.type === "function") {
					try {
						toolCalls.push({
							name: tc.function.name,
							arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
						});
					} catch {
						console.error("Failed to parse tool call arguments:", tc.function.arguments);
					}
				}
			}
		}

		return {
			content,
			toolCalls,
			tokensUsed: response.usage?.total_tokens ?? 0,
			model: response.model,
		};
	}
}

export function createOpenAIProvider(apiKey?: string, model?: string): OpenAIProvider {
	return new OpenAIProvider(apiKey, model);
}
