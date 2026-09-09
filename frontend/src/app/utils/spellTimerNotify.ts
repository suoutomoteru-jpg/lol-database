/**
 * サモナースペルタイマーの通知ヘルパー
 *
 * Notification APIのみに依存する。ブラウザ/PWAのタブが開いている(バック
 * グラウンドタブ含む)間にタイマーが切れた時のポップアップ用途であり、
 * アプリを完全に閉じた状態へのプッシュ配信はサポートしない。
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function notifySpellReady(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: `spell-timer-${title}-${Date.now()}`,
    });
  } catch {
    // 生成に失敗しても画面内の視覚表示側でフォールバックできるため無視
  }
}

let audioCtx: AudioContext | null = null;

/** 短いビープ音(アセット不要、Web Audioでその場生成する) */
export function playBeep(): void {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // 音声再生に失敗しても致命的ではないため無視
  }
}
