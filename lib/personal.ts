'use client';
// Personal MOONS calls the real AI through the server; records stay in this browser.
import {api, postJson} from './client';
import type {Analysis, Entry, Planet, Structure} from './model';
import type {ChatMessage} from './chat';

export async function analyzeEntry(entry: Entry, structure: Structure | undefined, planets: Planet[]): Promise<Analysis> {
  const res = await api<{analysis: Analysis}>('/api/personal/analyze', postJson({
    sentences: entry.sentences, title: entry.title, mediaType: entry.mediaType, structure,
    planets: planets.map(p => ({id: p.id, name: p.name})),
  }));
  return res.analysis;
}

export async function chatReply(messages: ChatMessage[], context: Entry[]): Promise<string> {
  const res = await api<{text: string}>('/api/personal/chat', postJson({
    messages: messages.slice(-20).map(m => ({role: m.role, text: m.text})),
    context: context.slice(0, 6).map(e => ({title: e.title ?? '', body: e.body.slice(0, 4000), structure: e.analysis?.structure ?? null,
      signals: (e.analysis?.signals ?? []).filter(s => s.state === 'open').map(s => s.reason).slice(0, 6)})),
  }));
  return res.text;
}
