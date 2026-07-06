function escapeIniValue(value) {
  return String(value || '').replace(/\r?\n/g, ' ');
}

function mergeSettingsIntoIni(iniText, updates) {
  const lines = iniText.split(/\r?\n/);
  const resultLines = [];
  
  let currentSection = '';
  const updatedKeys = new Set();
  
  const targetUpdates = {};
  if (updates.soundfont !== undefined) {
    targetUpdates['audio:soundfont'] = updates.soundfont ? `Soundfont=Soundfont/${escapeIniValue(updates.soundfont)}` : 'Soundfont=';
  }
  if (updates.font1 !== undefined) {
    targetUpdates['player:font1'] = updates.font1 ? `Font1=Fonts/${escapeIniValue(updates.font1)}` : 'Font1=';
  }
  if (updates.font2 !== undefined) {
    targetUpdates['player:font2'] = updates.font2 ? `Font2=Fonts/${escapeIniValue(updates.font2)}` : 'Font2=';
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.substring(1, trimmed.length - 1).toLowerCase();
      resultLines.push(line);
      continue;
    }
    
    if (trimmed.startsWith(';') || !trimmed) {
      resultLines.push(line);
      continue;
    }
    
    const parts = trimmed.split('=');
    const key = parts[0].trim().toLowerCase();
    const mapKey = `${currentSection}:${key}`;
    
    if (targetUpdates[mapKey] !== undefined) {
      resultLines.push(targetUpdates[mapKey]);
      updatedKeys.add(mapKey);
    } else {
      resultLines.push(line);
    }
  }
  
  const sectionsToAppend = {};
  for (const [mapKey, newline] of Object.entries(targetUpdates)) {
    if (!updatedKeys.has(mapKey)) {
      const [sec, key] = mapKey.split(':');
      if (!sectionsToAppend[sec]) sectionsToAppend[sec] = [];
      sectionsToAppend[sec].push(newline);
    }
  }
  
  if (Object.keys(sectionsToAppend).length > 0) {
    let finalLines = [];
    let currentSec = '';
    
    for (const line of resultLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        if (currentSec && sectionsToAppend[currentSec]) {
          finalLines.push(...sectionsToAppend[currentSec]);
          delete sectionsToAppend[currentSec];
        }
        currentSec = trimmed.substring(1, trimmed.length - 1).toLowerCase();
      }
      finalLines.push(line);
    }
    if (currentSec && sectionsToAppend[currentSec]) {
      finalLines.push(...sectionsToAppend[currentSec]);
      delete sectionsToAppend[currentSec];
    }
    
    for (const [sec, lines] of Object.entries(sectionsToAppend)) {
      finalLines.push(`[${sec.charAt(0).toUpperCase() + sec.slice(1)}]`);
      finalLines.push(...lines);
    }
    return finalLines.join('\n');
  }
  return resultLines.join('\n');
}

console.log(mergeSettingsIntoIni('', { soundfont: 'Scc1t2.sf2' }));
