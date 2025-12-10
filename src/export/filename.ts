export function generateFilename(
    preset: string = 'custom', 
    mode: string = 'pose', 
    ext: string = 'png'
): string {
    const date = new Date();
    const YYYYMMDD = date.toISOString().slice(0, 10).replace(/-/g, '');
    const HHMM = date.toTimeString().slice(0, 5).replace(/:/g, '');
    
    // Sanitize inputs
    const safePreset = preset.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeMode = mode.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return `avatar_${safePreset}_${safeMode}_${YYYYMMDD}-${HHMM}.${ext}`;
}

