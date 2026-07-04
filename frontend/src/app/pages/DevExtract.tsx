import { useState } from 'react';
import { getLatestVersion, fetchChampionList, fetchChampionDetail } from '../api/dataDragon';
import { fetchSpellWikitext, extractResolvedDescriptions } from '../api/lolWiki';

/**
 * 開発用ツール: 全チャンピオンの英語wiki説明文を一括取得し、JSONとして出力する。
 * 出力データを人手（Claude）で翻訳し、静的な埋め込みデータとして使う想定。
 * パッチが上がるたびにこのページで再抽出する。
 */

interface ExtractedSkill {
  key: string;
  name: string;
  en: string;
}

interface ExtractedChampion {
  id: string;
  name: string;
  skills: ExtractedSkill[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export function DevExtract() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ExtractedChampion[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const v = await getLatestVersion();
      const champs = await fetchChampionList(v);
      const ids = Object.keys(champs);
      setProgress({ done: 0, total: ids.length });

      let done = 0;
      const out = await mapWithConcurrency(ids, 4, async (id): Promise<ExtractedChampion> => {
        try {
          const detail = await fetchChampionDetail(v, id);
          const skillDefs = [
            { key: 'Passive', name: detail.passive.name, maxrank: 1 },
            { key: 'Q', name: detail.spells[0].name, maxrank: detail.spells[0].maxrank },
            { key: 'W', name: detail.spells[1].name, maxrank: detail.spells[1].maxrank },
            { key: 'E', name: detail.spells[2].name, maxrank: detail.spells[2].maxrank },
            { key: 'R', name: detail.spells[3].name, maxrank: detail.spells[3].maxrank },
          ];

          const skills: ExtractedSkill[] = [];
          for (const def of skillDefs) {
            const wikitext = await fetchSpellWikitext(id, def.key, def.name);
            const en = wikitext ? extractResolvedDescriptions(wikitext, def.maxrank) : '';
            skills.push({ key: def.key, name: def.name, en });
          }

          done++;
          setProgress({ done, total: ids.length });
          return { id, name: detail.name, skills };
        } catch {
          done++;
          setProgress({ done, total: ids.length });
          return { id, name: id, skills: [] };
        }
      });

      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const json = result ? JSON.stringify(result, null, 2) : '';

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wiki-tooltips-en.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: '#eee', background: '#111', minHeight: '100vh' }}>
      <h1>Wiki Tooltip 抽出ツール（開発用）</h1>
      <p>全チャンピオンの英語wiki説明文（解決済み）を取得します。数分かかります。</p>

      <button onClick={run} disabled={running} style={{ padding: '8px 16px', marginRight: 8 }}>
        {running ? '実行中…' : '抽出開始'}
      </button>

      {progress && <p>{progress.done} / {progress.total} 完了</p>}
      {error && <p style={{ color: 'tomato' }}>エラー: {error}</p>}

      {result && (
        <>
          <div style={{ margin: '12px 0' }}>
            <button onClick={() => navigator.clipboard.writeText(json)} style={{ padding: '8px 16px', marginRight: 8 }}>
              クリップボードにコピー
            </button>
            <button onClick={download} style={{ padding: '8px 16px' }}>
              JSONダウンロード
            </button>
            <span style={{ marginLeft: 12, color: '#888' }}>{Math.round(json.length / 1024)} KB</span>
          </div>
          <textarea
            readOnly
            value={json}
            style={{ width: '100%', height: '60vh', background: '#000', color: '#0f0', fontSize: 12 }}
          />
        </>
      )}
    </div>
  );
}
