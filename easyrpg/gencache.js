/**
 * gencache.js - EasyRPG Web向け 自動キャッシュ生成スクリプト (GitHub Actions用)
 */
const fs = require('fs');
const path = require('path');

function stripExt(inFile) {
    const pos = inFile.lastIndexOf('.');
    return pos === -1 ? inFile : inFile.substring(0, pos);
}

function parseDirRecursive(dirPath, depth, isFirst = false) {
    const r = {};
    if (depth === 0) return r;

    let entries;
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {
        return r;
    }

    if (!isFirst) {
        r["_dirname"] = path.basename(dirPath);
    }

    // 無視するファイル・フォルダのリスト（自動生成ループや不要なファイルを防ぐ）
    const ignoreList = ['.git', '.github', 'gencache.js', 'index.json', 'index.html', 'node_modules', 'README.md'];

    for (const dent of entries) {
        const dirname = dent.name;

        if (dirname === ".." || dirname === "." || ignoreList.includes(dirname)) {
            continue;
        }

        let lowerDirname = dirname.toLowerCase().normalize("NFKC");

        if (dent.isDirectory()) {
            const temp = parseDirRecursive(path.join(dirPath, dirname), depth - 1, false);
            if (Object.keys(temp).length > 0) {
                r[lowerDirname] = temp;
            }
        }

        const keepExtension = (src) => [".ini", ".po"].some(ext => src.endsWith(ext));

        if (dent.isFile() || dent.isSymbolicLink()) {
            if (isFirst || keepExtension(lowerDirname)) {
                if (stripExt(lowerDirname) === "exfont") {
                    lowerDirname = "exfont";
                }
                r[lowerDirname] = dirname;
            } else {
                r[stripExt(lowerDirname)] = dirname;
            }
        }
    }
    return r;
}

function main() {
    const targetPath = ".";
    const output = "index.json";
    const recursionDepth = 4; // 必要に応じて深くしてください

    console.log("Generating index.json...");

    const cache = parseDirRecursive(targetPath, recursionDepth, true);
    const date = new Date().toISOString().split('T')[0];

    const out = {
        metadata: {
            version: 2,
            date: date
        },
        cache: cache
    };

    // GitHub Pagesの通信量を減らすため、圧縮されたJSON（スペースなし）を出力
    fs.writeFileSync(output, JSON.stringify(out), 'utf8');
    console.log(`Success: "${output}" has been generated.`);
    return 0;
}

if (require.main === module) {
    process.exit(main());
}
