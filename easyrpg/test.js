const value = "Soundfont=/Soundfont/Scc1t2.sf2";
const soundfont = value.split('/').pop() || '';
console.log(soundfont);
