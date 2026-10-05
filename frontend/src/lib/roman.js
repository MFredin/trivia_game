// Roman numerals for the question number and the leaderboard rank: the ledger and the question margin are numbered the
// way a book's folios would be. 1 and up; anything lower is shown as I.
const NUMERALS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(value) {
  let n = Math.max(1, Math.round(value));
  let out = '';
  for (const [amount, symbol] of NUMERALS) {
    while (n >= amount) {
      out += symbol;
      n -= amount;
    }
  }
  return out;
}
