import { selectedKind } from './selection.js';

export function translationLanguage(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
}
export function translationStarter(value) {
  const language = translationLanguage(value);
  return language ? `Translate into ${language}:\n\n` : '';
}
export function directSearchTerms(text) {
  const value = text.trim();
  return value && value.length <= 200 && !/[\r\n]/.test(value) && selectedKind(value) !== 'passage' ? value : '';
}
