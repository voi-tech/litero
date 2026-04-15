// scripts/build-dictionary.mjs
// Pobiera oficjalny słownik gier słownych SJP.pl i buduje data/dictionary.json
// Źródło: https://sjp.pl/sl/growy/ (GPL 2 / CC BY 4.0)
// Uruchomienie: node scripts/build-dictionary.mjs

import https from 'node:https';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, createWriteStream, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'dictionary.json');
const TMP_DIR = '/tmp/sjp-build';
const INDEX_URL = 'https://sjp.pl/sl/growy/';

// Litery polskiego alfabetu używane w grze (bez q/v/x)
const GAME_LETTERS = new Set('aąbcćdeęfghijklłmnńoóprsśtuwyzźż');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    https.get(url, { headers: { 'User-Agent': 'litero-build/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400)
        return resolve(httpsGet(res.headers.location));
      res.setEncoding('latin1');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpsDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'litero-build/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400)
        return resolve(httpsDownload(res.headers.location, dest));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Pobieranie listy słów z sjp.pl...');
  const html = await httpsGet(INDEX_URL);

  const match = html.match(/href="(sjp-\d{8}\.zip)"/);
  if (!match) throw new Error('Nie znaleziono linku do ZIP na sjp.pl/sl/growy/');
  const zipFilename = match[1];
  const zipUrl = `https://sjp.pl/sl/growy/${zipFilename}`;
  console.log(`Pobieranie: ${zipUrl}`);

  mkdirSync(TMP_DIR, { recursive: true });
  const zipPath = path.join(TMP_DIR, zipFilename);
  await httpsDownload(zipUrl, zipPath);
  console.log(`Pobrano: ${zipPath}`);

  execSync(`unzip -o "${zipPath}" slowa.txt -d "${TMP_DIR}"`);
  const raw = readFileSync(path.join(TMP_DIR, 'slowa.txt'), 'utf-8');

  const words = raw.split(/\r?\n/).filter(w => {
    if (!w || w.length < 2 || w.length > 8) return false;
    return [...w].every(c => GAME_LETTERS.has(c));
  });

  console.log(`Słów po filtracji: ${words.length}`);
  writeFileSync(OUT, JSON.stringify(words));
  const sizeMB = (Buffer.byteLength(JSON.stringify(words)) / 1024 / 1024).toFixed(2);
  console.log(`Zapisano: ${OUT} (${sizeMB} MB)`);

  rmSync(TMP_DIR, { recursive: true, force: true });
}

main().catch(err => { console.error(err); process.exit(1); });
