const crypto = require('crypto');
let matchCount = 0;
const commonJpTerms = ["レベル", "経験値", "攻撃力", "防御力", "精神力", "敏捷性", "装備", "はい", "いいえ", "セーブ", "ファイル", "終了"];

for (let iter = 0; iter < 10; iter++) {
  const buf = crypto.randomBytes(3000000);
  const decoder = new TextDecoder('sjis', { fatal: false });
  const str = decoder.decode(buf);
  let c = 0;
  for (const term of commonJpTerms) {
    if (str.includes(term)) c++;
  }
  if (c > 0) matchCount++;
}
console.log("Matches in 10 random 3MB files: " + matchCount);
