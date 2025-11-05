/**
 * 时间格式化工具函数
 */

/**
 * 将帧数转换为 MM:SS:FF 格式
 * @param frame 帧数
 * @param fps 帧率
 * @returns 格式化的时间字符串
 */
export function formatTime(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = frame % fps;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

/**
 * 将帧数转换为秒数
 * @param frame 帧数
 * @param fps 帧率
 * @returns 秒数
 */
export function framesToSeconds(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * 将秒数转换为帧数
 * @param seconds 秒数
 * @param fps 帧率
 * @returns 帧数
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * 将像素位置转换为帧数
 * @param pixels 像素位置
 * @param pixelsPerFrame 每帧的像素数
 * @returns 帧数
 */
export function pixelsToFrame(pixels: number, pixelsPerFrame: number): number {
  return Math.round(pixels / pixelsPerFrame);
}

/**
 * 将帧数转换为像素位置
 * @param frame 帧数
 * @param pixelsPerFrame 每帧的像素数
 * @returns 像素位置
 */
export function frameToPixels(frame: number, pixelsPerFrame: number): number {
  return frame * pixelsPerFrame;
}

/**
 * 根据缩放级别获取每帧的像素数
 * @param zoom 缩放级别
 * @returns 每帧的像素数
 */
export function getPixelsPerFrame(zoom: number): number {
  return 2 * zoom;
}

/**
 * 获取时间标尺的刻度间隔
 * 根据缩放级别自动调整刻度密度
 * @param zoom 缩放级别
 * @returns 主刻度间隔（帧数）
 */
export function getRulerInterval(zoom: number): number {
  if (zoom >= 2) {
    return 5;   // 高缩放：每 5 帧
  } else if (zoom >= 1) {
    return 15;  // 中缩放：每 15 帧
  } else {
    return 30;  // 低缩放：每 30 帧
  }
}

/**
 * 获取次刻度间隔
 * @param mainInterval 主刻度间隔
 * @returns 次刻度间隔
 */
export function getSubInterval(mainInterval: number): number {
  if (mainInterval <= 5) {
    return 1;  // 主刻度 5 帧时，次刻度 1 帧
  } else if (mainInterval <= 15) {
    return 5;  // 主刻度 15 帧时，次刻度 5 帧
  } else {
    return 10; // 主刻度 30 帧时，次刻度 10 帧
  }
}
