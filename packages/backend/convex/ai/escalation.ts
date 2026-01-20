import type { Message } from "./types";

interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
}

const EXPLICIT_ESCALATION_PHRASES = [
  "talk to person",
  "talk to a person",
  "talk to human",
  "talk to a human",
  "human help",
  "speak to someone",
  "speak to a person",
  "speak to a human",
  "real person",
  "real human",
  "agent please",
  "customer service",
  "representative",
  "supervisor",
  "manager",
  "hablar con alguien",
  "hablar con una persona",
  "quiero hablar con",
  "falar com alguém",
  "falar com uma pessoa",
  "quero falar com",
];

const URGENT_KEYWORDS = ["urgent", "urgente", "emergency", "emergencia", "emergência", "asap", "immediately"];

const FRUSTRATION_KEYWORDS = [
  "angry",
  "frustrated",
  "annoyed",
  "upset",
  "terrible",
  "awful",
  "horrible",
  "worst",
  "useless",
  "stupid",
  "ridiculous",
  "unacceptable",
  "furioso",
  "frustrado",
  "molesto",
  "enojado",
  "terrible",
  "horrible",
  "inaceptable",
  "irritado",
  "bravo",
  "péssimo",
  "inaceitável",
];

const FAILURE_THRESHOLD = 3;

export function detectEscalation(
  message: string,
  conversationHistory: Message[],
  failureCount: number
): EscalationResult {
  const normalizedMessage = message.toLowerCase().trim();

  if (failureCount >= FAILURE_THRESHOLD) {
    return {
      shouldEscalate: true,
      reason: `Multiple AI failures (${failureCount} consecutive failures)`,
    };
  }

  for (const phrase of EXPLICIT_ESCALATION_PHRASES) {
    if (normalizedMessage.includes(phrase)) {
      return {
        shouldEscalate: true,
        reason: "Customer explicitly requested human assistance",
      };
    }
  }

  for (const keyword of URGENT_KEYWORDS) {
    if (normalizedMessage.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: "Customer indicated urgent matter",
      };
    }
  }

  const frustrationScore = calculateFrustrationScore(normalizedMessage, conversationHistory);
  if (frustrationScore >= 2) {
    return {
      shouldEscalate: true,
      reason: "Customer appears frustrated or upset",
    };
  }

  return {
    shouldEscalate: false,
    reason: "",
  };
}

function calculateFrustrationScore(message: string, conversationHistory: Message[]): number {
  let score = 0;

  for (const keyword of FRUSTRATION_KEYWORDS) {
    if (message.includes(keyword)) {
      score += 1;
    }
  }

  const recentCustomerMessages = conversationHistory
    .filter((msg) => msg.role === "user")
    .slice(-3)
    .map((msg) => msg.content.toLowerCase());

  for (const historyMsg of recentCustomerMessages) {
    for (const keyword of FRUSTRATION_KEYWORDS) {
      if (historyMsg.includes(keyword)) {
        score += 0.5;
      }
    }
  }

  const hasExclamations = (message.match(/!/g) || []).length >= 3;
  const hasAllCaps =
    message.length > 10 && message === message.toUpperCase() && /[A-Z]/.test(message);

  if (hasExclamations) {
    score += 0.5;
  }
  if (hasAllCaps) {
    score += 1;
  }

  return score;
}

export type { EscalationResult };
