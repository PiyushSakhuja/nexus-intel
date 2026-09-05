// apps/backend/src/lib/groq.ts
//
// Minimal REST client for the Groq Chat Completions endpoint. No SDK
// dependency — a single fetch call, in keeping with this backend's existing
// "no hidden magic" style (see riskEngine.ts).
//
// Groq's API is OpenAI-compatible (same request/response shape), so this
// is almost identical to the OpenAI client but points at api.groq.com.
//
// Model is read from GROQ_MODEL. Defaults to llama-3.3-70b-versatile —
// Groq's best general-purpose free model with JSON mode support.
// Get a free API key (no credit card) at https://console.groq.com/keys

const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqError extends Error {}

export interface GroqJsonCallOptions {
  /** The user-turn prompt. */
  prompt: string;
  /** Optional system instruction (persona/constraints). */
  systemInstruction?: string;
}

/**
 * Calls Groq Chat Completions asking for a strict JSON response
 * (response_format: { type: "json_object" }) and returns the parsed object.
 *
 * Throws GroqError for any failure — missing API key, network error,
 * non-2xx response, empty/unparsable output — so callers can decide how to
 * degrade (see investigationAssessment.ts for the fallback path used by the
 * AI Assessment feature).
 */
export async function callGroqForJson<T = unknown>(opts: GroqJsonCallOptions): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqError("GROQ_API_KEY is not set");

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.systemInstruction) {
    messages.push({ role: "system", content: opts.systemInstruction });
  }
  messages.push({ role: "user", content: opts.prompt });

  const body = {
    model,
    messages,
    response_format: { type: "json_object" },
  };

  let res: Response;
  try {
    res = await fetch(GROQ_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GroqError(`Groq request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GroqError(`Groq API returned ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new GroqError("Groq response was not valid JSON at the HTTP level");
  }

  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) {
    const finishReason = data?.choices?.[0]?.finish_reason;
    throw new GroqError(
      finishReason && finishReason !== "stop"
        ? `Groq stopped with reason: ${finishReason}`
        : "Groq response had no text content"
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GroqError("Groq's JSON-mode response could not be parsed");
  }
}
