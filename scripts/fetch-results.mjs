// scripts/fetch-results.mjs
//
// 毎日GitHub Actionsから実行される想定のスクリプト。
// 1. 結果ページを取得
// 2. 登録済みの40校が関わる試合を抽出
// 3. data/matches.json に無い試合だけ追記して保存
//
// ⚠️ 大会が始まってから実際のページ構造を見ながら SOURCE_URL と
//    parseSchedule() の中身を調整する必要があります（要キャリブレーション）。

import fs from 'fs';
import * as cheerio from 'cheerio';

// ===== 1. 事前登録：10人 × 4校 =====
const OWNERS = {
  "玉那覇":   ["佐賀商","神村学園","日本文理","佐野日大"],
  "りゅうせい": ["天理","健大高崎","八王子実践","東日大昌平"],
  "しんご":   ["敦賀気比","英明","明徳義塾","白樺学園"],
  "しょうと":  ["履正社","有明","日南学園","聖隷クリストファー"],
  "こうき":   ["社","東筑","岡山学芸館","横浜"],
  "まっきー":  ["享栄","関東第一","立命館宇治","中京"],
  "まさはる":  ["拓大紅陵","鶴岡東","札幌日大","霞ヶ浦"],
  "よしひこ":  ["三重","遊学館","青森山田","八幡商"],
  "かずほ":   ["福山","長崎日大","花巻東","鳥取城北"],
  "よしや":   ["花咲徳栄","東海大甲府","大分商","立正大淞南"]
};
const OWNED_SCHOOLS = Object.values(OWNERS).flat();

// ===== 2. 取得元（要調整）=====
// 実際の大会が始まったら、確実にスコアが載っているページに差し替えてください。
// 例: 朝日新聞デジタル「高校野球」速報ページ、日本高野連の公式結果ページなど。
const SOURCE_URL = 'https://www.asahi.com/koshien/';

const DATA_PATH = new URL('../data/matches.json', import.meta.url);

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMatches(matches) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(matches, null, 2), 'utf-8');
}

// ざっくり「学校名 数字 - 数字 学校名」のパターンをテキストから拾う。
// サイトのHTML構造に依存しすぎないよう、まずテキスト全体から正規表現で当たりを付ける方式。
function extractMatchesFromText(text) {
  const found = [];
  const allSchools = [...new Set([...OWNED_SCHOOLS])];
  // "学校A" と "学校B" が近い位置にあり、間または直後にスコアらしき数字がある行を拾う
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const scoreMatch = line.match(/(\d{1,2})\s*[-－ー]\s*(\d{1,2})/);
    if (!scoreMatch) continue;

    const hitSchools = allSchools.filter(s => line.includes(s));
    if (hitSchools.length >= 1) {
      found.push({
        rawLine: line,
        scoreA: parseInt(scoreMatch[1], 10),
        scoreB: parseInt(scoreMatch[2], 10),
        schoolsDetected: hitSchools
      });
    }
  }
  return found;
}

async function main() {
  const existing = loadExisting();
  const existingKeys = new Set(existing.map(m => `${m.date}|${m.teamA}|${m.teamB}`));

  let html;
  try {
    const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    html = await res.text();
  } catch (e) {
    console.error('取得に失敗しました:', e.message);
    process.exit(0); // 失敗してもワークフロー自体は落とさない
  }

  const $ = cheerio.load(html);
  const pageText = $('body').text();

  const candidates = extractMatchesFromText(pageText);

  if (candidates.length === 0) {
    console.log('本日、対象校が関わる試合結果は見つかりませんでした（サイト構造が変わっている可能性もあります）。');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let added = 0;

  for (const c of candidates) {
    // schoolsDetectedが1校しか取れていない場合は自動判定を諦めて手動確認に回す
    if (c.schoolsDetected.length < 2) {
      console.log('⚠️ 要確認（相手校を特定できず）:', c.rawLine);
      continue;
    }
    const [teamA, teamB] = c.schoolsDetected;
    const key = `${today}|${teamA}|${teamB}`;
    if (existingKeys.has(key)) continue;

    const winner = c.scoreA > c.scoreB ? teamA : teamB;
    const loser = c.scoreA > c.scoreB ? teamB : teamA;

    existing.push({
      id: Date.now() + added,
      round: '自動取得',
      date: today,
      teamA, teamB,
      scoreA: c.scoreA, scoreB: c.scoreB,
      winner, loser,
      source: SOURCE_URL,
      auto: true
    });
    added++;
  }

  if (added > 0) {
    saveMatches(existing);
    console.log(`${added}件の試合結果を追加しました。`);
  } else {
    console.log('新しく追加する試合はありませんでした。');
  }
}

main();
