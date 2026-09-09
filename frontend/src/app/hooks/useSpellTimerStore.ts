/**
 * サモナースペルタイマーのグローバルストア(localStorage永続)
 *
 * レーン×陣営(自/敵)ごとに「コズミックインサイト/イオニアブーツ装備の有無」と
 * 「スペルごとの終了時刻」を持つ。ページを再読み込みしてもタイマーが消えないよう
 * 終了時刻(epoch ms)そのものを保存する(残り秒数の保存だと再読み込みでズレる)。
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lol-db:spell-timer';

export type RowMode = 'both' | 'enemy';
export type Side = 'ally' | 'enemy';
export type Lane = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export const LANES: Lane[] = ['top', 'jungle', 'mid', 'adc', 'support'];
export const LANE_LABELS: Record<Lane, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

export interface RowState {
  cosmicInsight: boolean;
  ionianBoots: boolean;
  timers: Record<string, number>; // spellId -> 終了時刻(epoch ms)
}

interface StoreState {
  mode: RowMode;
  rows: Record<string, RowState>; // key: `${side}:${lane}`
}

function emptyRow(): RowState {
  return { cosmicInsight: false, ionianBoots: false, timers: {} };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: 'enemy', rows: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { mode: 'enemy', rows: {} };
    return {
      mode: parsed.mode === 'both' ? 'both' : 'enemy',
      rows: parsed.rows && typeof parsed.rows === 'object' ? parsed.rows : {},
    };
  } catch {
    return { mode: 'enemy', rows: {} };
  }
}

let state: StoreState = load();
const listeners = new Set<() => void>();

function commit(next: StoreState): void {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存失敗時もメモリ上では動作継続
  }
  listeners.forEach(l => l());
}

export function rowKey(side: Side, lane: Lane): string {
  return `${side}:${lane}`;
}

function getRow(key: string): RowState {
  return state.rows[key] ?? emptyRow();
}

export function setMode(mode: RowMode): void {
  if (state.mode === mode) return;
  commit({ ...state, mode });
}

export function toggleCosmicInsight(key: string): void {
  const row = getRow(key);
  commit({ ...state, rows: { ...state.rows, [key]: { ...row, cosmicInsight: !row.cosmicInsight } } });
}

export function toggleIonianBoots(key: string): void {
  const row = getRow(key);
  commit({ ...state, rows: { ...state.rows, [key]: { ...row, ionianBoots: !row.ionianBoots } } });
}

export function startTimer(key: string, spellId: string, durationMs: number): void {
  const row = getRow(key);
  commit({
    ...state,
    rows: { ...state.rows, [key]: { ...row, timers: { ...row.timers, [spellId]: Date.now() + durationMs } } },
  });
}

export function clearTimer(key: string, spellId: string): void {
  const row = getRow(key);
  if (!(spellId in row.timers)) return;
  const timers = { ...row.timers };
  delete timers[spellId];
  commit({ ...state, rows: { ...state.rows, [key]: { ...row, timers } } });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ストア全体(モード + 全行)を購読する */
export function useSpellTimerStore(): StoreState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 1行分の状態だけを取り出すヘルパー(ストア全体の購読を内部で使う) */
export function useSpellTimerRow(key: string): RowState {
  return useSpellTimerStore().rows[key] ?? emptyRow();
}
