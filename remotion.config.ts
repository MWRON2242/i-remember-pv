import { Config } from '@remotion/cli/config';

// 渲染成片时覆盖已有文件，不弹确认
Config.setOverwriteOutput(true);

// 中间帧用 jpeg，渲染更快；无损母版在命令行另加 --image-format=png
Config.setVideoImageFormat('jpeg');

// 12 核机器：留一半给系统，避免渲染时整机卡死
Config.setConcurrency(8);
