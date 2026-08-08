// scripts/fetch-results.mjs
//
// GitHub Actionsから毎日実行される想定のスクリプト。
// Yahoo!スポーツナビ「バーチャル高校野球」の日程・結果ページを
// 実際にヘッドレスブラウザ（Playwright）で開いて読み取る。
// （このページは単純なfetch()だとJS無効の代替表示になり中身が取れないため）
//
// 1. ページを開く
// 2. 日程・結果一覧テーブルから「試合終了」の試合だけを抽出
// 3. 登録済みの40校が関わる試合のみ対象
// 4. data/matches.json に無い試合だけ追記して保存

import fs from 'fs';
import { chromium } from 'playwright';

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
const OWNED_SCHOOLS = new Set(Object.values(OWNERS).flat());

const SOURCE_URL = 'https://baseball.yahoo.co.jp/hsb_summer/schedule/competition';
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

// ページ内で実行する抽出ロジック（ブラウザのDOMを直接読む）
function extractRowsInPage() {
  const rows = [...document.querySelectorAll('.bb-scheduleTable__row')];
  const results = [];
  let currentDateText = null;

  for (const row of rows) {
    const headEl = row.querySelector('.bb-scheduleTable__head');
    if (headEl) {
      // 例: "第1日目 8月5日（水）" から月日部分を取り出す
      const m = headEl.textContent.match(/(\d+)月(\d+)日/);
      if (m) currentDateText = { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };
    }

    const round = row.querySelector('.bb-scheduleTable__data--round')?.textContent.trim() || '';
    const homeEl = row.querySelector('.bb-scheduleTable__data--homeTeam a');
    const awayEl = row.querySelector('.bb-scheduleTable__data--awayTeam a');
    const infoEl = row.querySelector('.bb-scheduleTable__data--info');
    if (!homeEl || !awayEl || !infoEl) continue;

    const statusText = infoEl.querySelector('a')?.textContent.trim() || '';
    const homeScoreEl = infoEl.querySelector('.bb-scheduleTable__homeScore');
    const awayScoreEl = infoEl.querySelector('.bb-scheduleTable__awayScore');

    if (statusText !== '試合終了' || !homeScoreEl || !awayScoreEl) continue;

    results.push({
      dateInfo: currentDateText,
      round,
      home: homeEl.textContent.trim(),
      away: awayEl.textContent.trim(),
      homeScore: parseInt(homeScoreEl.textContent.trim(), 10),
      awayScore: parseInt(awayScoreEl.textContent.trim(), 10)
    });
  }
  return results;
}

async function main() {
  const existing = loadExisting();
  const existingKeys = new Set(existing.map(m => `${m.date}|${m.teamA}|${m.teamB}`));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  let rawResults = [];
  try {
    await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.bb-scheduleTable__row', { timeout: 15000 });
    rawResults = await page.evaluate(extractRowsInPage);
  } catch (e) {
    console.error('取得に失敗しました:', e.message);
  } finally {
    await browser.close();
  }

  if (rawResults.length === 0) {
    console.log('試合終了の結果が見つかりませんでした（大会未開始、またはページ構造の変更の可能性）。');
    return;
  }

  const year = new Date().getFullYear();
  let added = 0;

  for (const r of rawResults) {
    // 登録済み40校のどちらかが関わる試合のみ対象
    const homeOwned = OWNED_SCHOOLS.has(r.home);
    const awayOwned = OWNED_SCHOOLS.has(r.away);
    if (!homeOwned && !awayOwned) continue;
    if (!r.dateInfo) continue;

    const date = `${year}-${String(r.dateInfo.month).padStart(2, '0')}-${String(r.dateInfo.day).padStart(2, '0')}`;
    const teamA = r.home, teamB = r.away;
    const key = `${date}|${teamA}|${teamB}`;
    if (existingKeys.has(key)) continue;

    const winner = r.homeScore > r.awayScore ? teamA : teamB;
    const loser = r.homeScore > r.awayScore ? teamB : teamA;

    existing.push({
      id: Date.now() + added,
      round: r.round,
      date, teamA, teamB,
      scoreA: r.homeScore, scoreB: r.awayScore,
      winner, loser,
      source: SOURCE_URL,
      auto: true
    });
    existingKeys.add(key); // 同一実行内での重複追加を防ぐ
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
