import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import type { SystemInfo, FileItem, StorageRoot } from "../types";
import { Navbar } from "./components/Navbar";
import { MovieMode } from "./components/MovieMode";
import { FileExplorer } from "./components/FileExplorer";
import { StorageSettings } from "./components/StorageSettings";
import { TorrentManager } from "./components/TorrentManager";
import { VideoPlayer } from "./components/VideoPlayer";
import { MovieDetailModal } from "./components/MovieDetailModal";
import { AudioPlayer } from "./components/AudioPlayer";
import { AudioProvider } from "./context/AudioContext";

export const App: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [storageRoots, setStorageRoots] = useState<StorageRoot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  // Extract magnet parameter from URL if opened via PWA protocol handler
  const magnetParam = new URLSearchParams(location.search).get("magnet");

  useEffect(() => {
    if (magnetParam && location.pathname !== "/torrents") {
      navigate(`/torrents?magnet=${encodeURIComponent(magnetParam)}`, { replace: true });
    }
  }, [magnetParam, location.pathname, navigate]);

  // Modals
  const [activeVideo, setActiveVideo] = useState<FileItem | null>(null);
  const [detailMovie, setDetailMovie] = useState<FileItem | null>(null);

  const loadSystemInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/system/info");
      const data = await res.json();
      if (data.success && data.info) {
        setSystemInfo(data.info);
        setStorageRoots(data.info.storageRoots || []);
      }
    } catch (err) {
      console.error("[App] Erro ao carregar informações do sistema:", err);
    }
  }, []);

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  return (
    <AudioProvider>
      <div className="min-h-screen bg-[#0c0c0e] text-neutral-100 flex flex-col font-sans">
        {/* Top Navbar */}
        <Navbar
          systemInfo={systemInfo}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Main Content Router */}
        <main className="flex-1 pb-20">
          <Routes>
            <Route
              path="/"
              element={
                <MovieMode
                  searchQuery={searchQuery}
                  onPlayMovie={(movie) => setActiveVideo(movie)}
                  onOpenDetails={(movie) => setDetailMovie(movie)}
                />
              }
            />
            <Route
              path="/explorador"
              element={
                <FileExplorer
                  storageRoots={storageRoots}
                  onPlayVideo={(file) => setActiveVideo(file)}
                  onRefreshRoots={loadSystemInfo}
                />
              }
            />
            <Route
              path="/torrents"
              element={
                <TorrentManager
                  storageRoots={storageRoots}
                  onPlayVideo={(file) => setActiveVideo(file)}
                  initialMagnet={magnetParam || undefined}
                />
              }
            />
            <Route
              path="/armazenamento"
              element={
                <StorageSettings
                  storageRoots={storageRoots}
                  systemInfo={systemInfo}
                  onRefresh={loadSystemInfo}
                />
              }
            />
          </Routes>
        </main>

        {/* Persistent Audio Player (Miniplayer / Full View) */}
        <AudioPlayer />

        {/* Fullscreen Video Player */}
        {activeVideo && (
          <VideoPlayer
            file={activeVideo}
            onClose={() => {
              setActiveVideo(null);
              loadSystemInfo();
            }}
            onNextEpisode={(next) => setActiveVideo(next)}
          />
        )}

        {/* Movie Detail Modal */}
        {detailMovie && (
          <MovieDetailModal
            file={detailMovie}
            storageRoots={storageRoots}
            onClose={() => setDetailMovie(null)}
            onPlay={(movie) => {
              setDetailMovie(null);
              setActiveVideo(movie);
            }}
            onFileDeleted={() => {
              setDetailMovie(null);
              loadSystemInfo();
            }}
            onFileMoved={() => {
              setDetailMovie(null);
              loadSystemInfo();
            }}
          />
        )}
      </div>
    </AudioProvider>
  );
};

export default App;
