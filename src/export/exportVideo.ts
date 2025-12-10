export function bestMime(): string | null {
  const prefs = [
    "video/webm;codecs=vp9", 
    "video/webm;codecs=vp8", 
    "video/webm",
    "video/mp4" // Safari fallback
  ];
  return prefs.find(p => (window as any).MediaRecorder?.isTypeSupported?.(p)) ?? null;
}

