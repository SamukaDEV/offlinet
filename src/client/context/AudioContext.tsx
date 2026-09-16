import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import type { FileItem, Playlist } from "../../types";

export type RepeatMode = "off" | "all" | "one";

interface AudioContextType {
  currentTrack: FileItem | null;
  queue: FileItem[];
  queueIndex: number;
  isPlaying: boolean;
  isFullPlayerOpen: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  currentTime: number;
  duration: number;
  buffered: number;

  // Actions
  playTrack: (track: FileItem, queue?: FileItem[]) => void;
  playFolder: (tracks: FileItem[], startIndex?: number) => void;
  playPlaylist: (playlist: Playlist) => void;
  addToQueue: (track: FileItem) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  closePlayer: () => void;
  jumpToQueueIndex: (index: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all");
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [buffered, setBuffered] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<FileItem | null>(null);
  const queueIndexRef = useRef<number>(-1);
  const probedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };

    const onLoadedMetadata = () => {
      const dur = Math.round(audio.duration || 0);
      setDuration(dur);

      if (dur > 0) {
        const cur = currentTrackRef.current;
        const curIdx = queueIndexRef.current;
        if (cur) {
          setCurrentTrack((prev) => (prev && prev.id === cur.id ? { ...prev, duration: dur } : prev));
          setQueue((prev) =>
            prev.map((t, idx) => (idx === curIdx || t.id === cur.id ? { ...t, duration: dur } : t))
          );
          // Persist duration to backend database
          fetch("/api/files/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: cur.id, duration: dur }),
          }).catch(() => {});
        }
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Proactively probe durations for any queue items missing duration
  useEffect(() => {
    let isCancelled = false;
    const missing = queue.filter(
      (t) => (!t.duration || t.duration === 0) && !probedRef.current.has(t.id)
    );
    if (missing.length === 0) return;

    const probeQueue = async () => {
      for (const track of missing) {
        if (isCancelled) break;
        probedRef.current.add(track.id);
        const dur = await probeAudioDuration(track.streamUrl || `/api/stream/${track.id}`);
        if (isCancelled) break;
        if (dur > 0) {
          setQueue((prev) =>
            prev.map((t) => (t.id === track.id ? { ...t, duration: dur } : t))
          );
          fetch("/api/files/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: track.id, duration: dur }),
          }).catch(() => {});
        }
      }
    };

    probeQueue();

    return () => {
      isCancelled = true;
    };
  }, [queue]);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle track end
  const handleTrackEnded = useCallback(() => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      return;
    }

    if (queue.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (isShuffle) {
      const nextIndex = Math.floor(Math.random() * queue.length);
      setQueueIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
    } else if (repeatMode === "all" && queue.length > 0) {
      setQueueIndex(0);
      loadAndPlay(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queue, queueIndex, repeatMode, isShuffle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("ended", handleTrackEnded);
    return () => {
      audio.removeEventListener("ended", handleTrackEnded);
    };
  }, [handleTrackEnded]);

  const loadAndPlay = (track: FileItem) => {
    if (!audioRef.current) return;
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    audioRef.current.src = track.streamUrl || `/api/stream/${track.id}`;
    audioRef.current.play().catch((err) => {
      console.warn("[Audio] Falha no autoplay:", err);
      setIsPlaying(false);
    });
  };

  const playTrack = useCallback((track: FileItem, newQueue?: FileItem[]) => {
    const effectiveQueue = newQueue && newQueue.length > 0 ? newQueue : [track];
    const idx = effectiveQueue.findIndex((t) => t.id === track.id);
    const validIdx = idx >= 0 ? idx : 0;
    queueIndexRef.current = validIdx;
    currentTrackRef.current = track;
    setQueue(effectiveQueue);
    setQueueIndex(validIdx);
    loadAndPlay(track);
  }, []);

  const playFolder = useCallback((tracks: FileItem[], startIndex = 0) => {
    const audioTracks = tracks.filter((t) => t.mediaType === "audio" && !t.isDirectory);
    if (audioTracks.length === 0) return;

    const safeIndex = Math.max(0, Math.min(startIndex, audioTracks.length - 1));
    queueIndexRef.current = safeIndex;
    currentTrackRef.current = audioTracks[safeIndex];
    setQueue(audioTracks);
    setQueueIndex(safeIndex);
    loadAndPlay(audioTracks[safeIndex]);
  }, []);

  const playPlaylist = useCallback((playlist: Playlist) => {
    if (!playlist.items || playlist.items.length === 0) return;
    queueIndexRef.current = 0;
    currentTrackRef.current = playlist.items[0];
    setQueue(playlist.items);
    setQueueIndex(0);
    loadAndPlay(playlist.items[0]);
  }, []);

  const addToQueue = useCallback((track: FileItem) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  }, [isPlaying, currentTrack]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [currentTrack]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (isShuffle) {
      const nextIndex = Math.floor(Math.random() * queue.length);
      setQueueIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
      return;
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
    } else if (repeatMode === "all") {
      setQueueIndex(0);
      loadAndPlay(queue[0]);
    }
  }, [queue, queueIndex, isShuffle, repeatMode]);

  const prevTrack = useCallback(() => {
    if (!audioRef.current) return;
    // If more than 3 seconds into track, seek to start
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (queue.length === 0) return;

    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      loadAndPlay(queue[prevIndex]);
    } else if (repeatMode === "all") {
      setQueueIndex(queue.length - 1);
      loadAndPlay(queue[queue.length - 1]);
    }
  }, [queue, queueIndex, repeatMode]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const openFullPlayer = useCallback(() => setIsFullPlayerOpen(true), []);
  const closeFullPlayer = useCallback(() => setIsFullPlayerOpen(false), []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setCurrentTrack(null);
    setQueue([]);
    setQueueIndex(-1);
    setIsPlaying(false);
    setIsFullPlayerOpen(false);
  }, []);

  const jumpToQueueIndex = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      queueIndexRef.current = index;
      currentTrackRef.current = queue[index];
      setQueueIndex(index);
      loadAndPlay(queue[index]);
    }
  }, [queue]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        isFullPlayerOpen,
        volume,
        isMuted,
        repeatMode,
        isShuffle,
        currentTime,
        duration,
        buffered,
        playTrack,
        playFolder,
        playPlaylist,
        addToQueue,
        togglePlay,
        pause,
        resume,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        openFullPlayer,
        closeFullPlayer,
        closePlayer,
        jumpToQueueIndex,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio deve ser usado dentro de um AudioProvider");
  }
  return context;
};

/**
 * Lazily probes audio metadata in the browser using a temporary Audio element
 */
function probeAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      audio.src = "";
    };

    const onLoaded = () => {
      const dur = Math.round(audio.duration || 0);
      cleanup();
      resolve(dur);
    };

    const onError = () => {
      cleanup();
      resolve(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = url;

    // Timeout after 3.5s to not block anything
    timer = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 3500);
  });
}
