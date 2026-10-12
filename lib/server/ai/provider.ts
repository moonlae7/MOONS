// Provider seam. The event runs on OpenAI; personal MOONS will add a Claude provider
// that implements the same json() contract. Embeddings stay on one provider for both
// modes so stored vectors remain comparable.
export type JsonTask = {
  name: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  tier: 'fast' | 'deep';
};

export interface MoonsAI {
  name: string;
  json<T>(task: JsonTask): Promise<{data: T; model: string}>;
  transcribe(audio: Blob, filename: string): Promise<string>;
  moderate(text: string): Promise<boolean>; // true = should be held back
}

export interface Embedder {
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export type AIErrorCode = 'AI_UNAVAILABLE' | 'AI_FAILED' | 'PARSE_FAILED' | 'RATE_LIMITED';
export class AIError extends Error {
  code: AIErrorCode;
  constructor(message: string, code: AIErrorCode) { super(message); this.code = code; }
}
