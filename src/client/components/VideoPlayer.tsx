import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  X,
  Subtitles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import type { FileItem } from "../../types";
import { formatSeconds } from "../utils/format";

interface VideoPlayerProps {
  file: FileItem;
  onClose: () => void;
  onNextEpisode?: (nextFile: FileItem) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ file, onClose, onNextEpisode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [capturedThumb, setCapturedThumb] = useState(false);

  // Check saved progress
  useEffect(() => {
    if (file.watchProgress && file.watchProgress.progressSeconds > 10 && !file.watchProgress.completed) {
      setShowResumePrompt(true);
    }
  }, [file]);

  // Check if subtitle track exists
  useEffect(() => {
    fetch(`/api/media/detail/${file.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.hasSubtitle) {
          setHasSubtitles(true);
        }
      })
      .catch(() => {});
  }, [file.id]);

  // Handle auto-hiding controls on inactivity
  const triggerUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3500);
  }, [isPlaying]);

  // Sync progress to backend
  const syncProgress = useCallback(
    (time: number, dur: number) => {
      if (dur > 0) {
        fetch("/api/media/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: file.id,
            progressSeconds: Math.floor(time),
            durationSeconds: Math.floor(dur),
          }),
        }).catch(() => {});
      }
    },
    [file.id]
  );

  // Periodic progress saving every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        syncProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, syncProgress]);

  // Save on component unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        syncProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [syncProgress]);

  // Capture video frame to server thumbnail cache if needed
  const captureFrame = useCallback(() => {
    if (capturedThumb || !videoRef.current) return;
    try {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = Math.round((640 / video.videoWidth) * video.videoHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      fetch("/api/thumbnail/upload-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, base64: dataUrl }),
      }).catch(() => {});

      setCapturedThumb(true);
    } catch {
      // ignore
    }
  }, [file.id, capturedThumb]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const v = videoRef.current;

      // Ignore if user is typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          triggerUserActivity();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + 10);
          triggerUserActivity();
          break;
        case "arrowup":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          setVolume(v.volume);
          setIsMuted(false);
          triggerUserActivity();
          break;
        case "arrowdown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          setVolume(v.volume);
          triggerUserActivity();
          break;
        case "m":
          e.preventDefault();
          v.muted = !v.muted;
          setIsMuted(v.muted);
          triggerUserActivity();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "escape":
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, isPlaying, onClose, triggerUserActivity]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    triggerUserActivity();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const target = parseFloat(e.target.value);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    triggerUserActivity();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const resumePlayback = () => {
    if (videoRef.current && file.watchProgress) {
      videoRef.current.currentTime = file.watchProgress.progressSeconds;
      setShowResumePrompt(false);
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerUserActivity}
      onClick={triggerUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={file.streamUrl}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        autoPlay
        playsInline
        onPlay={() => {
          setIsPlaying(true);
          setTimeout(captureFrame, 2000);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            // Calculate buffer
            if (videoRef.current.buffered.length > 0) {
              setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
          }
        }}
      >
        {hasSubtitles && (
          <track
            label="Português"
            kind="subtitles"
            srcLang="pt"
            src={`/api/media/subtitles/${file.id}`}
            default={subtitlesEnabled}
          />
        )}
      </video>

      {/* Resume Prompt Toast */}
      {showResumePrompt && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-red-500/50 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-4 z-30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div>
            <p className="text-sm font-semibold text-white">Continuar de onde parou?</p>
            <p className="text-xs text-neutral-400">
              Você parou aos {formatSeconds(file.watchProgress?.progressSeconds || 0)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resumePlayback}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-red-600/30"
            >
              Continuar
            </button>
            <button
              onClick={() => setShowResumePrompt(false)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Do Início
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between z-20 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-neutral-900/80 hover:bg-red-600 text-white backdrop-blur-md transition-colors"
            title="Fechar Player (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-1">{file.name}</h2>
            <p className="text-xs text-neutral-400">
              {file.storageName} {file.relativePath ? `• ${file.relativePath}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* External stream link (open in VLC / external player) */}
          <a
            href={file.streamUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs backdrop-blur-md transition-colors"
            title="Abrir URL direta no VLC ou reprodutor externo"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Abrir no VLC</span>
          </a>
        </div>
      </div>

      {/* Center Big Play/Pause Splash Icon */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-10"
        >
          <Play className="w-9 h-9 fill-white ml-1" />
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-20 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Timeline Range Bar */}
        <div className="relative group mb-4 flex items-center">
          {/* Buffered track indicator */}
          {duration > 0 && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-neutral-700/60 rounded-full pointer-events-none"
              style={{ width: `${(buffered / duration) * 100}%` }}
            />
          )}

          {/* Progress fill */}
          {duration > 0 && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-red-600 rounded-full pointer-events-none"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          )}

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 appearance-none bg-neutral-800/80 rounded-full outline-none cursor-pointer accent-red-600 hover:h-2.5 transition-all"
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Buttons: Play, Skip, Time */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-white"
              title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }
              }}
              className="p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-neutral-300 hover:text-white"
              title="Voltar 10s (←)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(
                    videoRef.current.duration,
                    videoRef.current.currentTime + 10
                  );
                }
              }}
              className="p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-neutral-300 hover:text-white"
              title="Avançar 10s (→)"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-neutral-300 hover:text-white"
                title="Mudo (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 h-1 appearance-none bg-neutral-700 rounded-full outline-none accent-red-600 cursor-pointer hidden sm:block"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs sm:text-sm font-mono text-neutral-400">
              <span className="text-white font-medium">{formatSeconds(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* Right Buttons: Subtitles, Speed, PiP, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Subtitles toggle */}
            {hasSubtitles && (
              <button
                onClick={() => {
                  setSubtitlesEnabled(!subtitlesEnabled);
                  if (videoRef.current && videoRef.current.textTracks.length > 0) {
                    videoRef.current.textTracks[0].mode = subtitlesEnabled ? "hidden" : "showing";
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  subtitlesEnabled ? "bg-red-600/80 text-white" : "hover:bg-neutral-800 text-neutral-400"
                }`}
                title="Legendas"
              >
                <Subtitles className="w-5 h-5" />
              </button>
            )}

            {/* Speed Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 transition-colors"
                title="Velocidade de reprodução"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-28 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-1 text-xs z-30">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedChange(s)}
                      className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between ${
                        playbackSpeed === s ? "text-red-500 font-bold" : "text-neutral-300"
                      }`}
                    >
                      <span>{s}x</span>
                      {playbackSpeed === s && <ChevronRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-neutral-300 hover:text-white"
              title="Tela cheia (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
