/**
 * 吸附计算工具
 */

import { Item, Track } from '../../../types';
import { timeline } from '../styles';

export interface SnapTarget {
  frame: number;
  type: 'item-start' | 'item-end' | 'playhead' | 'track-start' | 'grid';
  label?: string;
}

export interface SnapResult {
  snappedFrame: number;
  target: SnapTarget | null;
  didSnap: boolean;
}

/**
 * 计算吸附位置
 * @param frame 当前帧位置
 * @param tracks 所有轨道
 * @param currentItemId 当前拖拽的素材项 ID（排除自己）
 * @param playheadFrame 播放头位置
 * @param snapEnabled 是否启用吸附
 * @param threshold 吸附阈值（帧数）
 * @returns 吸附结果
 */
export function calculateSnap(
  frame: number,
  tracks: Track[],
  currentItemId: string | null,
  playheadFrame: number,
  snapEnabled: boolean = true,
  threshold: number = timeline.snapThreshold
): SnapResult {
  if (!snapEnabled) {
    return {
      snappedFrame: frame,
      target: null,
      didSnap: false,
    };
  }

  const snapTargets: SnapTarget[] = [];

  // 1. 轨道起点（帧 0）
  snapTargets.push({
    frame: 0,
    type: 'track-start',
    label: '轨道起点',
  });

  // 2. 播放头位置
  snapTargets.push({
    frame: playheadFrame,
    type: 'playhead',
    label: '播放头',
  });

  // 3. 其他素材的起点和终点
  tracks.forEach((track) => {
    track.items.forEach((item) => {
      // 排除当前拖拽的素材
      if (item.id === currentItemId) return;

      // 素材起点
      snapTargets.push({
        frame: item.from,
        type: 'item-start',
        label: `${item.type} 起点`,
      });

      // 素材终点
      snapTargets.push({
        frame: item.from + item.durationInFrames,
        type: 'item-end',
        label: `${item.type} 终点`,
      });
    });
  });

  // 4. 网格吸附（每 5 帧）
  const gridFrame = Math.round(frame / timeline.snapGridInterval) * timeline.snapGridInterval;
  snapTargets.push({
    frame: gridFrame,
    type: 'grid',
    label: '网格',
  });

  // 找到最近的吸附目标
  let closestTarget: SnapTarget | null = null;
  let minDistance = threshold;

  snapTargets.forEach((target) => {
    const distance = Math.abs(target.frame - frame);
    if (distance < minDistance) {
      minDistance = distance;
      closestTarget = target;
    }
  });

  if (closestTarget) {
    return {
      snappedFrame: closestTarget.frame,
      target: closestTarget,
      didSnap: true,
    };
  }

  return {
    snappedFrame: frame,
    target: null,
    didSnap: false,
  };
}

/**
 * 计算调整大小时的吸附
 * @param frame 当前帧位置（左边缘或右边缘）
 * @param edge 正在调整的边缘（'left' | 'right'）
 * @param tracks 所有轨道
 * @param currentItemId 当前素材项 ID
 * @param playheadFrame 播放头位置
 * @param snapEnabled 是否启用吸附
 * @param threshold 吸附阈值
 * @returns 吸附结果
 */
export function calculateResizeSnap(
  frame: number,
  edge: 'left' | 'right',
  tracks: Track[],
  currentItemId: string,
  playheadFrame: number,
  snapEnabled: boolean = true,
  threshold: number = timeline.snapThreshold
): SnapResult {
  // 调整大小时的吸附逻辑与普通吸附类似，但只关注边缘
  return calculateSnap(frame, tracks, currentItemId, playheadFrame, snapEnabled, threshold);
}

/**
 * 获取所有潜在的吸附目标（用于绘制辅助线）
 * @param tracks 所有轨道
 * @param excludeItemId 要排除的素材项 ID
 * @returns 吸附目标数组
 */
export function getAllSnapTargets(tracks: Track[], excludeItemId: string | null = null): SnapTarget[] {
  const targets: SnapTarget[] = [];

  // 轨道起点
  targets.push({ frame: 0, type: 'track-start' });

  // 所有素材的边缘
  tracks.forEach((track) => {
    track.items.forEach((item) => {
      if (item.id === excludeItemId) return;

      targets.push({
        frame: item.from,
        type: 'item-start',
      });

      targets.push({
        frame: item.from + item.durationInFrames,
        type: 'item-end',
      });
    });
  });

  return targets;
}

/**
 * 检查两个素材是否重叠
 * @param item1 素材1
 * @param item2 素材2
 * @returns 是否重叠
 */
export function checkItemsOverlap(item1: Item, item2: Item): boolean {
  const item1Start = item1.from;
  const item1End = item1.from + item1.durationInFrames;
  const item2Start = item2.from;
  const item2End = item2.from + item2.durationInFrames;

  return !(item1End <= item2Start || item2End <= item1Start);
}

/**
 * 在轨道中找到可以放置素材的位置（避免重叠）
 * @param track 轨道
 * @param duration 素材时长
 * @param preferredFrame 首选位置
 * @returns 可用的帧位置
 */
export function findAvailablePosition(
  track: Track,
  duration: number,
  preferredFrame: number
): number {
  // 如果首选位置可用，直接返回
  const wouldOverlap = track.items.some((item) => {
    const itemStart = item.from;
    const itemEnd = item.from + item.durationInFrames;
    const newStart = preferredFrame;
    const newEnd = preferredFrame + duration;

    return !(newEnd <= itemStart || itemEnd <= newStart);
  });

  if (!wouldOverlap) {
    return preferredFrame;
  }

  // 否则，找到最近的可用位置
  // 按起始位置排序素材
  const sortedItems = [...track.items].sort((a, b) => a.from - b.from);

  // 检查开头是否有空间
  if (sortedItems.length === 0 || sortedItems[0].from >= duration) {
    return 0;
  }

  // 检查素材之间的间隙
  for (let i = 0; i < sortedItems.length - 1; i++) {
    const currentEnd = sortedItems[i].from + sortedItems[i].durationInFrames;
    const nextStart = sortedItems[i + 1].from;
    const gap = nextStart - currentEnd;

    if (gap >= duration) {
      return currentEnd;
    }
  }

  // 放在最后
  const lastItem = sortedItems[sortedItems.length - 1];
  return lastItem.from + lastItem.durationInFrames;
}
