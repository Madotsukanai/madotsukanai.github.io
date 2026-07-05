const crypto = require('crypto');
const buf = crypto.randomBytes(3000000);
const decoder = new TextDecoder('sjis', { fatal: false });
const str = decoder.decode(buf);
const jpChars = str.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
console.log("Regex matches in random 3MB: " + (jpChars ? jpChars.length : 0));
