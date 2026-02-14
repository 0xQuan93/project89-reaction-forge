import { create } from 'zustand';

export interface Track {
  title: string;
  file: string;
  artist: string;
  isLocal?: boolean;
  url?: string;
}

const DEFAULT_TRACKS: Track[] = [
  { title: "Abyss Scrubber", file: "Abyss Scrubber.mp3", artist: "PoseLab Ambient" },
  { title: "Aurora Mesh", file: "Aurora Mesh.mp3", artist: "PoseLab Ambient" },
  { title: "Final Render", file: "Final Render.mp3", artist: "PoseLab Ambient" },
  { title: "Glassmorphism", file: "Glassmorphism.mp3", artist: "PoseLab Ambient" },
  { title: "Glitch-Tab", file: "Glitch-Tab.mp3", artist: "PoseLab Ambient" },
  { title: "Neon Drip", file: "Neon Drip.mp3", artist: "PoseLab Ambient" },
  { title: "Pixelate", file: "Pixelate.mp3", artist: "PoseLab Ambient" },
  { title: "Pose Logic", file: "Pose Logic.mp3", artist: "PoseLab Ambient" },
  { title: "Signal Green", file: "Signal Green.mp3", artist: "PoseLab Ambient" },
  { title: "Spatial Scenery", file: "Spatial Scenery.mp3", artist: "PoseLab Ambient" },
  { title: "Vapor Scape", file: "Vapor Scape.mp3", artist: "PoseLab Ambient" },
];

export const PATH_PREFIX = '/POSELABSTUDIOPLAYLIST/';

interface MusicState {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeatOne: boolean;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  addTracks: (tracks: Track[]) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeatOne: () => void;
  playTrack: (index: number) => void;
  clearPlaylist: () => void;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  tracks: DEFAULT_TRACKS,
  currentTrackIndex: 0,
  isPlaying: false,
  volume: 0.5,
  isMuted: false,
  isShuffle: false,
  isRepeatOne: false,

  setTracks: (tracks) => set({ tracks, currentTrackIndex: 0, isPlaying: false }),
  
  addTracks: (newTracks) => set(state => ({ tracks: [...state.tracks, ...newTracks] })),
  
  play: () => set({ isPlaying: true }),
  
  pause: () => set({ isPlaying: false }),
  
  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),
  
  next: () => {
    const { tracks, currentTrackIndex, isShuffle } = get();
    if (tracks.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
      if (tracks.length > 1 && nextIndex === currentTrackIndex) {
        nextIndex = (nextIndex + 1) % tracks.length;
      }
    } else {
      nextIndex = (currentTrackIndex + 1) % tracks.length;
    }
    set({ currentTrackIndex: nextIndex, isPlaying: true });
  },
  
  prev: () => {
    const { tracks, currentTrackIndex } = get();
    if (tracks.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    set({ currentTrackIndex: prevIndex, isPlaying: true });
  },
  
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: false }),
  
  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),
  
  toggleShuffle: () => set(state => ({ isShuffle: !state.isShuffle })),
  
  toggleRepeatOne: () => set(state => ({ isRepeatOne: !state.isRepeatOne })),
  
  playTrack: (index) => {
    const { tracks } = get();
    if (index >= 0 && index < tracks.length) {
      set({ currentTrackIndex: index, isPlaying: true });
    }
  },

  clearPlaylist: () => set({ tracks: [], isPlaying: false, currentTrackIndex: 0 })
}));
