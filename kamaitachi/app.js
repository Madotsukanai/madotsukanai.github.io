'use strict';

const SRAM_SLOT_SIZE = 0x800;
const RECORD_START = 0x2D0;
const MAX_RECORDS = (SRAM_SLOT_SIZE - RECORD_START) / 8;
const ENDING_NAMES = {
  0x01: '解決編「必死の体当たり」', 0x02: '解決編「おまじない」',
  0x03: '解決編「一本背負い」', 0x04: '失敗編「俊夫の自殺」',
  0x05: '失敗編「彼女が美樹本を……」', 0x06: '失敗編「彼女にストックで……」',
  0x07: '失敗編「廊下で人影に……」', 0x08: '失敗編「彼女を階段から……」',
  0x09: '失敗編「彼女をモップで……」', 0x0A: '失敗編「鍵をはずして眠りに……」',
  0x0B: '失敗編「彼女の部屋で……」', 0x0C: '大阪編「社長やってますわ」',
  0x0D: '雪の迷路編', 0x0E: 'スパイ解決編「伝説のスパイ」',
  0x0F: 'スパイ失敗編「春子に……」', 0x10: 'スパイ失敗編「みどりに……」',
  0x11: 'スパイ失敗編「風の中の銃声」', 0x12: '悪霊編「目が覚めたなら」',
  0x13: '悪霊編「笑顔が戻るその日まで」', 0x14: '鎌井達の夜編',
  0x15: 'Ｏの喜劇編', 0x16: '暗号編「またまた、小林さん」',
  0x17: '暗号編「ああ、小林さん」', 0x18: 'チュンソフ党の陰謀編',
  0x19: '迷宮編「迷宮くん」', 0x1A: '迷宮編「フッシー」',
  0x1B: '迷宮編「寝ちゃったよ」', 0x1C: '迷宮編「妖刀村正」',
  0x1D: '迷宮編「燃えちゃったよ」', 0x1E: '迷宮編「焼かれちゃったよ」',
  0x1F: '迷宮編「4の扉」', 0x20: '迷宮編「2の扉」',
  0x21: '迷宮編「#の扉」', 0x22: '迷宮編「6の扉」',
  0x23: '迷宮編「9の扉」', 0x24: '迷宮編「3の扉」',
  0x25: '迷宮編「1の扉」', 0x26: '迷宮編「*の扉」',
  0x27: '迷宮編「5の扉」', 0x28: '迷宮編「0の扉」',
  0x29: '迷宮編「8の扉」', 0x2A: '迷宮編「不幸せの箱」',
  0x2B: '失敗編「冗談なのに……」'
};
const ENDING_IDS = Array.from({ length: 0x2B }, (_, i) => i + 1);
const SCRIPT_START = 0x2FCE1;
const SCRIPT_END = 0x7788E;
const PUNCT = {
  0x100E: '\n', 0x1058: '。', 0x1059: '」', 0x105A: '』', 0x105B: '、',
  0x105C: '！', 0x105D: '？', 0x105E: '！', 0x105F: '？', 0x1060: '「', 0x1061: '『'
};
let choiceInfo = new Map();
const PINK_IDS = [...Array.from({ length: 0x14 }, (_, i) => i + 1), 0x2B];
// The three culprit-name input scenes append the entered name to the save:
// 0x94 = first input, 0xA0 = second, 0xAC = third.
const INPUT_INDEX = { 154: 0, 157: 1, 158: 1, 159: 2, 160: 2 };
// 157 is the second culprit-name input (0xA0). The raw pointer order in the
// script leaves a duplicate "Tanaka" branch and no usable "other" branch,
// so present the five actual dispositions in the order the game tests them:
// Mikimoto, Tanaka, Kayama, Midori, other. The high option bits then line up
// with the saved second input (e.g. 0x09 = Mikimoto / option A).
function arrangeNameInput157(options, options158) {
  if (!options) return options;
  const used = new Set();
  const take = match => {
    for (let i = 0; i < options.length; i++) {
      if (used.has(i)) continue;
      if (match(options[i])) { used.add(i); return options[i]; }
    }
    return null;
  };
  const mikimoto = take(o => /[\u0004-\u0006]/.test(o.branch || '') && /犯人は/.test(o.branch || '')) ||
    take(o => /美樹本さん/.test(o.branch || ''));
  const tanaka = take(o => /田中さん/.test(o.branch || ''));
  const kayama = take(o => /香山さん/.test(o.branch || ''));
  const midori = take(o => /みどりさん/.test(o.branch || ''));
  if (!mikimoto || !tanaka || !kayama || !midori) return options;
  const at = (mikimoto.branch || '').indexOf('「犯人は、');
  const mikimotoClean = at > 0 ? { ...mikimoto, branch: mikimoto.branch.slice(at) } : mikimoto;
  const opt4 = (options158 && options158[0]) || { label: '', branch: '' };
  const opt5 = (options158 && options158[1]) || { label: '', branch: '' };
  return [mikimotoClean, tanaka, kayama, midori, opt4, opt5];
}
// What the player actually types at each name-input prompt. The direct
// branches use the primary hiragana name; the generic "other" branches list
// the accepted names that all lead to the same branch.
const NAME_INPUT_LABELS = {
  154: [
    'みきもと',
    'たなか',
    'としお',
    'こばやし／きょうこ／かやま／はるこ／みどり／あき／かなこ／けいこ／さんにんぐみ',
    '（一致しない名前）'
  ],
  157: [
    'みきもと',
    'たなか',
    'かやま',
    'みどり',
    'こばやし／きょうこ／はるこ／としお／あき／かなこ／けいこ／さんにんぐみ',
    '（一致しない名前）'
  ],
  159: [
    'みきもと',
    'あき／かなこ／けいこ',
    'さんにんぐみ',
    'はるこ',
    'こばやし／きょうこ／としお／みどり',
    '（一致しない名前）'
  ]
};
function applyNameInputLabels(id, options) {
  const labels = NAME_INPUT_LABELS[id];
  if (!labels || labels.length !== options.length) return options;
  return options.map((o, k) => ({ ...o, inputLabel: labels[k] }));
}
// 158 and 160 are not player-facing choices. 158 is the inner "pick someone
// else / no match" choice reached from 157's other branch; 160 is the same
// kind of inner choice under 159. 159 itself is the third culprit-name input:
// its option C is a dedicated "three girls" branch, so keep it visible while
// hiding only the two derived inner choices.
const HIDDEN_CHOICE_IDS = new Set([158, 160]);

let romBytes = null;
let srmBytes = null;
let sramSlots = null;
let selectedSlot = 0;
let viewMode = 'end';

const $ = id => document.getElementById(id);
const readU16 = (b, o) => b[o] | (b[o + 1] << 8);

function readName(data, off) {
  let out = '';
  for (let i = 0; i < 8; i++) {
    const code = readU16(data, off + i * 2);
    if (code === 0xFFFF || code === 0x0000) break;
    out += CHARMAP[code] !== undefined ? CHARMAP[code] : '?';
  }
  return out;
}

function readCulpritName(data, base, own, girl) {
  for (const off of [0x88, 0x94, 0xA0, 0xAC, 0xB8]) {
    const name = readName(data, base + off);
    if (name && name !== own && name !== girl) return name;
  }
  return '?';
}

function decodeChoices(rom) {
  const treeSize = readU16(rom, 0x1B0F);
  const n = treeSize / 2 + 1;
  const leftOff = readU16(rom, 0x1B28);
  const rightOff = readU16(rom, 0x1B30);
  const left = new Int32Array(n), right = new Int32Array(n);
  const meta = new Uint8Array(0x63);
  for (let i = 0; i < n; i++) {
    left[i] = readU16(rom, leftOff + 2 * i);
    right[i] = readU16(rom, rightOff + 2 * i);
  }
  for (let i = 0; i < 0x63; i++) meta[i] = rom[0xA901 + 4 * i + 1];

  const variants = new Map();
  let firstInputSetup = '';
  // A page that ends with an ending banner (e.g. the Maze bad end) is not the
  // setup for the next choice; the choice is reached from another scene via a
  // jump, so drop the banner instead of showing it as the choice's context.
  const cleanContext = text => text
    .replace(/(?:GAME[\s\u3000]*OVER|THE[\s\u3000]*END)[\s\S]*$/i, '')
    .trim();
  const baseBit = SCRIPT_START * 8;
  let pos = baseBit;
  let seq = [], lastText = '', guard = 0;
  const readBit = () => {
    const bit = (rom[pos >>> 3] >>> (pos & 7)) & 1;
    pos++;
    return bit;
  };
  const readChar = () => {
    let v = (n - 1) << 1, g = 0;
    while ((v & 0x8000) === 0) {
      v = readBit() ? right[v >>> 1] : left[v >>> 1];
      if (++g > 64) throw new Error('huffman');
    }
    return v & 0x1FFF;
  };
  const skipBits = count => { pos += count; };
  // 24-bit pointer: low 3 bits = bit offset, upper bits = byte offset from script start
  const readPointerBit = () => {
    let raw = 0;
    for (let i = 0; i < 24; i++) raw |= readBit() << i;
    const bit = raw & 7;
    const nb = (raw >>> 3) & 0x7FFF;
    const nbn = (raw >>> 18) & 0xF;
    return baseBit + (((nbn << 15) | nb) * 8) + bit;
  };
  // Decode the text stored at an option pointer. A leading 0x1015/0x1025
  // marks narration that follows the choice instead of a menu label, so keep
  // it as branch and leave label empty; the renderer extracts the accused
  // person's name from branch for name-input choices.
  const readOption = bitPos => {
    const save = pos;
    pos = bitPos;
    let out = '';
    let lead = 0;
    let isBranch = false;
    try {
      for (let i = 0; i < 2000; i++) {
        const c = readChar();
        if (c < 0x1000) {
          out += CHARMAP[c] !== undefined ? CHARMAP[c] : '';
          continue;
        }
        if (c === 0x1015 || c === 0x1025) {
          if (!out && lead < 3) { lead++; isBranch = true; continue; }
          break;
        }
        if (PUNCT[c] !== undefined) { out += PUNCT[c]; continue; }
        if (c === 0x101B) { out += '\u0001'; continue; }
        if (c === 0x101C) { out += '\u0002'; continue; }
        if (c === 0x101E) { out += '\u0004'; continue; } // first name input
        if (c === 0x101D) { out += '\u0005'; continue; } // second name input
        if (c === 0x101F) { out += '\u0006'; continue; } // third name input
        const m = meta[c & 0xFF];
        const na = m & 3;
        let at = m >> 2;
        for (let j = 0; j < na; j++) {
          if (at & 1) skipBits(24); else readChar();
          at >>>= 1;
        }
      }
    } catch (e) { /* ignore */ }
    pos = save;
    const branch = out.trim();
    return { label: isBranch ? '' : branch, branch };
  };

  try {
    while ((pos >>> 3) < SCRIPT_END) {
      const c = readChar();
      if (c >= 0x1000) {
        const m = meta[c & 0xFF];
        const na = m & 3;
        let at = m >> 2;
        if (PUNCT[c] !== undefined) seq.push(PUNCT[c]);
        if (c === 0x101B) seq.push('\u0001');
        if (c === 0x101C) seq.push('\u0002');
        if (c >= 0x1050 && c <= 0x1057) {
          const args = [];
          for (let i = 0; i < na + 3; i++) args.push(readChar());
          const ptrs = [];
          for (let i = 0; i < na + 2; i++) ptrs.push(readPointerBit());
          const id = args[0];
          if (id > 0) {
            const options = ptrs.map(readOption);
            const nameInput = args.slice(1).every(v => v === 23);
            if (!variants.has(id)) variants.set(id, []);
            // After the choice id, each option carries the SRAM bit position
            // that the engine sets when that option is picked.
            const bits = args.slice(1);
            let context = cleanContext(seq.join('').trim() || lastText);
            // The 1st culprit input (154) follows option C of choice 57,
            // not the preceding Maze bad end.
            if (id === 57 && options[2]) firstInputSetup = options[2].branch;
            if (id === 154 && firstInputSetup) context = firstInputSetup;
            variants.get(id).push({ context, options, nameInput, bits });
          }
        } else {
          for (let i = 0; i < na; i++) {
            if (at & 1) skipBits(24); else readChar();
            at >>>= 1;
          }
        }
        if (c === 0x1025) {
          lastText = seq.join('').trim();
          seq = [];
        }
      } else {
        seq.push(CHARMAP[c] !== undefined ? CHARMAP[c] : '');
        if (seq.length > 4000) seq = seq.slice(-2000);
      }
      if (++guard > 2000000) break;
    }
  } catch (e) { /* ignore */ }

  // A choice id can appear in more than one scene variant; keep the variant
  // with the most options (and the longest context on a tie).
  const map = new Map();
  variants.forEach((list, id) => {
    if (id === 158 || id === 160) return;
    let best = list[0];
    for (const v of list) {
      if (v.options.length > best.options.length ||
          (v.options.length === best.options.length && v.context.length > best.context.length)) {
        best = v;
      }
    }
    let rawOptions = best.options;
    if (id === 157) {
      const v158 = variants.get(158);
      const opt158 = v158 ? v158[0].options : null;
      rawOptions = arrangeNameInput157(best.options, opt158);
    } else if (id === 159) {
      const v160 = variants.get(160);
      const opt160 = v160 ? v160[0].options : null;
      const opt4 = (opt160 && opt160[0]) || { label: '', branch: '' };
      const opt5 = (opt160 && opt160[1]) || { label: '', branch: '' };
      rawOptions = [best.options[0], best.options[1], best.options[2], best.options[3], opt4, opt5];
    }
    const options = applyNameInputLabels(id, rawOptions);
    map.set(id, {
      context: best.context,
      count: options.length,
      options,
      bits: best.bits,
      nameInput: best.nameInput,
      inputIndex: INPUT_INDEX[id] !== undefined ? INPUT_INDEX[id] : -1
    });
  });
  return map;
}

function parseSram(buf) {
  const data = buf.length === 8212 ? buf.subarray(0, 8192) : buf;
  if (data.length < 8192) throw new Error('セーブデータが小さすぎます (' + data.length + ' bytes)');
  const slots = [];
  for (let s = 1; s < 4; s++) {
    const base = s * SRAM_SLOT_SIZE;
    const header = Array.from(data.subarray(base, base + 8));
    const records = [];
    for (let i = 0; i < MAX_RECORDS; i++) {
      const off = base + RECORD_START + i * 8;
      const ptr = data[off + 4] | (data[off + 5] << 8) | (data[off + 6] << 16);
      if (ptr === 0) break;
      records.push(ptr);
    }
    const names = [readName(data, base + 0x7C), readName(data, base + 0x80)];
    const inputNames = [readName(data, base + 0x94), readName(data, base + 0xA0), readName(data, base + 0xAC)];
    slots.push({
      index: s - 1,
      used: header.some(b => b !== 0),
      names,
      inputNames,
      culpritName: readCulpritName(data, base, names[0], names[1]),
      progress: Array.from(data.subarray(base + 0x18, base + 0x20)),
      // Choice flags are 1-based: game choice id 1 is at +0x209.
      // +0x208 is choice id 0 and is never written by the game.
      choiceBytes: Array.from(data.subarray(base + 0x209, base + 0x209 + 0xA0)),
      playthrus: readU16(data, base + 0x7A),
      records: records.length
    });
  }
  return slots;
}

const flagSet = (slot, id) => (slot.progress[id >> 3] & (1 << (id & 7))) !== 0;
const isPink = slot => PINK_IDS.every(id => flagSet(slot, id));
// The game maps options A-E to bits 3-7 of the choice byte. The table at
// $018B67 is 04 08 10 20 40 80 ...; option A (the first option) uses bit 3,
// B bit 4, and so on. Bits 0-2 are route flags set by the same engine call,
// not an option count. A byte >= 0xF8 therefore means every option position
// (A-E) has been read, which is exactly what the gold-bookmark check tests.
const OPTION_BITS = [0x08, 0x10, 0x20, 0x40, 0x80];
const optionRead = (v, k) => (v & OPTION_BITS[k]) !== 0;
const choiceReadAll = (v, id) => {
  if (HIDDEN_CHOICE_IDS.has(id)) return true;
  return (v & 0xF8) === 0xF8;
};
const isGold = slot =>
  ENDING_IDS.every(id => flagSet(slot, id)) &&
  slot.choiceBytes.every(v => (v & 0xF8) === 0xF8);

function fillNames(text, names, culprit, inputNames) {
  const ins = inputNames || [];
  return text
    .replace(/\u0001/g, names[0])
    .replace(/\u0002/g, names[1])
    .replace(/\u0003/g, culprit)
    .replace(/\u0004/g, ins[0] || culprit)
    .replace(/\u0005/g, ins[1] || culprit)
    .replace(/\u0006/g, ins[2] || culprit);
}

// Extract the person named in a name-input branch.
function accusedLabel(branch, optionIndex) {
  if (!branch) return '';
  let name = '';
  const at = branch.indexOf('犯人は');
  if (at >= 0) {
    const after = branch.slice(at + 3).replace(/^[、,]\s*/, '');
    const m = after.match(/^\s*([^」\n。]{1,16}?)\s*(?:だ|です|……|」|$)/);
    if (m) name = m[1].trim();
  }
  if (!name) {
    const m = branch.match(/[\u0003-\u0006]/);
    if (m) name = m[0];
  }
  if (!name) {
    const m = branch.trim().match(/^([^\s。、「」]{1,12}?)……/);
    if (m) name = m[1];
  }
  if (!name) return '';
  if (name >= '\u0003' && name <= '\u0006') {
    if (optionIndex === 3) return '（その他の人物）';
    if (optionIndex === 4) return '（適当な名前）';
    return name;
  }
  return name;
}

const NAME_ALIASES = {
  'みきもと': ['みきもと', '美樹本'],
  'たなか': ['たなか', '田中'],
  'としお': ['としお', '俊夫'],
  'かやま': ['かやま', '香山'],
  'みどり': ['みどり'],
  'こばやし': ['こばやし', '小林'],
  'きょうこ': ['きょうこ', '今日子'],
  'はるこ': ['はるこ', '春子'],
  'あき': ['あき', '亜希', '渡瀬'],
  'かなこ': ['かなこ', '可奈子', '北野'],
  'けいこ': ['けいこ', '啓子', '河村'],
  'さんにんぐみ': ['さんにんぐみ', '三人組', '３人組', '三人娘', '３人娘']
};

function inputSelectedIndices(info, slot) {
  if (!info || !info.nameInput || info.inputIndex < 0) return [];
  const name = slot.inputNames[info.inputIndex];
  if (!name) return [];
  const bare = name.replace(/さん$|ちゃん$/, '').replace(/[\s\u3000]/g, '');
  const hits = [];
  let unmatchedIdx = -1;
  info.options.forEach((opt, k) => {
    const label = opt.inputLabel || opt.label;
    if (label === '（一致しない名前）') {
      unmatchedIdx = k;
      return;
    }
    const parts = label.split('／');
    for (const part of parts) {
      const p = part.trim();
      if (bare === p || (NAME_ALIASES[p] && NAME_ALIASES[p].includes(bare))) {
        hits.push(k);
        break;
      }
    }
  });
  if (hits.length === 0 && unmatchedIdx >= 0) {
    hits.push(unmatchedIdx);
  }
  return hits;
}

function inputSelectedIndex(info, slot) {
  const hits = inputSelectedIndices(info, slot);
  return hits.length === 1 ? hits[0] : -1;
}

function isChoiceOptionRead(slot, id, k) {
  if (id === 157) {
    if (k < 4) return optionRead(slot.choiceBytes[156], k);
    if (k === 4) return optionRead(slot.choiceBytes[157], 0);
    if (k === 5) return optionRead(slot.choiceBytes[157], 1);
  }
  if (id === 159) {
    if (k < 4) return optionRead(slot.choiceBytes[158], k);
    if (k === 4) return optionRead(slot.choiceBytes[159], 0);
    if (k === 5) return optionRead(slot.choiceBytes[159], 1);
  }
  return optionRead(slot.choiceBytes[id - 1], k);
}

function dedupeLines(text) {
  const lines = text.split('\n');
  return lines.filter((line, i) => i === 0 || line !== lines[i - 1]).join('\n');
}

function badge(text, on) {
  const b = document.createElement('span');
  b.className = 'badge ' + (on ? 'on' : 'off');
  b.textContent = text;
  return b;
}

function choiceOptionView(id, info, k, v, slot, inferredHit) {
  const opt = (info && info.options && info.options[k]) || { label: '', branch: '' };
  const isName = !!(info && info.nameInput);
  const inputLabel = isName ? (opt.inputLabel || '') : '';
  let label = inputLabel || opt.label;
  if (!label) label = isName ? '（入力名）' : '（テキストなし）';
  const did = isChoiceOptionRead(slot, id, k) || (isName && inferredHit >= 0 && inferredHit === k);
  let title = '';
  if (isName && opt.branch) {
    title = fillNames(opt.branch, slot.names, slot.culpritName, slot.inputNames);
  }
  if (isName && inputLabel.includes('さんにんぐみ') && id !== 159) {
    const note = '「さんにんぐみ」の固有分岐は ID 159 C です。';
    title = title ? title + '\n' + note : note;
  }
  if (!did) {
    const note = '未記録: 選択直後にリセットすると記録されません。章をまたぐか完/終まで進めてください。';
    title = title ? title + '\n' + note : note;
  }
  return {
    label: fillNames(label, slot.names, slot.culpritName, slot.inputNames),
    did,
    title
  };
}

// ===================== game-style flowchart =====================
// Builds the real control-flow graph of the script (chapters / pages /
// choices / endings) and renders it as an SVG branch chart, in the spirit of
// the official Kamaitachi no Yoru flowchart.

let flowGraph = null;   // raw graph from the script bitstream
let chartModel = null;  // display nodes + laid-out edges (slot independent)
// Minimum zoom = the old 1x scaled up by two zoom-in steps (1.25 * 1.25).
const FC_ZOOM_STEP = 1.25;
const FC_MIN_ZOOM = FC_ZOOM_STEP * FC_ZOOM_STEP;
const FC_MAX_ZOOM = 2.5;
let fcZoom = FC_MIN_ZOOM;

// --- raw graph extraction -----------------------------------------------
// 24-bit pointer to chapter 1, embedded as a JMP immediate in the JP game
// ($05FE63-6): value = bit offset 0x0C52 from the script start.
const FC_CHAPTER1_PTR = 0x0C52;

function buildFlowGraphData(rom) {
  const treeSize = readU16(rom, 0x1B0F);
  const n = treeSize / 2 + 1;
  const leftOff = readU16(rom, 0x1B28);
  const rightOff = readU16(rom, 0x1B30);
  const left = new Int32Array(n), right = new Int32Array(n);
  const meta = new Uint8Array(0x63);
  for (let i = 0; i < n; i++) {
    left[i] = readU16(rom, leftOff + 2 * i);
    right[i] = readU16(rom, rightOff + 2 * i);
  }
  for (let i = 0; i < 0x63; i++) meta[i] = rom[0xA901 + 4 * i + 1];
  const baseBit = SCRIPT_START * 8;

  const reader = {
    pos: baseBit,
    readBit() {
      const bit = (rom[reader.pos >>> 3] >>> (reader.pos & 7)) & 1;
      reader.pos++;
      return bit;
    },
    readChar() {
      let v = (n - 1) << 1, g = 0;
      while ((v & 0x8000) === 0) {
        v = reader.readBit() ? right[v >>> 1] : left[v >>> 1];
        if (++g > 64) throw new Error('huffman');
      }
      return v & 0x1FFF;
    },
    readPointerBit() {
      let raw = 0;
      for (let i = 0; i < 24; i++) raw |= reader.readBit() << i;
      const bit = raw & 7;
      const nb = (raw >>> 3) & 0x7FFF;
      const nbn = (raw >>> 18) & 0xF;
      return baseBit + (((nbn << 15) | nb) * 8) + bit;
    },
    readArgs(c) {
      const m = meta[c & 0xFF];
      const na = m & 3;
      const at = m >> 2;
      const args = [], ptrs = [];
      for (let j = 0; j < na; j++) {
        if ((at >>> j) & 1) ptrs.push(reader.readPointerBit());
        else args.push(reader.readChar());
      }
      return { args, ptrs };
    }
  };

  const nodes = new Map();     // key(bit pos) -> node
  const edges = [];            // { from, to, kind, opt?, flag? }
  const choiceAt = new Map();  // choiceId -> node key
  const endingAt = new Map();  // endingId -> node key
  const chapters = [];         // node keys in stream order
  const visited = new Set();

  const root = baseBit + FC_CHAPTER1_PTR;
  // [pos, fromKey, edge, lastFlag] — the flag threads the most recent
  // SET FLAG (ending id) through the path so shared END GAME screens can be
  // attributed to every route that reaches them.
  const work = [[root, null, null, 0]];
  let guard = 8000000;

  while (work.length && guard-- > 0) {
    const [pos, fromKey, edge, flagIn] = work.pop();
    if (edge && fromKey != null) edges.push({ from: fromKey, to: pos, ...edge, endFlag: flagIn });
    if (visited.has(pos)) {
      const seen = nodes.get(pos);
      if (seen && seen.kind === 'end' && flagIn) {
        seen.endingIds.add(flagIn);
        if (!endingAt.has(flagIn)) endingAt.set(flagIn, pos);
      }
      continue;
    }
    visited.add(pos);

    const node = {
      key: pos, kind: 'page', text: '', title: '',
      choiceId: 0, optionTargets: [], endingIds: new Set(), chapterNo: 0
    };
    nodes.set(pos, node);

    reader.pos = pos;
    let lastFlag = flagIn || 0;
    let skipText = false; // between SKIP WHEN PICKED (0x1016) and END CHOICE
    let alive = true;

    while (alive && guard-- > 0) {
      let c;
      try { c = reader.readChar(); } catch (e) { break; }
      if (c < 0x1000) {
        if (!skipText) {
          node.text += CHARMAP[c] !== undefined ? CHARMAP[c] : '';
          if (node.text.length > 600) node.text = node.text.slice(0, 600);
        }
        continue;
      }
      if (PUNCT[c] !== undefined) {
        if (!skipText) node.text += PUNCT[c];
        continue;
      }
      const low = c & 0xFF;
      if (c === 0x1015) { skipText = false; continue; }        // END CHOICE
      if (c === 0x1016) { skipText = true; continue; }         // SKIP WHEN PICKED
      if (c === 0x1018) {                                      // END GAME
        node.kind = 'end';
        if (lastFlag) {
          node.endingIds.add(lastFlag);
          if (!endingAt.has(lastFlag)) endingAt.set(lastFlag, pos);
        }
        break;
      }
      if (c === 0x1024) {                                      // NEW CHAPTER
        node.kind = 'chapter';
        node.text = '';
        continue;
      }
      if (c === 0x1025) {                                      // CLEAR = page end
        if (node.kind === 'chapter') {
          node.title = node.text.trim();
          node.chapterNo = chapters.length + 1;
          chapters.push(pos);
        }
        work.push([reader.pos, pos, { kind: 'flow' }, lastFlag]);
        break;
      }
      if (c >= 0x1050 && c <= 0x1057) {                        // choice
        const nOpt = (meta[low] & 3) + 2;
        const args = [];
        for (let i = 0; i < nOpt + 1; i++) args.push(reader.readChar());
        const ptrs = [];
        for (let i = 0; i < nOpt; i++) ptrs.push(reader.readPointerBit());
        node.kind = 'choice';
        node.choiceId = args[0];
        node.optionTargets = ptrs;
        if (node.choiceId > 0 && !choiceAt.has(node.choiceId)) choiceAt.set(node.choiceId, pos);
        for (let k = ptrs.length - 1; k >= 0; k--) {
          work.push([ptrs[k], pos, { kind: 'opt', opt: k }, lastFlag]);
        }
        break; // flow continues only through the option pointers
      }
      if (c === 0x100F) {                                      // JMP
        const t = reader.readPointerBit();
        work.push([t, pos, { kind: 'jmp' }, lastFlag]);
        break;
      }
      if (c >= 0x1010 && c <= 0x1013) {                        // conditional jumps
        const { args, ptrs } = reader.readArgs(c);
        if (ptrs.length) {
          work.push([ptrs[0], pos, { kind: 'cond', flag: args[0], code: low }, lastFlag]);
        }
        continue; // fallthrough stays in the same page
      }
      if (c === 0x1020) { lastFlag = reader.readArgs(c).args[0] || 0; continue; }
      if (c === 0x1021) { reader.readArgs(c); lastFlag = 0; continue; }
      if (c === 0x1022 || c === 0x1023 || c === 0x1017) { reader.readArgs(c); continue; }
      try { reader.readArgs(c); } catch (e) { break; }
    }
    if (node.kind === 'chapter' && !node.title) node.title = node.text.trim();
  }

  // Merge auxiliary choices 158 into 157, and 160 into 159
  const k157 = choiceAt.get(157);
  const k158 = choiceAt.get(158);
  const k159 = choiceAt.get(159);
  const k160 = choiceAt.get(160);
  if (k157 && k158) {
    const n157 = nodes.get(k157);
    const n158 = nodes.get(k158);
    if (n157 && n158) {
      n157.optionTargets = [...n157.optionTargets.slice(0, 4), ...n158.optionTargets];
      const edges158 = edges.filter(e => e.from === k158);
      for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].from === k158 || edges[i].to === k158) edges.splice(i, 1);
      }
      edges158.forEach(e => {
        edges.push({ from: k157, to: e.to, kind: e.kind, opt: e.opt === 0 ? 4 : 5, endFlag: e.endFlag });
      });
      nodes.delete(k158);
      choiceAt.delete(158);
    }
  }
  if (k159 && k160) {
    const n159 = nodes.get(k159);
    const n160 = nodes.get(k160);
    if (n159 && n160) {
      n159.optionTargets = [...n159.optionTargets.slice(0, 4), ...n160.optionTargets];
      const edges160 = edges.filter(e => e.from === k160);
      for (let i = edges.length - 1; i >= 0; i--) {
        if (edges[i].from === k160 || edges[i].to === k160) edges.splice(i, 1);
      }
      edges160.forEach(e => {
        edges.push({ from: k159, to: e.to, kind: e.kind, opt: e.opt === 0 ? 4 : 5, endFlag: e.endFlag });
      });
      nodes.delete(k160);
      choiceAt.delete(160);
    }
  }

  return { nodes, edges, root, choiceAt, endingAt, chapters };
}

// --- display model: contract pages, order and layout (PS1 flowchart style)
function buildChartModel(raw) {
  const endKey = (n, id) => n.key * 64 + id;
  const nodes = new Map();
  for (const [k, n] of raw.nodes) {
    if (n.kind === 'end' && n.endingIds.size > 1) {
      for (const id of n.endingIds) {
        nodes.set(endKey(n, id), { ...n, key: endKey(n, id), endingIds: new Set([id]) });
      }
    } else {
      nodes.set(k, n);
    }
  }
  const remapEndTarget = e => {
    const t = raw.nodes.get(e.to);
    if (!t || t.kind !== 'end' || t.endingIds.size < 2) return e.to;
    return endKey(t, t.endingIds.has(e.endFlag) ? e.endFlag : [...t.endingIds][0]);
  };
  const adj = new Map();
  raw.edges.forEach((e, i) => {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push({ to: remapEndTarget(e), kind: e.kind, opt: e.opt, flag: e.flag, seq: i });
  });

  const cEdges = [];
  const pairSeen = new Set();
  for (const src of nodes.values()) {
    if (src.kind === 'page') continue;
    const seen = new Set([src.key]);
    let frontier = [{ key: src.key, via: null }];
    while (frontier.length) {
      const next = [];
      for (const fr of frontier) {
        for (const e of (adj.get(fr.key) || [])) {
          if (e.to === src.key) {
            const pk = src.key + '>' + e.to + '/L' + e.opt;
            if (!pairSeen.has(pk)) { pairSeen.add(pk); cEdges.push({ from: src.key, to: e.to, kind: e.kind, opt: e.opt, flag: e.flag, loop: true }); }
            continue;
          }
          const via = fr.via || e;
          const viaOpt = via.opt != null ? 'o' + via.opt : (via.flag != null ? 'f' + via.flag : 'k' + via.kind);
          const stateKey = e.to + '/' + viaOpt;
          if (seen.has(stateKey)) continue;
          seen.add(stateKey);
          const t = nodes.get(e.to);
          if (!t) continue;
          if (t.kind !== 'page') {
            const pk = src.key + '>' + e.to + '/' + viaOpt + via.kind;
            if (!pairSeen.has(pk)) { pairSeen.add(pk); cEdges.push({ from: src.key, to: e.to, kind: via.kind, opt: via.opt, flag: via.flag }); }
          } else {
            next.push({ key: e.to, via });
          }
        }
      }
      frontier = next;
    }
  }

  const outLists = new Map();
  for (const e of cEdges) {
    if (!outLists.has(e.from)) outLists.set(e.from, []);
    outLists.get(e.from).push(e);
  }

  // DFS order for numbering nodes
  const order = new Map();
  const visited = new Set();
  const stack = [raw.root];
  let numCounter = 1;
  while (stack.length) {
    const k = stack.pop();
    if (visited.has(k)) continue;
    visited.add(k);
    order.set(k, numCounter++);
    const outs = outLists.get(k) || [];
    for (let i = outs.length - 1; i >= 0; i--) stack.push(outs[i].to);
  }

  const list = [];
  for (const n of nodes.values()) {
    if (n.kind === 'page') continue;
    const num = order.get(n.key) || numCounter++;
    const ids = n.kind === 'end' ? [...n.endingIds] : [];
    const sub = n.kind === 'end' ? (ids.length === 1 ? 'END' + String(ids[0]).padStart(2, '0') : (ids.length ? 'END×' + ids.length : 'OVER')) : '';
    const optCnt = n.kind === 'choice' ? (n.optionTargets ? n.optionTargets.length : 2) : 0;
    const w = n.kind === 'choice' ? Math.max(30, 8 + optCnt * 8) : 32;
    list.push({ ...n, num, sub, w, h: 18, optCnt });
  }

  // --- Grid placement (PS1 flowchart style) ---
  const STEP_X = 36, STEP_Y = 28;
  const MARGIN_X = 40, MARGIN_Y = 24;

  const colMap = new Map();
  const rowMap = new Map();
  const occupied = new Set();
  const occKey = (c, r) => c + ',' + r;

  function place(k, col, row) {
    if (colMap.has(k)) return;
    let c = col;
    let r = row;
    while (occupied.has(occKey(c, r))) r++;
    colMap.set(k, c);
    rowMap.set(k, r);
    occupied.add(occKey(c, r));

    const outs = (outLists.get(k) || []).slice();
    outs.sort((p, q) => (p.opt ?? 0) - (q.opt ?? 0));

    outs.forEach((e, idx) => {
      if (colMap.has(e.to)) return;
      if (idx === 0) {
        // Main branch (A) continues straight down
        place(e.to, c, r + 1);
      } else {
        // Side branch (B, C...) branches to the right
        let nextC = c + idx;
        while (occupied.has(occKey(nextC, r + 1))) nextC++;
        place(e.to, nextC, r + 1);
      }
    });
  }

  place(raw.root, 8, 0);

  list.forEach(n => {
    if (!colMap.has(n.key)) place(n.key, 0, 0);
  });

  const byId = new Map();
  let maxCol = 0, maxRow = 0;
  list.forEach(n => {
    const c = colMap.get(n.key) || 0;
    const r = rowMap.get(n.key) || 0;
    maxCol = Math.max(maxCol, c);
    maxRow = Math.max(maxRow, r);
    const x = MARGIN_X + c * STEP_X;
    const y = MARGIN_Y + r * STEP_Y;
    const cx = x + n.w / 2;
    byId.set(n.key, { ...n, col: c, row: r, x, y, cx });
  });

  const exitX = new Map();
  cEdges.forEach((e, i) => {
    const a = byId.get(e.from);
    if (!a) return;
    if (a.kind === 'choice' && e.opt != null) {
      exitX.set(i, a.x + 6 + e.opt * 8);
    } else {
      exitX.set(i, a.cx);
    }
  });

  const paths = [];
  cEdges.forEach((e, i) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) { paths.push(null); return; }
    const sx = exitX.get(i) || a.cx;
    const ex = b.cx;
    let d = '';

    if (e.loop || e.from === e.to) {
      d = 'M ' + (a.x + a.w) + ' ' + (a.y + 4) + ' h 6 v ' + (a.h - 8) + ' h -6';
    } else if (b.row > a.row) {
      if (a.col === b.col && Math.abs(sx - ex) < 3) {
        d = 'M ' + sx + ' ' + (a.y + a.h) + ' V ' + b.y;
      } else {
        const midY = a.y + a.h + 5;
        d = 'M ' + sx + ' ' + (a.y + a.h) + ' V ' + midY + ' H ' + ex + ' V ' + b.y;
      }
    } else if (b.row === a.row) {
      const midY = a.y + a.h + 5;
      d = 'M ' + sx + ' ' + (a.y + a.h) + ' V ' + midY + ' H ' + ex + ' V ' + b.y;
    } else {
      // Local backward edge: bypass through adjacent lane
      const laneX = Math.max(a.x + a.w + 6, b.x + b.w + 6);
      const exitY = a.y + a.h + 4;
      const entryY = b.y - 4;
      d = 'M ' + sx + ' ' + (a.y + a.h) + ' V ' + exitY + ' H ' + laneX + ' V ' + entryY + ' H ' + ex + ' V ' + b.y;
    }
    paths.push(d);
  });

  const _W = MARGIN_X * 2 + (maxCol + 1) * STEP_X + 60;
  const _H = MARGIN_Y * 2 + (maxRow + 1) * STEP_Y + 60;
  return { nodes: list, edges: cEdges, paths, byId, _W, _H, raw };
}

// --- rendering (PS1 flowchart style) -------------------------------------
const FC = {
  barH: 8,
  fullH: 18,
  font: 'ui-monospace, monospace',
  col: {
    chapter: '#a89e3a', chapterBody: '#22222d',
    choice: '#782856', choiceBody: '#20121b',
    input: '#208838', inputBody: '#0d2614',
    endOn: '#9a181e', endOnBody: '#240a0e',
    endOff: '#5c1014', endOffBody: '#16080a',
    over: '#444455', overBody: '#181820',
    num: '#ffffff',
    read: '#55cc66', unread: '#887788',
    endTextOn: '#ffffff', endTextOff: '#883a40',
    line: '#505060'
  }
};

function fcEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function choiceState(slot, id, info) {
  const v = slot.choiceBytes[id - 1];
  const count = info ? info.count : 0;
  const inferredHits = info && info.nameInput ? inputSelectedIndices(info, slot) : [];
  const inferredHit = inferredHits.length === 1 ? inferredHits[0] : -1;
  const opts = [];
  for (let k = 0; k < count; k++) {
    opts.push(isChoiceOptionRead(slot, id, k) || (info && info.nameInput && inferredHit >= 0 && inferredHit === k));
  }
  return { opts, any: opts.some(Boolean), all: opts.length > 0 && opts.every(Boolean), count };
}

function renderFlowChart(slot) {
  const wrap = $('fcScroll');
  if (!wrap) return;
  if (!chartModel) {
    wrap.innerHTML = '<div style="padding:20px;color:#888888;font-size:13px">ROM を読み込んで「解析する」を実行すると、フローチャートを生成できます。</div>';
    $('fcDetail').innerHTML = '';
    return;
  }
  const { nodes, edges, paths } = chartModel;
  const W = chartModel._W, H = chartModel._H;
  const C = FC.col, fnt = FC.font;

  const sw = [];

  // Edges
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i], d = paths[i];
    if (!d) continue;
    sw.push('<path d="' + d + '" fill="none" stroke="' + C.line + '" stroke-width="1"><title>' + fcEsc(fcEdgeTitle(e, slot)) + '</title></path>');
  }

  // Nodes
  for (const n of nodes) {
    const p = chartModel.byId.get(n.key);
    let bar, body, numFill = C.num, tip = '', below = '';
    const baseY = p.y + FC.barH + 7.5;

    if (n.kind === 'chapter') {
      bar = C.chapter;
      body = C.chapterBody;
      tip = '章: ' + (n.title || '');
    } else if (n.kind === 'choice') {
      const info = choiceInfo.get(n.choiceId);
      const st = slot ? choiceState(slot, n.choiceId, info) : { any: false, all: false, opts: [], count: info ? info.count : 0 };
      const isInput = !!(info && info.nameInput);
      bar = isInput ? C.input : C.choice;
      body = isInput ? C.inputBody : C.choiceBody;
      tip = '選択肢 ID ' + n.choiceId + (isInput ? '（名前入力）' : '');
      const cnt = p.optCnt || (info ? info.count : 2);
      for (let k = 0; k < cnt; k++) {
        const isRead = slot ? st.opts[k] : false;
        const color = isRead ? C.read : (slot ? C.unread : '#cccccc');
        below += '<text x="' + (p.x + 6 + k * 8) + '" y="' + baseY + '" font-size="7" font-weight="bold" font-family="' + fnt + '" fill="' + color + '">' + String.fromCharCode(65 + k) + '</text>';
      }
    } else {
      const ids = [...n.endingIds];
      if (!ids.length) {
        bar = C.over; body = C.overBody;
        tip = 'GAME OVER';
        below = '<text x="' + (p.x + 3) + '" y="' + baseY + '" font-size="6.5" font-weight="bold" font-family="' + fnt + '" fill="#7a8296">' + fcEsc(p.sub) + '</text>';
      } else {
        const seen = !!slot && ids.some(id => flagSet(slot, id));
        bar = seen ? C.endOn : C.endOff;
        body = seen ? C.endOnBody : C.endOffBody;
        tip = ids.map(id => 'END ' + String(id).padStart(2, '0') + ' ' + (ENDING_NAMES[id] || '')).join('\n');
        below = '<text x="' + (p.x + 3) + '" y="' + baseY + '" font-size="6.5" font-weight="bold" font-family="' + fnt + '" fill="' + (seen ? C.endTextOn : C.endTextOff) + '">' + fcEsc(p.sub) + '</text>';
      }
    }

    sw.push('<g class="fc-node" data-key="' + n.key + '" style="cursor:pointer">' +
      '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + FC.barH + '" fill="' + bar + '"/>' +
      '<rect x="' + p.x + '" y="' + (p.y + FC.barH) + '" width="' + p.w + '" height="' + (p.h - FC.barH) + '" fill="' + body + '"/>' +
      '<text x="' + (p.x + 3) + '" y="' + (p.y + 6.5) + '" font-size="6.5" font-weight="bold" font-family="' + fnt + '" fill="' + numFill + '">' + p.num + '</text>' +
      '<title>' + fcEsc('No.' + p.num + '  ' + tip) + '</title>' + below + '</g>');
  }

  if (fcZoom == null) fcZoom = Math.max(FC_MIN_ZOOM, Math.min(2, (wrap.clientWidth - 24) / W));
  wrap.innerHTML = '<svg id="fcSvg" shape-rendering="crispEdges" width="' + Math.round(W * fcZoom) + '" height="' + Math.round(H * fcZoom) + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<g>' + sw.join('') + '</g></svg>';

  wrap.querySelectorAll('g.fc-node').forEach(g => {
    g.addEventListener('click', () => {
      const key = Number(g.dataset.key);
      const n = chartModel.byId.get(key) || chartModel.raw.nodes.get(key);
      if (n) fcShowDetail(n, slot);
    });
  });
}


function fcEdgeTitle(e, slot) {
  const a = chartModel.byId.get(e.from), b = chartModel.byId.get(e.to);
  const nameOf = n => {
    if (!n) return '';
    if (n.kind === 'choice') return '選択肢 ' + n.choiceId;
    if (n.kind === 'end') return n.endingIds.size ? 'END ' + [...n.endingIds].map(x => x.toString(16).toUpperCase()).join('/') : 'GAME OVER';
    if (n.kind === 'chapter') return '章「' + (n.title || '') + '」';
    return '';
  };
  let s = nameOf(a) + ' → ' + nameOf(b);
  if (e.kind === 'opt') s = '選択肢 ' + a.choiceId + ' の ' + String.fromCharCode(65 + (e.opt || 0)) + ' → ' + nameOf(b);
  else if (e.kind === 'cond') s += '（条件分岐）';
  else if (e.kind === 'jmp') s += '（ジャンプ）';
  return s;
}

function fcShowDetail(n, slot) {
  const box = $('fcDetail');
  const pm = chartModel.byId.get(n.key);
  const no = pm ? 'No.' + pm.num + ' ' : '';
  const parts = [];
  if (n.kind === 'choice') {
    const info = choiceInfo.get(n.choiceId);
    parts.push('<div class="t">' + no + '選択肢 ID ' + n.choiceId + (info && info.nameInput ? '（犯人名入力）' : '') + '</div>');
    if (info && info.context) {
      parts.push('<div class="ctx">' + fcEsc(fillNames(dedupeLines(info.context.trim()), slot.names, slot.culpritName, slot.inputNames)) + '</div>');
    }
    if (info) {
      const st = choiceState(slot, n.choiceId, info);
      info.options.forEach((opt, k) => {
        const view = choiceOptionView(n.choiceId, info, k, slot.choiceBytes[n.choiceId - 1], slot, inferredSingle(info, slot));
        parts.push('<div class="opt"><span class="tag">' + String.fromCharCode(65 + k) + '</span><span>' +
          fcEsc(view.label) + '</span>' + (view.did ? ' <span class="badge on">済</span>' : ' <span class="badge off">未</span>') + '</div>');
      });
    }
  } else if (n.kind === 'end') {
    const ids = [...n.endingIds];
    if (!ids.length) parts.push('<div class="t">' + no + 'GAME OVER</div>');
    else {
      parts.push('<div class="t">' + no + 'エンディング</div>');
      ids.forEach(id => {
        const on = flagSet(slot, id);
        parts.push('<div class="opt"><span class="tag">END ' + String(id).padStart(2, '0') + '</span><span>' +
          fcEsc(ENDING_NAMES[id] || '') + '</span>' + (on ? ' <span class="badge on">済</span>' : ' <span class="badge off">未</span>') + '</div>');
      });
    }
  } else if (n.kind === 'chapter') {
    parts.push('<div class="t">' + no + '章「' + fcEsc(n.title || '') + '」</div>');
  }
  box.innerHTML = parts.join('');
}

function inferredSingle(info, slot) {
  if (!info || !info.nameInput) return -1;
  const hits = inputSelectedIndices(info, slot);
  return hits.length === 1 ? hits[0] : -1;
}

function fcFitZoom() {
  const wrap = $('fcScroll');
  if (!wrap || !chartModel) return;
  fcZoom = Math.max(FC_MIN_ZOOM, Math.min(2, (wrap.clientWidth - 24) / (chartModel._W || 2000)));
  fcApplyZoom();
}

function fcApplyZoom() {
  const svg = $('fcSvg');
  if (!svg || !chartModel) return;
  const m = chartModel;
  const W = m._W || (FC.margin * 2 + (m.maxCol || 0) * 60 + 160);
  const H = m._H || (FC.margin * 2 + m.maxD * 30 + 40);
  svg.setAttribute('width', Math.round(W * fcZoom));
  svg.setAttribute('height', Math.round(H * fcZoom));
}

function render() {
  const slot = sramSlots[selectedSlot];
  const names = slot.names;
  const culprit = slot.culpritName;
  const seen = ENDING_IDS.filter(id => flagSet(slot, id));
  let complete = 0;
  for (let i = 0; i < slot.choiceBytes.length; i++) {
    const id = i + 1;
    if (HIDDEN_CHOICE_IDS.has(id)) continue;
    const info = choiceInfo.get(id);
    if (info) {
      if (choiceState(slot, id, info).all) complete++;
    } else {
      if (choiceReadAll(slot.choiceBytes[i], id)) complete++;
    }
  }

  $('nEnd').textContent = seen.length + '/' + ENDING_IDS.length;
  $('nChoice').textContent = complete + '/' + (160 - HIDDEN_CHOICE_IDS.size);
  $('nPlay').textContent = slot.playthrus;

  const pink = isPink(slot), gold = isGold(slot);
  document.body.classList.remove('bg-pink', 'bg-gold');
  if (gold) {
    document.body.classList.add('bg-gold');
  } else if (pink) {
    document.body.classList.add('bg-pink');
  }
  $('goldStatus').textContent = gold ? '金のしおり: 条件達成（セーブ判定）' : (pink ? 'ピンクのしおり: 達成 / 金のしおり: 未達成' : 'ピンク・金のしおり: 未達成');
  $('goldStatus').style.color = gold ? 'var(--gold)' : 'var(--fg)';
  $('bar').style.width = Math.round((complete / (160 - HIDDEN_CHOICE_IDS.size)) * 100) + '%';
  $('hintBox').textContent = 'ピンクのしおり = ★の付いたエンディング (' + PINK_IDS.length + '種) を全て見る。\n' +
    '金のしおり = 全エンディング (' + ENDING_IDS.length + '種) + 全選択肢 + 全ルート（犯人入力 1回目5・2回目6・3回目6、悪霊編2、雪の迷路3入口と巡回変化、あいつだ/真理だの2種）。選択肢は章をまたぐか完/終到達で記録されます。';
  $('stats').hidden = false;
  $('goldStatus').hidden = false;
  $('barWrap').hidden = false;
  $('hintBox').hidden = false;
  $('grid').hidden = false;
  $('endCard').hidden = viewMode !== 'end';
  $('choiceCard').hidden = viewMode !== 'choice';
  $('flowCard').hidden = viewMode !== 'flow';

  const endBody = $('endBody');
  const ef = document.createDocumentFragment();
  for (const id of ENDING_IDS) {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    td0.className = 'id';
    td0.textContent = String(id).padStart(2, '0');
    const td1 = document.createElement('td');
    td1.textContent = 'END ' + String(id).padStart(2, '0') + ' ' + (ENDING_NAMES[id] || '');
    if (PINK_IDS.includes(id)) {
      const star = document.createElement('span');
      star.className = 'star';
      star.textContent = '★';
      td1.append(star);
    }
    const td2 = document.createElement('td');
    const on = flagSet(slot, id);
    td2.append(badge(on ? '済' : '未', on));
    tr.append(td0, td1, td2);
    ef.append(tr);
  }
  endBody.replaceChildren(ef);

  const choiceBody = $('choiceBody');
  const cf = document.createDocumentFragment();
  slot.choiceBytes.forEach((v, i) => {
    if (HIDDEN_CHOICE_IDS.has(i + 1)) return;
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    td0.className = 'id';
    td0.textContent = String(i + 1);
    const td1 = document.createElement('td');
    const info = choiceInfo.get(i + 1);
    const ctx = document.createElement('div');
    ctx.className = 'ctx';
    ctx.textContent = info && info.context
      ? fillNames(dedupeLines(info.context.trim()), names, culprit, slot.inputNames)
      : '';
    td1.append(ctx);
    const opts = document.createElement('div');
    opts.className = 'opts';
    const count = info ? info.count : 0;
    // Bits 3-7 are the per-option flags A-E; bits 0-2 are route flags, not
    // a count. v >= 0xF8 means all five option positions were read.
    const optionBits = v & 0xF8;
    const inferredHits = info && info.nameInput ? inputSelectedIndices(info, slot) : [];
    // A placeholder-only name input (e.g. 159) makes every option look like the
    // same saved name. Only trust an inference when it identifies one option.
    const inferredHit = inferredHits.length === 1 ? inferredHits[0] : -1;
    let allRead = count > 0;
    for (let k = 0; k < count; k++) {
      const line = document.createElement('div');
      const view = choiceOptionView(i + 1, info, k, v, slot, inferredHit);
      line.textContent = String.fromCharCode(65 + k) + ' ' + view.label;
      line.append(' ', badge(view.did ? '済' : '未', view.did));
      if (!view.did) allRead = false;
      if (view.title) line.title = view.title;
      opts.append(line);
    }
    td1.append(opts);
    const td2 = document.createElement('td');
    const on = info ? allRead : choiceReadAll(v, i + 1);
    td2.append(badge(on ? '済' : '未', on));
    if (!on) {
      td2.title = (optionBits === 0 && inferredHit < 0)
        ? 'セーブに記録がありません。選択直後のリセットでは記録されません。'
        : '未読の選択肢があります。';
    }
    tr.append(td0, td1, td2);
    cf.append(tr);
  });
  choiceBody.replaceChildren(cf);
  renderFlowChart(slot);
  $('status').textContent = 'しおり' + (selectedSlot + 1) + ' を表示中 (' + slot.records + 'ブロック)';
}

function renderSlots() {
  const sel = $('slotSelect');
  sel.innerHTML = '';
  sramSlots.forEach(slot => {
    const opt = document.createElement('option');
    opt.value = String(slot.index);
    opt.textContent = 'しおり' + (slot.index + 1) + (slot.used ? '' : ' 空');
    opt.disabled = !slot.used;
    sel.append(opt);
  });
  sel.value = String(selectedSlot);
  sel.onchange = () => { selectedSlot = Number(sel.value); render(); };
}

document.querySelectorAll('.chip[data-view]').forEach(chip => {
  chip.onclick = () => {
    document.querySelectorAll('.chip[data-view]').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    viewMode = chip.dataset.view;
    if (sramSlots) render();
  };
});

$('fcZoomIn').onclick = () => { fcZoom = Math.min(FC_MAX_ZOOM, (fcZoom || FC_MIN_ZOOM) * FC_ZOOM_STEP); fcApplyZoom(); };
$('fcZoomOut').onclick = () => { fcZoom = Math.max(FC_MIN_ZOOM, (fcZoom || FC_MIN_ZOOM) / FC_ZOOM_STEP); fcApplyZoom(); };
$('fcZoomReset').onclick = () => { fcZoom = FC_MIN_ZOOM; fcApplyZoom(); };
$('fcFit').onclick = () => fcFitZoom();

const EXPECTED_ROM_SHA256 = '3228a3b35f7d234a7bf91f8159ccc56518199222e84d258c14a153f54f9fcbc7';

async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

$('romFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const hashEl = $('romHash');
  if (hashEl) hashEl.textContent = 'SHA-256 を計算中...';
  f.arrayBuffer().then(async b => {
    let raw = new Uint8Array(b);
    if (raw.length % 1024 === 512) {
      raw = raw.subarray(512);
    }
    romBytes = raw;
    const hash = await sha256Hex(romBytes);
    const ok = (hash === EXPECTED_ROM_SHA256);
    if (hashEl) {
      if (ok) {
        hashEl.innerHTML = '<span style="color:#008800; font-weight:bold;">[検証一致]</span> かまいたちの夜 (SFC 日本版 / SHA-256: ' + hash.slice(0, 16) + '...)';
      } else {
        hashEl.innerHTML = '<span style="color:#cc0000; font-weight:bold;">[不一致]</span> SHA-256: ' + hash;
      }
    }
    $('status').textContent = ok ? 'ROM を正常に認識しました。' : '警告: 指定されたROMのハッシュが公式日本版と一致しません。';
    $('status').style.color = ok ? '#008800' : '#cc0000';
  }).catch(err => {
    if (hashEl) hashEl.textContent = '読み込みエラー: ' + err.message;
  });
};
$('srmFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  f.arrayBuffer().then(b => {
    srmBytes = new Uint8Array(b);
    $('status').textContent = 'セーブデータ読み込み: ' + srmBytes.length + ' bytes';
    $('run').disabled = false;
  });
};

$('run').onclick = () => {
  try {
    choiceInfo = romBytes ? decodeChoices(romBytes) : new Map();
    flowGraph = romBytes ? buildFlowGraphData(romBytes) : null;
    chartModel = flowGraph ? buildChartModel(flowGraph) : null;
    fcZoom = null;
    $('fcDetail').innerHTML = '';
    sramSlots = parseSram(srmBytes);
    let best = -1;
    sramSlots.forEach(s => {
      if (!s.used) return;
      if (best < 0 || s.records > sramSlots[best].records) best = s.index;
    });
    if (best >= 0) selectedSlot = best;
    renderSlots();
    render();
  } catch (e) {
    $('status').textContent = 'エラー: ' + e.message;
  }
};
