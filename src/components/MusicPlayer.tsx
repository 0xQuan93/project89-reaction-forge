import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  SpeakerHigh, 
  Playlist,
  X,
  Disc,
  SpeakerX,
  Trash,
  FolderOpen,
  Shuffle,
  RepeatOnce
} from '@phosphor-icons/react';
import { useMusicStore, PATH_PREFIX, type Track } from '../state/useMusicStore';
import './MusicPlayer.css';

export function MusicPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const {
    tracks,
    currentTrackIndex,
    isPlaying,
    volume,
    isMuted,
    isShuffle,
    isRepeatOne,
    play,
    pause,
    togglePlay,
    next,
    prev,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatOne,
    addTracks,
    clearPlaylist
  } = useMusicStore();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 600 || window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        // Handle playback promise to avoid errors if unmounting or changing rapidly
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Audio playback failed:", e);
            pause();
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex, tracks, pause]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleTrackEnd = () => {
    if (isRepeatOne) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      next();
    }
  };

  const handleClearPlaylist = () => {
    clearPlaylist();
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

    addTracks(newTracks);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentTrack = tracks[currentTrackIndex];
  const trackSrc = currentTrack ? (currentTrack.isLocal ? currentTrack.url : `${PATH_PREFIX}${currentTrack.file}`) : undefined;

  return (
    <div className={`music-player-container ${isOpen ? 'open' : ''}`}>
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

      {/* Trigger Button (Spinning Record) */}
      <button 
        className={`music-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Music Player"
      >
        <div className={`record-disc ${isPlaying ? 'spin' : ''}`}>
           <Disc size={24} weight="duotone" />
        </div>
      </button>

      {/* Mobile Modal Layout */}
      {isMobile && isOpen && (
        <div className="music-mobile-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="music-mobile-card" onClick={e => e.stopPropagation()}>
            <div className="music-mobile-header">
              <h4><Playlist size={20} color="var(--accent)" weight="duotone" /> Studio Player</h4>
              <button className="control-btn" onClick={() => setIsOpen(false)}>
                <X size={24} weight="bold" />
              </button>
            </div>

            <div className="music-mobile-track-info">
              <div className={`music-mobile-disc ${isPlaying ? 'spin' : ''}`}>
                <Disc size={80} weight="duotone" />
              </div>
              <div className="track-title large">{currentTrack?.title || "No Track Selected"}</div>
              <div className="track-artist uppercase tiny bold muted-dark">{currentTrack?.artist || "..."}</div>
            </div>

            <div className="progress-container large">
              <input 
                type="range" 
                className="progress-slider"
                min="0" 
                max={duration || 0} 
                value={currentTime}
                onChange={handleSeek}
              />
              <div className="time-row">
                <span className="time-text">{formatTime(currentTime)}</span>
                <span className="time-text">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="player-controls large">
              <button className="control-btn" onClick={toggleShuffle}>
                <Shuffle size={24} className={isShuffle ? 'active-icon' : ''} />
              </button>
              <button className="control-btn" onClick={prev}>
                <SkipBack size={32} weight="fill" />
              </button>
              <button className="play-pause-large" onClick={togglePlay}>
                {isPlaying ? <Pause size={36} weight="fill" /> : <Play size={36} weight="fill" />}
              </button>
              <button className="control-btn" onClick={next}>
                <SkipForward size={32} weight="fill" />
              </button>
              <button className="control-btn" onClick={toggleRepeatOne}>
                <RepeatOnce size={24} className={isRepeatOne ? 'active-icon' : ''} />
              </button>
            </div>

            <div className="music-mobile-volume">
               <SpeakerHigh size={18} weight="duotone" color="var(--text-tertiary)" />
               <input 
                type="range" 
                className="mobile-volume-slider"
                min="0" 
                max="1" 
                step="0.01" 
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                }}
              />
            </div>

            <div className="mobile-actions-row">
              <button className="action-chip" onClick={() => fileInputRef.current?.click()}>
                <FolderOpen size={18} weight="duotone" /> Load Local
              </button>
              <button className="action-chip danger" onClick={handleClearPlaylist}>
                <Trash size={18} weight="duotone" /> Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Horizontal Sliding Drawer */}
      {!isMobile && (
      <div className={`music-drawer ${isOpen ? 'open' : ''}`}>
        <div className="music-drawer-content">
          
          {/* Controls Group */}
          <div className="drawer-controls">
            <button className="control-btn small" onClick={prev} title="Previous">
              <SkipBack size={16} weight="fill" />
            </button>
            <button 
              className="control-btn small" 
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </button>
            <button className="control-btn small" onClick={next} title="Next">
              <SkipForward size={16} weight="fill" />
            </button>
          </div>

          {/* Track Info */}
          <div className="drawer-info">
            <div className="drawer-track-title" title={currentTrack?.title || "No Track"}>
              {currentTrack?.title || "Select Track"}
            </div>
            <div className="drawer-progress-bar">
               <div className="drawer-progress-fill" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
            </div>
          </div>

          {/* Volume Group */}
          <div className="drawer-volume">
            <button 
              className="control-btn tiny" 
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? <SpeakerX size={14} /> : <SpeakerHigh size={14} />}
            </button>
            <input 
              type="range" 
              className="drawer-volume-slider"
              min="0" 
              max="1" 
              step="0.05" 
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
              }}
            />
          </div>

          {/* Extra Actions */}
          <div className="drawer-actions">
            <button 
              className={`control-btn tiny ${isShuffle ? 'active' : ''}`} 
              onClick={toggleShuffle}
              title="Shuffle"
            >
              <Shuffle size={14} />
            </button>
            <button 
              className="control-btn tiny" 
              onClick={() => fileInputRef.current?.click()}
              title="Add Files"
            >
              <FolderOpen size={14} />
            </button>
             <button 
              className="control-btn tiny danger" 
              onClick={handleClearPlaylist}
              title="Clear Playlist"
            >
              <Trash size={14} />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
