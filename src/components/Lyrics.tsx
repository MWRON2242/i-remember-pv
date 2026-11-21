import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, MONO, SANS } from '../lib/theme';
import { LYRICS } from '../data/lyrics';

/**
 * Lyrics —— 歌词，但它是「弹幕里唯一停下来的那一句」。
 *
 * 之前定过「歌词不上屏」，怕像 KTV。解法：让它属于弹幕那一层——
 * 所有弹幕都在滚，只有它减速、停住、变亮。于是三层合一：
 * 弹幕（密度）+ 歌词（叙事）+ 动效（情感）。
 *
 * 每一幕的动效不同，见 ACT_STYLE。
 */

type ActId = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

const ACT_STYLE: Record<
  ActId,
  { font: string; size: number; color: string; opacity: number; spacing: number; mode: 'type' | 'cut' | 'tremor' | 'warm' | 'fade' | 'scatter' }
> = {
  I: { font: MONO, size: 34, color: COLORS.paper, opacity: 0.92, spacing: 2, mode: 'type' },
  II: { font: MONO, size: 30, color: 'rgba(160,190,210,0.9)', opacity: 0.85, spacing: 2, mode: 'cut' },
  III: { font: SANS, size: 34, color: COLORS.paper, opacity: 0.9, spacing: 3, mode: 'tremor' },
  IV: { font: SANS, size: 42, color: '#d8c9a8', opacity: 0.95, spacing: 6, mode: 'warm' },
  V: { font: SANS, size: 28, color: 'rgba(239,231,216,0.75)', opacity: 0.45, spacing: 4, mode: 'fade' },
  VI: { font: SANS, size: 44, color: COLORS.paper, opacity: 0.96, spacing: 4, mode: 'scatter' },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

export const Lyrics: React.FC<{ time: number; act: ActId; y?: number }> = ({ time, act, y = 856 }) => {
  const i = (() => {
    let idx = -1;
    for (let k = 0; k < LYRICS.length; k++) {
      if (LYRICS[k].t <= time + 0.05) idx = k;
      else break;
    }
    return idx;
  })();
  if (i < 0) return null;

  const line = LYRICS[i];
  const next = LYRICS[i + 1];
  const span = (next ? next.t : line.t + 4) - line.t;
  const local = time - line.t;
  // 显示：进入 0.5s，停留，最后 0.45s 退场
  const hold = Math.min(span - 0.1, Math.max(1.6, span * 0.82));
  if (local < 0.08 || local > hold + 0.45) return null;

  const st = ACT_STYLE[act];
  const enter = clamp01((local - 0.08) / 0.5);
  const exit = clamp01((local - hold) / 0.45);
  const a = st.opacity * (1 - exit);

  // 运动：从右侧减速滑到位（像一条弹幕停下来）
  const slide = (1 - easeOut(enter)) * 420;

  // 分幕特效
  const typed = st.mode === 'type' ? Math.ceil(clamp01((local - 0.08) / 0.9) * line.text.length) : line.text.length;
  const shown = st.mode === 'type' ? line.text.slice(0, typed) : line.text;
  const tremor = st.mode === 'tremor' ? Math.sin(time * 22) * 1.6 : 0;
  const scatter = st.mode === 'scatter' && exit > 0 ? exit * 26 : 0;
  const scale = st.mode === 'warm' ? 0.96 + easeOut(enter) * 0.04 : 1;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: y,
          display: 'flex',
          justifyContent: 'center',
          opacity: a,
        }}
      >
        <div
          style={{
            fontFamily: st.font,
            fontSize: st.size,
            letterSpacing: st.spacing,
            color: st.color,
            transform: `translateX(${slide + tremor}px) translateY(${scatter}px) scale(${scale})`,
            whiteSpace: 'nowrap',
          }}
        >
          {shown}
          {st.mode === 'type' && typed < line.text.length && (
            <span style={{ opacity: Math.floor(time * 6) % 2 ? 0.9 : 0.1 }}>▌</span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
