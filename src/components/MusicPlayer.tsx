import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  SpeakerHigh, 
  SpeakerLow,
  MusicNotes,
  Playlist,
  X,
  Disc,
  SpeakerX,
  Trash,
  FolderOpen,
  FileAudio,
  Shuffle,
  RepeatOnce
} from '@phosphor-icons/react';
import './MusicPlayer.css';

const DEFAULT_TRACKS = [
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

const PATH_PREFIX = '/POSELABSTUDIOPLAYLIST/';

interface Track {
  title: string;
  file: string;
  artist: string;
  isLocal?: boolean;
  url?: string;
}

export function MusicPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        // Handle playback promise to avoid errors if unmounting or changing rapidly
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Audio playback failed:", e);
            setIsPlaying(false);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex, tracks]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    
    if (isShuffle) {
      // Pick random index
      let nextIndex = Math.floor(Math.random() * tracks.length);
      // Avoid repeating same song if possible
      if (tracks.length > 1 && nextIndex === currentTrackIndex) {
        nextIndex = (nextIndex + 1) % tracks.length;
      }
      setCurrentTrackIndex(nextIndex);
    } else {
      // Loop is automatic
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    }
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    // Previous button always goes to previous in list order, even if shuffled (simple behavior)
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleTrackEnd = () => {
    if (isRepeatOne) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      nextTrack();
    }
  };

  const handleClearPlaylist = () => {
    setTracks([]);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleAddFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newTracks: Track[] = Array.from(files).map(file => ({
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      file: file.name,
      artist: "Local File",
      isLocal: true,
      url: URL.createObjectURL(file)
    }));

    setTracks(prev => [...prev, ...newTracks]);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentTrack = tracks[currentTrackIndex];
  const trackSrc = currentTrack ? (currentTrack.isLocal ? currentTrack.url : `${PATH_PREFIX}${currentTrack.file}`) : undefined;

  return (
    <div className="music-player-container">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={trackSrc}
        onEnded={handleTrackEnd}
        preload="none"
      />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAddFiles}
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
      />

      {/* Floating Panel (Popup) */}
      {isOpen && (
        <div className="music-player-panel glass-panel">
          <div className="music-header">
            <h4>
              <Playlist size={16} color="var(--accent)" />
              PoseLab Studio
            </h4>
            <button 
              className="control-btn"
              onClick={() => setIsOpen(false)}
              title="Close"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div className="track-display-row">
            <button 
              className={`control-btn small ${isShuffle ? 'active' : ''}`} 
              onClick={() => setIsShuffle(!isShuffle)}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>
            
            <div className="track-info">
              <div className="track-title" title={currentTrack?.title}>{currentTrack?.title || "No Track Selected"}</div>
              <div className="track-artist">{currentTrack?.artist || "..."}</div>
            </div>

            <button 
              className={`control-btn small ${isRepeatOne ? 'active' : ''}`} 
              onClick={() => setIsRepeatOne(!isRepeatOne)}
              title="Repeat One"
            >
              <RepeatOnce size={16} />
            </button>
          </div>

          <div className="player-controls">
            <button className="control-btn" onClick={prevTrack} title="Previous" disabled={tracks.length === 0}>
              <SkipBack size={24} weight="fill" />
            </button>
            <button 
              className="control-btn play-pause" 
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              disabled={tracks.length === 0}
            >
              {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
            </button>
            <button className="control-btn" onClick={nextTrack} title="Next" disabled={tracks.length === 0}>
              <SkipForward size={24} weight="fill" />
            </button>
          </div>

          <div className="volume-control">
            <button 
              className="control-btn" 
              onClick={() => setIsMuted(!isMuted)}
              title="Mute/Unmute"
              style={{ padding: 4 }}
            >
              {isMuted || volume === 0 ? <SpeakerX size={16} /> : volume < 0.5 ? <SpeakerLow size={16} /> : <SpeakerHigh size={16} />}
            </button>
            <input 
              type="range" 
              className="volume-slider"
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
            />
          </div>

          <div className="playlist-controls">
            <button className="playlist-action-btn" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={16} /> Add Files
            </button>
            <button className="playlist-action-btn" onClick={handleClearPlaylist}>
              <Trash size={16} /> Clear
            </button>
          </div>

          <div className="playlist">
            {tracks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                Playlist empty.<br/>Add audio files to play.
              </div>
            ) : (
              tracks.map((track, idx) => (
                <div 
                  key={`${track.file}-${idx}`}
                  className={`playlist-item ${currentTrackIndex === idx ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setIsPlaying(true);
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {track.isLocal && <FileAudio size={12} weight="duotone" />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</span>
                  </span>
                  {currentTrackIndex === idx && isPlaying && (
                    <MusicNotes size={14} weight="fill" className="spin-slow" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Trigger Button (Spinning Record) */}
      <button 
        className={`music-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        title="Music Player"
      >
        <div className={`record-disc ${isPlaying ? 'spin' : ''}`}>
           <Disc size={32} weight="duotone" />
        </div>
      </button>
    </div>
  );
}
