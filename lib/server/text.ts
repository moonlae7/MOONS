// Limits shared by typed and spoken answers.
export const MAX_TEXT = 300;
export const MAX_AUDIO = 6 * 1024 * 1024;

// Keep a spoken answer within MAX_TEXT, ending on a sentence when one ends late enough.
export function trimSpoken(text: string) {
  if (text.length <= MAX_TEXT) return text;
  const cut = text.slice(0, MAX_TEXT);
  const end = Math.max(...['.', '!', '?', '。', '\n'].map(c => cut.lastIndexOf(c)));
  return end >= MAX_TEXT * 0.6 ? cut.slice(0, end + 1) : cut;
}
