const consonantMap: Record<string, string> = {
  h: '\u1BC2',
  k: '\u1BC3',
  b: '\u1BC4',
  p: '\u1BC5',
  n: '\u1BC6',
  w: '\u1BC7',
  g: '\u1BC8',
  j: '\u1BC9',
  d: '\u1BCA',
  r: '\u1BCB',
  m: '\u1BCC',
  t: '\u1BCD',
  s: '\u1BCE',
  l: '\u1BCF',
  y: '\u1BD0',
};

const vowelMap: Record<string, string> = {
  i: '\u1BEA',
  u: '\u1BEB',
  e: '\u1BE7',
  o: '\u1BEC',
  a: '',
};

const PANGOLAT = '\u1BF2';
const AMBOROLONG = '\u1BD1';

function isConsonant(char: string): boolean {
  return /[hkbpnwgjdrmtslyN]/.test(char);
}

function isVowel(char: string): boolean {
  return /[aiueo]/.test(char);
}

export function transliterateToba(text: string): string {
  const input = text.toLowerCase();
  let result = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const next = input[i + 1] || '';
    const afterNext = input[i + 2] || '';

    // Handle 'ng' digraph
    if (char === 'n' && next === 'g') {
      result += AMBOROLONG;
      i += 2;
      continue;
    }

    // Handle consonant
    if (isConsonant(char)) {
      const batakConsonant = consonantMap[char];
      if (!batakConsonant) {
        result += char;
        i++;
        continue;
      }

      // Check for following vowel
      if (isVowel(next)) {
        const vowelMark = vowelMap[next];

        // Check if closed syllable (C+V+C at end or C+V+C+V)
        if (isConsonant(afterNext)) {
          const afterAfterNext = input[i + 3] || '';

          // If followed by another vowel, it's a new syllable
          if (isVowel(afterAfterNext)) {
            result += batakConsonant + vowelMark;
            i += 2;
          } else if (afterAfterNext === '' || afterAfterNext === ' ' || afterAfterNext === '\n') {
            // Closed syllable at end: C1+V+C2 -> C1+C2+V+pangolat
            const closingConsonant = consonantMap[afterNext];
            if (closingConsonant) {
              result += batakConsonant + closingConsonant + vowelMark + PANGOLAT;
              i += 3;
            } else {
              result += batakConsonant + vowelMark;
              i += 2;
            }
          } else {
            result += batakConsonant + vowelMark;
            i += 2;
          }
        } else {
          result += batakConsonant + vowelMark;
          i += 2;
        }
      } else {
        // Consonant without vowel - add with inherent 'a'
        result += batakConsonant;
        i++;
      }
    } else if (isVowel(char)) {
      // Standalone vowel at start
      if (char === 'a') {
        result += '\u1BC0'; // Independent A
      } else if (char === 'i') {
        result += '\u1BC1\u1BEA'; // I base + vowel mark
      } else if (char === 'u') {
        result += '\u1BC1\u1BEB'; // U base + vowel mark
      } else if (char === 'e') {
        result += '\u1BC1\u1BE7';
      } else if (char === 'o') {
        result += '\u1BC1\u1BEC';
      }
      i++;
    } else if (char === ' ') {
      result += ' ';
      i++;
    } else if (char === '\n') {
      result += '\n';
      i++;
    } else {
      // Pass through other characters
      result += char;
      i++;
    }
  }

  return result;
}

export function isBatakScript(text: string): boolean {
  // Check if text contains Batak Unicode characters (U+1BC0 to U+1BFF)
  return /[\u1BC0-\u1BFF]/.test(text);
}
