export type Profile={username:string;displayName:string};
export type ChatMessage={id:string;role:'user'|'assistant';text:string;createdAt:string;savedEntryId?:string};
export type ChatThread={id:string;title:string;createdAt:string;updatedAt:string;messages:ChatMessage[];contextIds:string[];draft:string};
export const spaceName=(profile?:Profile)=>`${profile?.displayName.trim()||profile?.username.trim()||'My'}${profile?.displayName.trim()||profile?.username.trim()?'’s':''} space`;
export function newChat():ChatThread{const now=new Date().toISOString();return {id:crypto.randomUUID(),title:'New chat',createdAt:now,updatedAt:now,messages:[],contextIds:[],draft:''}}
export function appendMessage(thread:ChatThread,text:string):ChatThread{
  if(!text.trim())return thread;
  const now=new Date().toISOString();
  return {...thread,title:thread.messages.length||thread.title!=='New chat'?thread.title:text.trim().slice(0,48),updatedAt:now,draft:'',messages:[...thread.messages,{id:crypto.randomUUID(),role:'user',text:text.trim(),createdAt:now},{id:crypto.randomUUID(),role:'assistant',text:'AI is not connected yet. Your message and selected nodes are saved in this conversation.',createdAt:now}]};
}
export function isChat(value:unknown):value is ChatThread{
  const t=value as ChatThread;return !!t&&typeof t.id==='string'&&typeof t.title==='string'&&typeof t.draft==='string'&&Array.isArray(t.contextIds)&&t.contextIds.every(id=>typeof id==='string')&&Array.isArray(t.messages)&&t.messages.every(m=>m&&typeof m.id==='string'&&['user','assistant'].includes(m.role)&&typeof m.text==='string');
}
