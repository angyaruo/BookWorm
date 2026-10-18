// Buggy's original sprites and rotating notes, bundled for offline use.
import sleeping from '../assets/sleeping.png';
import awake from '../assets/awake.png';
import reading from '../assets/reading.png';
import thinking from '../assets/thinking.png';
import munching from '../assets/munching.png';
import singing from '../assets/singing.png';
export const SPRITES = { sleeping, awake, reading, thinking, munching, singing };

// One line per opening, rotating through the full set before repeating.
export const BUGGY_MESSAGES = [
  "i am buge. i dig in book for you. is this okay? let me know.",
  "hello writer person. buggy has arrive, with several thought and one leaf crumb.",
  "the words is hiding again? typical words. we find them.",
  "good day for make sentence. bad day for sentence escape.",
  "buggy was thinking very loud. nobody complain because buggy is small.",
  "welcome back. book is open and brain is mostly also open.",
  "you bring question, i bring suspicious amount of vocabulary.",
  "buggy report for duty. duty is reading. excellent duty.",
  "hmm. perhaps today we put a very good word in a very good place.",
  "i have polish the tiny spectacles. now we see all the metaphor.",
  "bug fact: beetles is about one quarter of all known animal species. very overachieve.",
  "bug fact: butterfly taste with the feet. imagine step on soup and know it.",
  "bug fact: ants do not have lungs. air go in little body holes, very efficient.",
  "bug fact: honeybee can tell direction by doing dance. buggy also dance but give no direction.",
  "bug fact: dragonfly was here before dinosaur. extremely old zooming fellow.",
  "bug fact: ladybug may eat thousands of aphid. tiny red vacuum with fashion.",
  "bug fact: cricket ears is on the front legs. please speak toward knee.",
  "bug fact: firefly light make almost no heat. is called cold light, but look warm to buggy.",
  "bug fact: praying mantis can turn head very far. excellent for seeing unfinished paragraph.",
  "bug fact: some moth drink tears from sleeping animal. rude beverage, beautiful moth.",
];

export function getNextBuggyMessage() {
  try {
    const stored = Number.parseInt(localStorage.getItem('bw_buggy_message_index') || '-1', 10);
    const nextIndex = Number.isFinite(stored) ? ((stored + 1) % BUGGY_MESSAGES.length + BUGGY_MESSAGES.length) % BUGGY_MESSAGES.length : 0;
    localStorage.setItem('bw_buggy_message_index', String(nextIndex));
    return BUGGY_MESSAGES[nextIndex];
  } catch { return BUGGY_MESSAGES[0]; }
}
