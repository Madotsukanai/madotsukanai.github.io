function detectLanguage(ldbData) {
  // Convert Uint8Array to binary string
  let binStr = "";
  for(let i=0; i<Math.min(ldbData.length, 100000); i++) {
    binStr += String.fromCharCode(ldbData[i]);
  }
  
  // Shift-JIS for "はい" (Yes) is \x82\xCD\x82\xA2
  const sjisYes = "\x82\xCD\x82\xA2";
  // Shift-JIS for "いいえ" (No) is \x82\xA2\x82\xA2\x82\xA6
  const sjisNo = "\x82\xA2\x82\xA2\x82\xA6";
  // Shift-JIS for "レベル" (Level) is \x83\x8C\x83\x78\x83\x8B
  const sjisLevel = "\x83\x8C\x83\x78\x83\x8B";
  
  if (binStr.includes(sjisYes) || binStr.includes(sjisNo) || binStr.includes(sjisLevel)) {
    return 'jp';
  }
  
  // Count bytes in Shift-JIS first byte range (0x81-0x9F, 0xE0-0xEF)
  let sjisHighByteCount = 0;
  for(let i=0; i<Math.min(ldbData.length, 50000); i++) {
    const b = ldbData[i];
    if ((b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xEF)) {
      sjisHighByteCount++;
    }
  }
  
  if (sjisHighByteCount > 100) {
    return 'jp'; // Lots of SJIS characters
  }
  
  return 'en';
}

console.log("Detector ready");
