// Consonant mappings from reference - includes base vowels a, i, u
const consonants: Record<string, string> = {
  h: '\u1BC2',
  k: '\u1BC2',  // same as h in Batak
  g: '\u1BCE',
  n: '\u1BC9',
  m: '\u1BD4',
  b: '\u1BC5',
  t: '\u1BD6',
  d: '\u1BD1',
  p: '\u1BC7',
  w: '\u1BCB',
  s: '\u1BD8',
  y: '\u1BDB',
  l: '\u1BDE',
  r: '\u1BD2',
  j: '\u1BD0',
  c: '\u1BD0',
  f: '\u1BC7',
  v: '\u1BC5',
  // Base vowels (independent vowel characters)
  a: '\u1BC0',
  i: '\u1BE4',
  u: '\u1BE5',
};

// Vowel marks (diacritics) - note: 'a' has no mark (inherent)
const vowels: Record<string, string> = {
  i: '\u1BEA',
  u: '\u1BEE',
  e: '\u1BE7',
  o: '\u1BEC',
};

const pangolat = '\u1BF2';
const amborolong = '\u1BF0';

export function transliterateToba(text: string): string {
  // Preprocess: replace 'ng' with special marker
  const t = text.toLowerCase().trim().replace(/ng/g, 'ŋ');
  let res = '';
  let i = 0;

  while (i < t.length) {
    const char = t[i];

    // Handle ng (amborolong)
    if (char === 'ŋ') {
      res += amborolong;
      i++;
      continue;
    }

    // Handle consonant (includes base vowels a, i, u)
    if (consonants[char]) {
      res += consonants[char];

      if (i + 1 < t.length) {
        const next = t[i + 1];

        // Check for vowel mark (i, u, e, o)
        if (vowels[next]) {
          // Check closed syllable displacement: C1 + V + C2(closed) -> C1 + C2 + V + Pangolat
          let displaced = false;

          if (i + 2 < t.length) {
            const c2 = t[i + 2];
            // If C2 is a consonant and NOT a base vowel (a/i/u)
            if (consonants[c2] && !['a', 'i', 'u'].includes(c2)) {
              let isOpen = false;

              if (i + 3 < t.length) {
                const c3 = t[i + 3];
                if (vowels[c3] || c3 === 'a') {
                  isOpen = true;
                }
              }

              if (!isOpen) {
                // Closed syllable: C1 + C2 + V + Pangolat
                res += consonants[c2];
                res += vowels[next];
                res += pangolat;
                i += 3;
                displaced = true;
              }
            }
          }

          if (!displaced) {
            res += vowels[next];
            i += 2;
          }
          continue;
        } else if (next === 'a') {
          // Inherent 'a' - just advance past both
          i += 2;
          continue;
        } else {
          // Closed syllable at end or before another consonant
          if (!['a', 'i', 'u'].includes(char)) {
            res += pangolat;
          }
        }
      } else {
        // End of word - add pangolat if not a base vowel
        if (!['a', 'i', 'u'].includes(char)) {
          res += pangolat;
        }
      }
    } else if (vowels[char]) {
      // Standalone vowel at start (e, o only - since a/i/u are in consonants)
      const base = char === 'i' ? '\u1BE4' : (char === 'u' ? '\u1BE5' : '\u1BC0');
      res += base;
      if (char === 'e' || char === 'o') {
        res += vowels[char];
      }
    } else if (char === ' ') {
      res += ' ';
    } else if (char === '\n') {
      res += '\n';
    } else {
      // Pass through other characters
      res += char;
    }

    i++;
  }

  return res;
}

export function isBatakScript(text: string): boolean {
  // Check if text contains Batak Unicode characters (U+1BC0 to U+1BFF)
  return /[\u1BC0-\u1BFF]/.test(text);
}
