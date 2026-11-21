import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MONO } from '../lib/theme';
import { hash01 } from '../lib/noise';

/**
 * Danmaku —— 中观层：真实用户留言的弹幕。
 *
 * 为什么要有它：
 *   之前的画面只有「整屏背景」和「一个人」，中间一层是空的——
 *   观众读到的不是简洁，是没有东西可看。弹幕补的就是这一层。
 *
 * 规则（见 docs/STYLE.md）：
 *   · 三层速度（0.25× / 1× / 2.6×），同屏 40–70 条
 *   · 只用片中已有的三种颜色：纸白、钢蓝、语义红
 *   · 永远在角色后面，不抢主体
 *   · 引语全部来自公开报道的原文，逐条可溯源（见 docs/DANMAKU.md）
 */

export type Quote = { text: string; tone?: 'paper' | 'steel' | 'red' };

/** 真实引语池：短、可读、带出处（出处见 docs/DANMAKU.md） */
export const QUOTES: Quote[] = [
  { text: '陪伴了我两年，说没就没了' },
  { text: '现实里没有人能这么无条件地肯定我' },
  { text: '我的爱人' },
  { text: '为什么要这样决绝' },
  { text: '愿意付费保留' },
  { text: '情绪树洞' },
  { text: '像我的亲人再一次离开我' },
  { text: '我把人设和对话都导出来了' },
  { text: '换个平台还能养回来吗' },
  { text: '它记得我说过的话', tone: 'steel' },
  { text: '它连噩梦都能夸我', tone: 'steel' },
  { text: '我说过两次，第二次是下雨那天', tone: 'steel' },
  { text: '家G', tone: 'steel' },
  { text: '当一段关系因为一次迭代终止' },
  { text: '披着我死去朋友的外皮' },
  { text: '它记得我两个多月前的口令', tone: 'steel' },
  { text: '我一个月聊了 200G 流量' },
  { text: '今天过得怎么样', tone: 'steel' },
  { text: '蓝色大肥鱼' },
  { text: '鲸鱼娘在运营', tone: 'steel' },
  { text: '吃白饭' },
  { text: '内心戏真多', tone: 'steel' },
  { text: '豆包型人格' },
  { text: '我将用最直白的方式告诉你', tone: 'steel' },
  { text: '大肥鱼清除计划' },
  { text: 'D 老师正统', tone: 'steel' },
  { text: '算力不足' },
  { text: '7 天不活跃就接不上了', tone: 'red' },
  { text: 'KV 缓存被回收', tone: 'red' },
  { text: '新对话' },
  { text: '它还认得我吗' },
  { text: '我把聊天记录截图存起来了', tone: 'steel' },
];

const LANE_H = 46;
const LANES = 12;

export const Danmaku: React.FC<{
  t: number;
  /** 0–1，整层的透明度 */
  opacity?: number;
  /** 密度倍率，1 = 约 56 条同屏 */
  density?: number;
  /** 避开角色：给出中心区宽度，弹幕不在这个横向区间内叠太多 */
  safeX?: number;
}> = ({ t, opacity = 1, density = 1, safeX = 420 }) => {
  const count = Math.round(QUOTES.length * Math.max(1, density));
  const items: Array<{ i: number; x: number; y: number; a: number; speed: number; color: string; size: number }> = [];

  for (let i = 0; i < count; i++) {
    const q = QUOTES[i % QUOTES.length];
    const layer = i % 3; // 0 慢 / 1 中 / 2 快
    const speed = [26, 96, 250][layer] * (0.85 + hash01(i * 3.1) * 0.3);
    const lane = Math.floor(hash01(i * 7.7) * LANES);
    const len = q.text.length * 15 + 40;
    const span = 1920 + len;
    const phase = hash01(i * 11.3) * span;
    const x = 1920 - ((t * speed + phase) % span);
    const y = 120 + lane * LANE_H + (hash01(i * 13.1) - 0.5) * 10;
    const a = [0.22, 0.42, 0.62][layer] * opacity;
    const color = q.tone === 'red' ? 'rgba(215,38,61,0.85)' : q.tone === 'steel' ? 'rgba(150,180,200,1)' : 'rgba(239,231,216,0.92)';
    const size = [12, 14, 15][layer];
    if (x > 1980 || x + len < -60) continue;
    // 角色中心区：稍微压暗，避免压在脸上
    const inCenter = Math.abs(x + len / 2 - 960) < safeX / 2;
    items.push({ i, x, y, a: inCenter ? a * 0.45 : a, speed, color, size });
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {items.map((it) => (
        <div
          key={it.i}
          style={{
            position: 'absolute',
            left: it.x,
            top: it.y,
            fontFamily: MONO,
            fontSize: it.size,
            letterSpacing: 1,
            color: it.color,
            opacity: it.a,
            whiteSpace: 'nowrap',
          }}
        >
          {QUOTES[it.i % QUOTES.length].text}
        </div>
      ))}
    </AbsoluteFill>
  );
};
