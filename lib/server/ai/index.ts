import {openai, openaiEmbedder} from './openai.ts';
import {AIError, type Embedder, type MoonsAI} from './provider.ts';

// MOONS_AI_PROVIDER=openai (event) | claude (personal, not implemented yet)
export function ai(): MoonsAI {
  const provider = process.env.MOONS_AI_PROVIDER || 'openai';
  if (provider === 'openai') return openai;
  throw new AIError(`AI provider "${provider}" is not implemented yet`, 'AI_UNAVAILABLE');
}

export function embedder(): Embedder { return openaiEmbedder; }
export {AIError};
