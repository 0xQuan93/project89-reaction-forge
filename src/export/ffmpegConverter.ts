import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton instance
const ffmpeg = new FFmpeg();

export async function convertWebMToMp4(webmBlob: Blob, onProgress?: (progress: number) => void): Promise<Blob> {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  if (!ffmpeg.loaded) {
    console.log('[FFmpeg] Loading core...');
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    console.log('[FFmpeg] Loaded.');
  }

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(progress);
  });

  console.log('[FFmpeg] Writing input file...');
  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
  
  console.log('[FFmpeg] Starting conversion...');
  // Use H.264 encoding for max compatibility
  // -c:v libx264 -preset fast -crf 22
  await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', 'output.mp4']);
  
  console.log('[FFmpeg] Reading output file...');
  const data = await ffmpeg.readFile('output.mp4');
  
  // Cast data to any to bypass type mismatch between ffmpeg FileData and BlobPart
  // ffmpeg.readFile returns Uint8Array which is a valid BlobPart, but type definitions might conflict
  return new Blob([data as any], { type: 'video/mp4' });
}
