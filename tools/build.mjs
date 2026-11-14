/* ============================================================================
 * build.mjs — 一条命令跑完的流水线
 * ----------------------------------------------------------------------------
 *   node tools/build.mjs check        自检：数据文件之间是否自洽
 *   node tools/build.mjs beats        自动节拍检测 → input/song.beats.json
 *   node tools/build.mjs lyrics       input/lyrics.lrc → input/lyrics.json
 *   node tools/build.mjs fonts        下载网页字体到 public/fonts（首次或换字体时跑）
 *   node tools/build.mjs assets       资产体检（Codex 的图进来就跑一下）
 *   node tools/build.mjs skeleton     渲染工程自检片（PipelineTest）→ out/skeleton.mp4
 *   node tools/build.mjs delivery     渲染交付版 → out/pv.mp4
 *   node tools/build.mjs sheet        抽帧联系表 → out/sheet.html
 *   node tools/build.mjs verify       音画同步验收（对成片音轨重做检测并比对）
 *   node tools/build.mjs master       无损母版 → out/pv-master.mov（ProRes 4444）
 *   node tools/build.mjs master-lite  轻量母版 → out/pv-master-lite.mp4（h264 crf 1）
 *   node tools/build.mjs 4k           从交付版放大 → out/pv_4k.mp4
 *   node tools/build.mjs all          check → delivery → verify → sheet
 *
 * 两个必须知道的约定：
 *   1. 临时目录固定在项目内 .tmp-render/，不写系统 TEMP —— 清理与沙箱都省事。
 *   2. 渲染前用 safeOutput() 探一次占用：Windows 上目标文件被播放器/GUI 打开时，
 *      Remotion 最后一步 rename 会 EPERM，整场渲染白跑（旧项目踩过一次）。
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const OUT = path.join(PROJ, 'out');
const INPUT = path.join(PROJ, 'input');
const PUBLIC = path.join(PROJ, 'public');
const TMP = path.join(PROJ, '.tmp-render');

const CLI = path.join(PROJ, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const FFMPEG = findFfmpeg();

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const ENV = { ...process.env, TEMP: TMP, TMP };

/* ------------------------------------------------------------------ 小工具 */
function findFfmpeg() {
  const base = path.join(PROJ, 'node_modules', '@remotion');
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    if (!d.startsWith('compositor')) continue;
    const p = path.join(base, d, 'ffmpeg.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function run(cmd, args, label) {
  process.stdout.write(`\n▶ ${label || cmd + ' ' + args.join(' ')}\n`);
  const t0 = Date.now();
  try {
    execFileSync(cmd, args, { cwd: PROJ, env: ENV, stdio: 'inherit' });
  } catch {
    console.error(`\n✘ 失败：${label || cmd}`);
    process.exit(1);
  }
  console.log(`✔ 完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
}

function remotion(args) {
  run(process.execPath, [CLI, ...args]);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);
const rel = (p) => path.relative(PROJ, p).replace(/\\/g, '/');

function audioDuration(file) {
  if (!FFMPEG || !exists(file)) return null;
  try {
    const out = execFileSync(FFMPEG, ['-hide_banner', '-i', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseDur(out);
  } catch (e) {
    return parseDur(String(e.stderr || '')); // ffmpeg 把信息写 stderr 并以非 0 退出，属正常
  }
}

function parseDur(text) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * 挑一个能写的输出路径。Remotion 渲染完会 rename 到目标名，
 * 目标被占用时 rename 会 EPERM —— 所以先自己试着重命名一次探锁。
 */
function safeOutput(preferred) {
  if (!exists(preferred)) return preferred;
  const probe = preferred + '.lockprobe';
  try {
    fs.rmSync(probe, { force: true });
    fs.renameSync(preferred, probe);
    fs.renameSync(probe, preferred);
    return preferred;
  } catch {
    try {
      if (exists(probe)) fs.renameSync(probe, preferred);
    } catch {
      /* 改不回来就走换名分支 */
    }
    const m = /^(.*?)(-\d+)?(\.[^.]+)$/.exec(preferred);
    const stem = m ? m[1] : preferred;
    const ext = m ? m[3] : '';
    let i = 2;
    let alt = `${stem}-${i}${ext}`;
    while (exists(alt)) alt = `${stem}-${++i}${ext}`;
    console.log(`⚠ ${path.basename(preferred)} 被其他进程占用，本次改写到 ${path.basename(alt)}`);
    return alt;
  }
}

function beatsData() {
  const p = path.join(INPUT, 'song.beats.json');
  return exists(p) ? readJson(p) : null;
}

/* -------------------------------------------------------------------- check */
function check() {
  console.log('\n自检开始 ——\n');
  const problems = [];
  const warnings = [];

  const filmPath = path.join(INPUT, 'film.json');
  const F = exists(filmPath) ? readJson(filmPath) : null;
  if (!F) problems.push('缺 input/film.json');

  /* 音源 */
  let audioDur = null;
  if (F) {
    const audioPath = path.join(PUBLIC, F.audio);
    if (!exists(audioPath)) {
      problems.push(`缺音频 public/${F.audio}（Remotion 的 staticFile 只认 public/）`);
    } else {
      audioDur = audioDuration(audioPath);
      console.log(`  音源       public/${F.audio}${audioDur ? ` · ${audioDur.toFixed(2)} 秒` : ''}`);
    }
  }

  /* 打点表 */
  const B = beatsData();
  if (!B) {
    problems.push('缺 input/song.beats.json —— 先跑 node tools/build.mjs beats input/song.mp3');
  } else {
    console.log(
      `  打点       ${B.beats.length} 拍 · ${Number(B.bpm).toFixed(2)} BPM · ${B.duration.toFixed(2)} 秒`
    );
    if (audioDur && Math.abs(audioDur - B.duration) > 0.15) {
      warnings.push(
        `音源实际 ${audioDur.toFixed(2)} 秒 与打点表 ${B.duration.toFixed(2)} 秒 差 ${Math.abs(audioDur - B.duration).toFixed(2)} 秒 —— 是否换了歌没重打点？`
      );
    }
  }

  /* 歌词时间轴 */
  const lyricPath = path.join(INPUT, 'lyrics.json');
  if (!exists(lyricPath)) {
    problems.push('缺 input/lyrics.json —— 先跑 node tools/build.mjs lyrics');
  } else {
    const L = readJson(lyricPath);
    console.log(
      `  歌词       ${L.count} 句 · 首句 ${L.firstVocalAt}s · 末句 ${L.lastVocalAt}s · 无人声区间 ${L.gaps.length} 段`
    );
    if (B && L.lastVocalAt > B.duration + 0.01) {
      problems.push(`末句歌词 ${L.lastVocalAt}s 超出音源 ${B.duration.toFixed(2)}s —— LRC 与音源不是同一版本？`);
    }
    if (!L.count) problems.push('lyrics.json 里没有歌词行');
  }

  /* 字体 */
  const fontsCss = path.join(PUBLIC, 'fonts', 'fonts.css');
  if (!exists(fontsCss)) {
    problems.push('缺 public/fonts/fonts.css —— 先跑 node tools/build.mjs fonts');
  } else {
    const woff = fs
      .readdirSync(path.join(PUBLIC, 'fonts', 'noto-sans-sc'), { withFileTypes: true })
      .filter((d) => d.isFile()).length;
    console.log(`  字体       fonts.css + Noto Sans SC ${woff} 个分片 + JetBrains Mono`);
  }

  /* 资产 */
  const assetsRoot = path.join(PUBLIC, 'assets');
  const assetFiles = exists(assetsRoot)
    ? fs.readdirSync(assetsRoot, { recursive: true }).filter((f) => /\.(png|jpe?g|webp)$/i.test(String(f)))
    : [];
  if (!assetFiles.length) {
    warnings.push('public/assets 还没有图（分镜未定，正常）—— 图进来后跑 node tools/build.mjs assets');
  } else {
    console.log(`  资产       ${assetFiles.length} 个文件（详查跑 node tools/build.mjs assets）`);
  }

  /* 分镜表（还没定稿，存在才校验） */
  const timelinePath = path.join(INPUT, 'timeline.json');
  if (!exists(timelinePath)) {
    warnings.push('input/timeline.json 还没建 —— 分镜定稿后再建，正片当前是占位画面');
  } else {
    const T = readJson(timelinePath);
    const scenes = T.scenes ?? [];
    if (B && scenes.length) {
      const sorted = [...scenes].sort((a, b) => a.from - b.from);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].from > sorted[i - 1].to + 0.01) {
          warnings.push(
            `分镜有空洞：${sorted[i - 1].id} 结束于 ${sorted[i - 1].to}，${sorted[i].id} 从 ${sorted[i].from} 才开始`
          );
        }
      }
      for (const s of scenes) {
        if (typeof s.from !== 'number' || typeof s.to !== 'number') problems.push(`scenes(${s.id}) 缺 from/to`);
        else if (s.from >= s.to) problems.push(`scenes(${s.id}) 的 from 不小于 to`);
      }
      console.log(`  分镜       ${scenes.length} 段`);
    } else {
      console.log('  分镜       0 段（待定稿）');
    }
  }

  /* 入口文件 */
  for (const f of ['src/index.ts', 'src/Root.tsx', 'src/lib/song.ts']) {
    if (!exists(path.join(PROJ, f))) problems.push(`缺 ${f}`);
  }

  if (warnings.length) {
    console.log('');
    warnings.forEach((w) => console.log('  ⚠ ' + w));
  }
  if (problems.length) {
    console.log('');
    problems.forEach((p) => console.log('  ✗ ' + p));
    console.log('\n自检未通过。\n');
    process.exit(1);
  }
  console.log('\n✔ 自检通过' + (warnings.length ? `（${warnings.length} 条提醒）` : '') + '\n');
}

/* ------------------------------------------------------------------- 各步骤 */
function doBeats() {
  const arg = process.argv[3] || path.join(INPUT, 'song.mp3');
  if (!exists(path.resolve(PROJ, arg))) {
    console.error(`✘ 找不到音频 ${arg}`);
    process.exit(1);
  }
  run(process.execPath, [path.join(HERE, 'auto-beats.mjs'), arg], '自动节拍检测');
  const base = path.basename(arg).replace(/\.[^.]+$/, '');
  const produced = path.join(INPUT, base + '.beats.json');
  const target = path.join(INPUT, 'song.beats.json');
  if (exists(produced) && produced !== target) {
    fs.copyFileSync(produced, target);
    console.log(`\n已固化为 ${rel(target)}（src/lib/song.ts 读的就是这个固定文件名）`);
  }
}

function doLyrics() {
  run(process.execPath, [path.join(HERE, 'parse-lrc.mjs')], '解析 LRC 时间轴');
}

function doFonts() {
  run(process.execPath, [path.join(HERE, 'fetch-fonts.mjs')], '下载网页字体');
}

function doAssets() {
  run(process.execPath, [path.join(HERE, 'check-assets.mjs'), ...process.argv.slice(3)], '资产体检');
}

function doSkeleton() {
  const target = safeOutput(path.join(OUT, 'skeleton.mp4'));
  remotion(['render', 'PipelineTest', target, '--frames=0-359', '--log=error']);
  console.log(`\n自检片：${rel(target)}（12 秒 / 1080p30）`);
}

function delivery() {
  remotion(['render', 'MainFilm', safeOutput(path.join(OUT, 'pv.mp4')), '--log=error']);
}

function master() {
  remotion([
    'render',
    'MainFilm',
    safeOutput(path.join(OUT, 'pv-master.mov')),
    '--codec=prores',
    '--prores-profile=4444',
    '--image-format=png',
    '--log=error',
  ]);
}

function masterLite() {
  remotion(['render', 'MainFilm', safeOutput(path.join(OUT, 'pv-master-lite.mp4')), '--crf=1', '--log=error']);
}

function sheet() {
  run(process.execPath, [path.join(HERE, 'contact-sheet.mjs'), ...process.argv.slice(3)], '生成联系表');
}

function verify() {
  run(process.execPath, [path.join(HERE, 'verify-sync.mjs'), ...process.argv.slice(3)], '音画同步验收');
}

function fourK() {
  if (!FFMPEG) {
    console.error('✘ 找不到 Remotion 自带的 ffmpeg');
    process.exit(1);
  }
  const src = path.join(OUT, 'pv.mp4');
  if (!exists(src)) {
    console.error('✘ 先跑 delivery 生成 out/pv.mp4');
    process.exit(1);
  }
  run(
    FFMPEG,
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', src,
      '-vf', 'scale=3840:2160:flags=lanczos',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast',
      '-c:a', 'copy', path.join(OUT, 'pv_4k.mp4'),
    ],
    '4K 放大（lanczos）'
  );
}

/* -------------------------------------------------------------------- 入口 */
const step = (process.argv[2] || 'all').toLowerCase();

if (!exists(CLI) && !['check', 'lyrics', 'fonts', 'assets'].includes(step)) {
  console.error('✘ 依赖没装：node_modules/@remotion/cli 不存在');
  process.exit(1);
}

switch (step) {
  case 'check':
    check();
    break;
  case 'beats':
    doBeats();
    break;
  case 'lyrics':
    doLyrics();
    break;
  case 'fonts':
    doFonts();
    break;
  case 'assets':
    doAssets();
    break;
  case 'skeleton':
    doSkeleton();
    break;
  case 'delivery':
    delivery();
    break;
  case 'sheet':
    sheet();
    break;
  case 'verify':
    verify();
    break;
  case 'master':
    master();
    break;
  case 'master-lite':
    masterLite();
    break;
  case '4k':
    fourK();
    break;
  case 'all':
    check();
    delivery();
    verify();
    sheet();
    break;
  default:
    console.error(
      `✘ 未知步骤 "${step}"，可用：check / beats / lyrics / fonts / assets / skeleton / delivery / sheet / verify / master / master-lite / 4k / all`
    );
    process.exit(1);
}
