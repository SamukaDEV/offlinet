import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Shuffle,
  Repeat,
  Repeat1,
  Maximize2,
  ChevronDown,
  X,
  ListMusic,
  Music,
  PlusCircle,
  Disc,
} from "lucide-react";
import { useAudio } from "../context/AudioContext";
import { formatDuration } from "../utils/format";
import { PlaylistModal } from "./PlaylistModal";

export const AudioPlayer: React.FC = () => {
  const {
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
    togglePlay,
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
  } = useAudio();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Keyboard shortcuts when audio is active
  useEffect(() => {
    if (!currentTrack) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        seek(currentTime + 5);
      } else if (e.code === "ArrowLeft") {
        seek(currentTime - 5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(volume + 0.05);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(volume - 0.05);
      } else if (e.code === "KeyM") {
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTrack, togglePlay, seek, currentTime, volume, setVolume, toggleMute]);

  if (!currentTrack) return null;

  const currentDuration = duration > 0 ? duration : (currentTrack.duration || 0);
  const progressPercent = currentDuration > 0
    ? ((isSeeking ? seekValue : currentTime) / currentDuration) * 100
    : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekMouseUp = () => {
    setIsSeeking(false);
    seek(seekValue);
  };

  return (
    <>
      {/* 1. FIXED PERSISTENT MINIPLAYER AT BOTTOM */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] transition-all">
        {/* Scrubbable top progress bar */}
        <div className="relative w-full h-1 bg-neutral-800 cursor-pointer group">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={currentDuration || 100}
            step={0.1}
            value={isSeeking ? seekValue : currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            onTouchStart={handleSeekMouseDown}
            onTouchEnd={handleSeekMouseUp}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Miniplayer controls container */}
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Track Info & Artwork */}
          <div
            onClick={openFullPlayer}
            className="flex items-center gap-3 min-w-0 max-w-[280px] sm:max-w-sm cursor-pointer group"
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 flex-none shadow-md flex items-center justify-center">
              <Disc className={`w-7 h-7 text-emerald-400 ${isPlaying ? "animate-[spin_4s_linear_infinite]" : ""}`} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                {currentTrack.name}
              </h4>
              <p className="text-xs text-neutral-400 truncate flex items-center gap-1.5">
                <span>{currentTrack.storageName || "OffliNet"}</span>
                <span>•</span>
                <span className="text-[10px] uppercase px-1 py-0.2 bg-neutral-800 text-neutral-400 rounded">
                  {currentTrack.extension.replace(".", "") || "AUDIO"}
                </span>
              </p>
            </div>
          </div>

          {/* Center: Main Playback Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              title={isShuffle ? "Modo aleatório ativado" : "Modo aleatório desativado"}
              className={`p-2 rounded-full transition-colors hidden sm:block ${
                isShuffle ? "text-emerald-400 bg-emerald-500/10" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Previous Track */}
            <button
              onClick={prevTrack}
              title="Música anterior (ou início)"
              className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause button */}
            <button
              onClick={togglePlay}
              title={isPlaying ? "Pausar" : "Tocar"}
              className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={nextTrack}
              title="Próxima música"
              className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat Mode */}
            <button
              onClick={cycleRepeat}
              title={
                repeatMode === "one"
                  ? "Repetindo faixa atual"
                  : repeatMode === "all"
                  ? "Repetindo toda a fila"
                  : "Repetição desativada"
              }
              className={`p-2 rounded-full transition-colors hidden sm:block ${
                repeatMode !== "off" ? "text-emerald-400 bg-emerald-500/10" : "text-neutral-400 hover:text-white"
              }`}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Right: Time, Volume, Queue & Window Controls */}
          <div className="flex items-center gap-3">
            {/* Time display */}
            <div className="text-xs font-mono text-neutral-400 hidden md:block">
              <span>{formatDuration(currentTime)}</span>
              <span className="mx-1 text-neutral-600">/</span>
              <span>{formatDuration(currentDuration)}</span>
            </div>

            {/* Volume control */}
            <div className="items-center gap-1.5 hidden lg:flex">
              <button
                onClick={toggleMute}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Queue Toggle */}
            <button
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              title="Fila de reprodução"
              className={`p-2 rounded-xl transition-colors relative ${
                isQueueOpen ? "bg-emerald-500/20 text-emerald-400" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <ListMusic className="w-4 h-4" />
              {queue.length > 1 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-emerald-500 text-black text-[10px] font-bold rounded-full">
                  {queue.length}
                </span>
              )}
            </button>

            {/* Add to Playlist button */}
            <button
              onClick={() => setIsPlaylistModalOpen(true)}
              title="Adicionar à Playlist"
              className="p-2 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 transition-colors hidden sm:block"
            >
              <PlusCircle className="w-4 h-4" />
            </button>

            {/* Expand / Maximize button */}
            <button
              onClick={openFullPlayer}
              title="Expandir player"
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Close / Stop button */}
            <button
              onClick={closePlayer}
              title="Fechar reprodutor"
              className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. QUEUE POPUP DRAWER */}
      {isQueueOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-4 flex flex-col max-h-[420px] animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-2">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Fila de Reprodução</h4>
              <span className="text-xs text-neutral-400">({queue.length})</span>
            </div>
            <button
              onClick={() => setIsQueueOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;
              const trackDur = isCurrent && duration > 0 ? duration : (track.duration || 0);
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => jumpToQueueIndex(idx)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer text-xs transition-colors ${
                    isCurrent
                      ? "bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30"
                      : "hover:bg-neutral-800/60 text-neutral-300"
                  }`}
                >
                  <div className="w-5 text-center flex-none">
                    {isCurrent ? (
                      <Music className="w-3.5 h-3.5 text-emerald-400 animate-pulse inline" />
                    ) : (
                      <span className="text-neutral-500 text-[11px]">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="truncate text-white font-medium">{track.name}</p>
                    <p className="text-[10px] text-neutral-400">{track.storageName}</p>
                  </div>
                  <div className="text-[11px] text-neutral-400 flex-none font-mono">
                    {trackDur > 0 ? formatDuration(trackDur) : "--:--"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FULL PLAYER MODAL (EXPANDED VIEW) */}
      {isFullPlayerOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-between p-6 sm:p-8 animate-in fade-in duration-300">
          {/* Atmospheric background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px]" />
          </div>

          {/* Top Bar */}
          <div className="w-full max-w-2xl flex items-center justify-between">
            <button
              onClick={closeFullPlayer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              <span>Minimizar</span>
            </button>

            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Reproduzindo Agora
            </span>

            <button
              onClick={() => setIsPlaylistModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Playlist</span>
            </button>
          </div>

          {/* Center: Vinyl Disc Cover */}
          <div className="flex-1 flex flex-col items-center justify-center my-6 max-w-md w-full">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-neutral-900 border-4 border-neutral-800 shadow-[0_0_60px_rgba(16,185,129,0.15)] flex items-center justify-center overflow-hidden">
              {/* Spinning vinyl texture */}
              <div
                className={`w-full h-full rounded-full flex items-center justify-center bg-[radial-gradient(circle,#171717_15%,#0a0a0a_70%,#171717_100%)] ${
                  isPlaying ? "animate-[spin_10s_linear_infinite]" : ""
                }`}
              >
                {/* Vinyl grooved circles */}
                <div className="w-4/5 h-4/5 rounded-full border border-neutral-800/80 flex items-center justify-center">
                  <div className="w-3/5 h-3/5 rounded-full border border-neutral-800/80 flex items-center justify-center">
                    {/* Vinyl Center Label */}
                    <div className="w-24 h-24 rounded-full bg-emerald-950 border-4 border-emerald-500/40 flex items-center justify-center shadow-inner">
                      <Music className="w-10 h-10 text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Song Metadata */}
            <div className="text-center mt-6 w-full">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate px-2">
                {currentTrack.name}
              </h2>
              <p className="text-sm text-neutral-400 mt-1 flex items-center justify-center gap-2">
                <span>{currentTrack.storageName || "Armazenamento OffliNet"}</span>
                <span>•</span>
                <span className="uppercase text-xs font-mono text-emerald-400 px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/50 rounded-md">
                  {currentTrack.extension.replace(".", "") || "AUDIO"}
                </span>
              </p>
            </div>
          </div>

          {/* Bottom: Sliders & Controls */}
          <div className="w-full max-w-2xl space-y-5">
            {/* Timeline Progress Slider */}
            <div className="space-y-1.5">
              <div className="relative w-full h-2 bg-neutral-800 rounded-full cursor-pointer">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={currentDuration || 100}
                  step={0.1}
                  value={isSeeking ? seekValue : currentTime}
                  onChange={handleSeekChange}
                  onMouseDown={handleSeekMouseDown}
                  onMouseUp={handleSeekMouseUp}
                  onTouchStart={handleSeekMouseDown}
                  onTouchEnd={handleSeekMouseUp}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-xs font-mono text-neutral-400">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(currentDuration)}</span>
              </div>
            </div>

            {/* Big Action Controls */}
            <div className="flex items-center justify-center gap-6 sm:gap-8">
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                className={`p-3 rounded-full transition-colors ${
                  isShuffle ? "text-emerald-400 bg-emerald-500/15" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Prev */}
              <button
                onClick={prevTrack}
                className="p-3 rounded-full text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              {/* Play / Pause Giant Button */}
              <button
                onClick={togglePlay}
                className="p-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-xl shadow-emerald-500/30 transition-transform active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </button>

              {/* Next */}
              <button
                onClick={nextTrack}
                className="p-3 rounded-full text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              {/* Repeat */}
              <button
                onClick={cycleRepeat}
                className={`p-3 rounded-full transition-colors ${
                  repeatMode !== "off" ? "text-emerald-400 bg-emerald-500/15" : "text-neutral-400 hover:text-white"
                }`}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Bottom Bar: Volume & Queue Button */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-neutral-400 hover:text-white">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-28 sm:w-36 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <button
                onClick={() => setIsQueueOpen(!isQueueOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors text-xs font-semibold ${
                  isQueueOpen
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                <ListMusic className="w-4 h-4" />
                <span>Fila ({queue.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Selector Modal */}
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        trackToAdd={currentTrack}
      />
    </>
  );
};
