import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSummonerSpells, type SummonerSpellInfo } from '../hooks/useSummonerSpells';
import {
  LANES, LANE_LABELS, rowKey,
  useSpellTimerStore, useSpellTimerRow,
  setMode, toggleCosmicInsight, toggleIonianBoots, startTimer, clearTimer,
  type Lane, type Side,
} from '../hooks/useSpellTimerStore';
import { effectiveCooldownMs, formatCountdown } from '../utils/spellTimer';
import {
  isNotificationSupported, requestNotificationPermission, notifySpellReady, playBeep,
} from '../utils/spellTimerNotify';

export function SpellTimer() {
  useDocumentTitle('サモナースペルタイマー | nunune');
  const { spells, loading } = useSummonerSpells();
  const { mode, rows } = useSpellTimerStore();
  const [now, setNow] = useState(() => Date.now());
  const [permission, setPermission] = useState<NotificationPermission>(
    isNotificationSupported() ? Notification.permission : 'denied',
  );
  // 同じ終了時刻に対して通知を二重に鳴らさないための既発火セット
  const notifiedRef = useRef<Set<string>>(new Set());

  // アクティブなタイマーの残り秒数表示を250ms間隔で更新する
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // 期限切れタイマーを検知したら通知 + ビープを1回だけ発火する
  useEffect(() => {
    for (const [key, row] of Object.entries(rows)) {
      for (const [spellId, endAt] of Object.entries(row.timers)) {
        const notifyKey = `${key}:${spellId}:${endAt}`;
        if (endAt <= now && !notifiedRef.current.has(notifyKey)) {
          notifiedRef.current.add(notifyKey);
          const spell = spells.find(s => s.id === spellId);
          const [side, lane] = key.split(':') as [Side, Lane];
          const who = side === 'enemy' ? '敵' : '味方';
          notifySpellReady(
            `${spell?.name ?? 'スペル'} CT終了`,
            `${who} ${LANE_LABELS[lane]} の${spell?.name ?? 'スペル'}が使用可能になったにゃん`,
          );
          playBeep();
        }
      }
    }
  }, [now, rows, spells]);

  const laneRows = useMemo(() => {
    const sides: Side[] = mode === 'both' ? ['enemy', 'ally'] : ['enemy'];
    return sides.flatMap(side => LANES.map(lane => ({ side, lane, key: rowKey(side, lane) })));
  }, [mode]);

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission();
    setPermission(result);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-4xl h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-black text-xl text-primary tracking-wide">
            nunu<span className="text-hextech">ne</span>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">サモナースペルタイマー</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          レーンの横のアイコンをタップすると、そのスペルのクールダウンタイマーが始まるにゃん。
          コズミックインサイト／イオニアブーツを持ってる相手には対応するトグルをONにすると
          短縮後の時間で計算するにょ。タイマー中のアイコンを右クリック(長押し)するとリセットできる。
          ※ ゲーム内の情報を読み取ったり自動操作したりはしない、完全手動の自己申告タイマーだよ。
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMode('enemy')}
              className={`px-3 py-1.5 transition-colors ${
                mode === 'enemy' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              敵5人のみ
            </button>
            <button
              type="button"
              onClick={() => setMode('both')}
              className={`px-3 py-1.5 transition-colors ${
                mode === 'both' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              10人フル
            </button>
          </div>

          {isNotificationSupported() && permission !== 'granted' && (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-muted-foreground
                hover:text-primary hover:border-primary/40 transition-colors"
            >
              🔔 CT終了をブラウザ通知で受け取る
            </button>
          )}
          {permission === 'granted' && <span className="text-xs text-hextech">🔔 通知ON</span>}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : (
          <div className="space-y-2">
            {laneRows.map(({ side, lane, key }) => (
              <SpellRow
                key={key}
                side={side}
                lane={lane}
                rowKey={key}
                spells={spells}
                now={now}
                showSide={mode === 'both'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SpellRowProps {
  side: Side;
  lane: Lane;
  rowKey: string;
  spells: SummonerSpellInfo[];
  now: number;
  showSide: boolean;
}

function SpellRow({ side, lane, rowKey: key, spells, now, showSide }: SpellRowProps) {
  const row = useSpellTimerRow(key);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md flex-wrap">
      <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
        {showSide && (
          <span
            aria-hidden
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${side === 'enemy' ? 'bg-destructive' : 'bg-hextech'}`}
          />
        )}
        <span className="text-xs font-semibold text-foreground tabular-nums">{LANE_LABELS[lane]}</span>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <ToggleChip label="コズミック" active={row.cosmicInsight} onClick={() => toggleCosmicInsight(key)} />
        <ToggleChip label="イオニア靴" active={row.ionianBoots} onClick={() => toggleIonianBoots(key)} />
      </div>

      <div className="flex gap-1.5 flex-1 flex-wrap">
        {spells.map(spell => {
          const endAt = row.timers[spell.id];
          const remainingMs = endAt ? endAt - now : 0;
          const active = remainingMs > 0;

          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => {
                const durationMs = effectiveCooldownMs(spell.cooldown, row.cosmicInsight, row.ionianBoots);
                startTimer(key, spell.id, durationMs);
              }}
              onContextMenu={e => {
                e.preventDefault();
                clearTimer(key, spell.id);
              }}
              title={`${spell.name}${active ? '(右クリックでリセット)' : ''}`}
              className={`relative w-9 h-9 flex-shrink-0 rounded-sm overflow-hidden border transition-colors
                ${active ? 'border-primary' : 'border-border hover:border-primary/40'}`}
            >
              <img
                src={spell.icon}
                alt={spell.name}
                className={`w-full h-full object-cover transition-opacity ${active ? 'opacity-30' : 'opacity-100'}`}
                loading="lazy"
              />
              {active && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold
                  text-primary tabular-nums bg-background/40">
                  {formatCountdown(remainingMs)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-1 text-[10px] rounded-sm border transition-colors whitespace-nowrap
        ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}
    >
      {label}
    </button>
  );
}
