import { supabase } from './supabase';

/**
 * 跨裝置同步層。
 *
 * 角色分工刻意做成不對稱：
 *  - 考生端（筆電，已登入）是唯一權威，也是唯一會寫資料庫的人。
 *  - 手機門前貼紙端與陪練考官端不碰資料庫，只加入 broadcast 頻道。
 * 這讓 RLS 可以簡化成 owner_id = auth.uid()，不必為了讓陪練者評分而在
 * 資料表上開任何匿名讀寫的破口。
 */

export const EVENTS = {
  /** 主控 → 全體：完整場次狀態 */
  STATE: 'state',
  /** 主控 → 全體：某張提示卡已揭露，請顯示 */
  CUE_SHOW: 'cue-show',
  /** 主控 → 全體：關閉提示卡 */
  CUE_HIDE: 'cue-hide',
  /** 考官 → 主控：推送某張提示卡 */
  CUE_PUSH: 'cue-push',
  /** 考官 → 主控：送出評分 */
  SCORE: 'score',
  /** 客戶端 → 主控：我剛加入，請補一份現況給我 */
  HELLO: 'hello',
};

export function channelName(joinCode) {
  return `osce-${joinCode}`;
}

/**
 * 房間碼刻意不用 6 位數字：頻道只靠這組碼保護，
 * 6 位數字的猜測空間太小。這裡用 8 碼大寫英數，且排除易混淆字元。
 */
export function generateJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function joinChannel(joinCode, handlers = {}) {
  const channel = supabase.channel(channelName(joinCode), {
    config: { broadcast: { self: false } },
  });

  Object.entries(handlers).forEach(([event, handler]) => {
    channel.on('broadcast', { event }, ({ payload }) => handler(payload));
  });

  return channel;
}

export function send(channel, event, payload) {
  if (!channel) return;
  channel.send({ type: 'broadcast', event, payload });
}
