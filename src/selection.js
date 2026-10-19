export const NATIVE_COMPOSER = 'textarea[name="chat-message"]';
export function selectedKind(text) {
  const value = text.trim();
  if (/^[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*$/u.test(value) && value.length <= 100) return 'word';
  return value.length > 200 || /\n\s*\n/.test(value) || (value.match(/[.!?](?:\s|$)/g) || []).length > 1 ? 'passage' : 'phrase';
}
export function replacementFor(snapshot, currentValue, text) {
  if (currentValue !== snapshot.value || !text.trim() || snapshot.start < 0 || snapshot.end <= snapshot.start || snapshot.end > currentValue.length) return null;
  const selected = currentValue.slice(snapshot.start, snapshot.end);
  const leading = selected.match(/^\s*/)[0], trailing = selected.match(/\s*$/)[0];
  return currentValue.slice(0, snapshot.start) + leading + text.trim() + trailing + currentValue.slice(snapshot.end);
}
export function preserveCase(original, replacement) {
  original = original.trim();
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}
export function setDraft(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
