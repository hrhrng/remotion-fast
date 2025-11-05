export type WaveformData = {
  peaks: number[]; // Normalized peak values (0-1) for each sample
  duration: number; // Duration in seconds
};

/**
 * Generate waveform data from an audio/video file
 * @param url - URL of the audio/video file
 * @param samples - Number of samples to generate (default: 1000)
 * @returns Promise with waveform data
 */
export async function generateWaveform(
  url: string,
  samples: number = 1000
): Promise<WaveformData> {
  try {
    // Fetch the audio file
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration;
    const rawData = audioBuffer.getChannelData(0); // Get first channel
    const blockSize = Math.floor(rawData.length / samples);
    const peaks: number[] = [];

    // Extract peaks by dividing audio into blocks
    for (let i = 0; i < samples; i++) {
      const start = blockSize * i;
      let max = 0;

      // Find maximum absolute value in this block
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j] || 0);
        if (val > max) {
          max = val;
        }
      }

      peaks.push(max);
    }

    // Normalize peaks to 0-1 range
    const maxPeak = Math.max(...peaks);
    const normalizedPeaks = maxPeak > 0
      ? peaks.map(p => p / maxPeak)
      : peaks;

    return {
      peaks: normalizedPeaks,
      duration,
    };
  } catch (error) {
    console.error('Error generating waveform:', error);
    // Return empty waveform on error
    return {
      peaks: Array(samples).fill(0),
      duration: 0,
    };
  }
}

/**
 * Render waveform to a canvas and return as data URL
 * @param waveformData - Waveform data to render
 * @param width - Canvas width
 * @param height - Canvas height
 * @param color - Waveform color
 * @returns Data URL of the rendered waveform
 */
export function renderWaveformToCanvas(
  waveformData: WaveformData,
  width: number,
  height: number,
  color: string = '#4CAF50'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { peaks } = waveformData;
  const barWidth = width / peaks.length;
  const middleY = height / 2;

  ctx.fillStyle = color;

  peaks.forEach((peak, i) => {
    const barHeight = peak * middleY;
    const x = i * barWidth;

    // Draw bar from middle extending up and down
    ctx.fillRect(x, middleY - barHeight, Math.max(barWidth, 1), barHeight * 2);
  });

  return canvas.toDataURL();
}
