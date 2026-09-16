import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  HardDrive,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  File,
  Plus,
  Upload,
  RefreshCw,
  LayoutGrid,
  List,
  Download,
  Trash2,
  Edit2,
  ChevronRight,
  Search,
  Play,
  Eye,
  FolderInput,
  ListMusic,
  ListPlus,
} from "lucide-react";
import type { FileItem, StorageRoot, MediaType } from "../../types";
import { formatBytes, formatDate } from "../utils/format";
import { FileUploader } from "./FileUploader";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { MoveModal } from "./MoveModal";
import { PlaylistModal } from "./PlaylistModal";
import { useAudio } from "../context/AudioContext";

interface FileExplorerProps {
  storageRoots: StorageRoot[];
  onPlayVideo: (file: FileItem) => void;
  onRefreshRoots: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  storageRoots,
  onPlayVideo,
  onRefreshRoots,
}) => {
  const [currentStorageId, setCurrentStorageId] = useState<string | null>(
    storageRoots[0]?.id || null
  );
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string; storageId: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mediaFilter, setMediaFilter] = useState<"all" | MediaType>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Modals state
  const [showUploader, setShowUploader] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [movingItem, setMovingItem] = useState<FileItem | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<FileItem | null>(null);

  const { playFolder, playTrack } = useAudio();

  // New folder & Rename prompts
  const [newFolderPrompt, setNewFolderPrompt] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingItem, setRenamingItem] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState("");

  const currentStorage = storageRoots.find((r) => r.id === currentStorageId) || null;

  // Load folder items
  const loadDirectory = useCallback(async (storageId: string | null, folderPath: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (storageId) params.append("storageId", storageId);
      params.append("path", folderPath);

      const res = await fetch(`/api/files/browse?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setBreadcrumbs(data.breadcrumbs || []);
        setCurrentPath(data.currentPath || "/");
      }
    } catch (err) {
      console.error("[Explorer] Erro ao carregar diretório:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(currentStorageId, currentPath);
  }, [currentStorageId, currentPath, loadDirectory]);

  // Navigate to folder
  const handleItemClick = (item: FileItem) => {
    if (item.isDirectory) {
      // If clicked from top-level roots view
      if (!currentStorageId && item.storageId) {
        setCurrentStorageId(item.storageId);
        setCurrentPath("/");
      } else {
        setCurrentPath(item.relativePath);
      }
    } else {
      // File clicked
      if (item.mediaType === "video") {
        onPlayVideo(item);
      } else if (item.mediaType === "audio") {
        const audioTracks = filteredItems.filter((f) => f.mediaType === "audio" && !f.isDirectory);
        const idx = audioTracks.findIndex((f) => f.id === item.id);
        playFolder(audioTracks, idx >= 0 ? idx : 0);
      } else {
        setPreviewFile(item);
      }
    }
  };

  // Breadcrumb click
  const handleBreadcrumbClick = (bc: { name: string; path: string; storageId: string | null }) => {
    setCurrentStorageId(bc.storageId);
    setCurrentPath(bc.path);
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStorageId || !newFolderName.trim()) return;

    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageId: currentStorageId,
          parentPath: currentPath,
          folderName: newFolderName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewFolderName("");
        setNewFolderPrompt(false);
        loadDirectory(currentStorageId, currentPath);
      } else {
        alert(data.error || "Erro ao criar pasta");
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  // Rename item
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !newName.trim()) return;

    try {
      const res = await fetch("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: renamingItem.id,
          newName: newName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRenamingItem(null);
        setNewName("");
        loadDirectory(currentStorageId, currentPath);
      } else {
        alert(data.error || "Erro ao renomear");
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  // Delete item
  const handleDeleteItem = async (item: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Tem certeza que deseja excluir permanentemente "${item.name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadDirectory(currentStorageId, currentPath);
      } else {
        alert(data.error || "Erro ao excluir arquivo");
      }
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    // If directory, always show
    if (item.isDirectory) return true;

    // Filter by type
    if (mediaFilter !== "all" && item.mediaType !== mediaFilter) return false;

    // Filter by search
    if (searchFilter && !item.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }

    return true;
  });

  const getItemIcon = (item: FileItem) => {
    if (item.isDirectory) return <Folder className="w-6 h-6 text-amber-500 fill-amber-500/20" />;
    switch (item.mediaType) {
      case "video": return <Film className="w-6 h-6 text-red-500" />;
      case "image": return <ImageIcon className="w-6 h-6 text-purple-400" />;
      case "audio": return <Music className="w-6 h-6 text-emerald-400" />;
      case "document": return <FileText className="w-6 h-6 text-blue-400" />;
      default: return <File className="w-6 h-6 text-neutral-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      {/* Explorer Layout: Sidebar + Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar: Disks / Storage Roots */}
        <aside className="lg:col-span-1 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-red-500" />
              <span>Unidades de Armazenamento</span>
            </h3>
            <span className="text-xs text-neutral-500 font-mono">({storageRoots.length})</span>
          </div>

          <div className="space-y-1.5">
            {/* Top-Level All Disks Option */}
            <button
              onClick={() => {
                setCurrentStorageId(null);
                setCurrentPath("/");
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentStorageId === null
                  ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                  : "text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <HardDrive className="w-4 h-4 flex-none" />
                <span className="truncate">Todos os Discos</span>
              </div>
            </button>

            {storageRoots.map((root) => {
              const isSelected = currentStorageId === root.id;
              return (
                <button
                  key={root.id}
                  onClick={() => {
                    setCurrentStorageId(root.id);
                    setCurrentPath("/");
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isSelected
                      ? "bg-neutral-800 text-white border border-neutral-700 shadow-md"
                      : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`w-4 h-4 flex-none ${isSelected ? "text-red-500" : "text-neutral-500"}`} />
                      <span className="truncate text-white font-medium">{root.name}</span>
                    </div>
                    {root.fileCount !== undefined && (
                      <span className="text-[10px] text-neutral-500 font-mono">{root.fileCount}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-500 truncate mt-1 font-mono pl-6" title={root.path}>
                    {root.path}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Explorer Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Breadcrumbs Navigation Bar */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-medium">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-600 flex-none" />}
                  <button
                    onClick={() => handleBreadcrumbClick(bc)}
                    className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                      idx === breadcrumbs.length - 1
                        ? "text-white font-bold bg-neutral-800"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                    }`}
                  >
                    {bc.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Action Buttons: Play Folder, Playlists, New Folder, Upload */}
            <div className="flex items-center gap-2">
              {filteredItems.filter((f) => f.mediaType === "audio" && !f.isDirectory).length > 0 && (
                <button
                  onClick={() => {
                    const audios = filteredItems.filter((f) => f.mediaType === "audio" && !f.isDirectory);
                    playFolder(audios, 0);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all"
                  title="Tocar todas as músicas desta pasta em sequência"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tocar Pasta ({filteredItems.filter((f) => f.mediaType === "audio" && !f.isDirectory).length})</span>
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedTrackForPlaylist(null);
                  setShowPlaylistModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 hover:text-emerald-300 border border-neutral-700/80 text-xs font-semibold rounded-xl transition-all"
                title="Minhas Playlists"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Playlists</span>
              </button>

              {currentStorageId && (
                <>
                  <button
                    onClick={() => setNewFolderPrompt(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Nova Pasta</span>
                  </button>

                  <button
                    onClick={() => setShowUploader(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </>
              )}

              <button
                onClick={() => loadDirectory(currentStorageId, currentPath)}
                className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                title="Recarregar pasta"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filter & View Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Media Type Filter Pills */}
            <div className="flex items-center gap-1.5 bg-neutral-900/60 p-1 rounded-xl border border-neutral-800/80">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "video", label: "Vídeos" },
                  { id: "image", label: "Fotos" },
                  { id: "audio", label: "Áudios" },
                  { id: "document", label: "Documentos" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMediaFilter(f.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    mediaFilter === f.id
                      ? "bg-neutral-800 text-white font-bold shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Right Controls: Search in folder & View Mode (Grid/List) */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-red-500 w-32 sm:w-44"
                />
              </div>

              <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "grid" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
                  }`}
                  title="Visualização em Grade"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "list" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
                  }`}
                  title="Visualização em Lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* New Folder Inline Modal / Prompt */}
          {newFolderPrompt && (
            <form
              onSubmit={handleCreateFolder}
              className="bg-neutral-900 p-4 rounded-2xl border border-red-500/50 flex items-center gap-3 animate-in fade-in"
            >
              <Folder className="w-5 h-5 text-amber-500 flex-none" />
              <input
                type="text"
                autoFocus
                placeholder="Nome da nova pasta..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setNewFolderPrompt(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </form>
          )}

          {/* Renaming Prompt */}
          {renamingItem && (
            <form
              onSubmit={handleRename}
              className="bg-neutral-900 p-4 rounded-2xl border border-blue-500/50 flex items-center gap-3 animate-in fade-in"
            >
              <Edit2 className="w-5 h-5 text-blue-400 flex-none" />
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </form>
          )}

          {/* Items Container */}
          {filteredItems.length === 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-12 text-center">
              <Folder className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h4 className="text-base font-bold text-neutral-300">Esta pasta está vazia</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Envie arquivos arrastando e soltando ou clique no botão &quot;Enviar&quot; acima para carregar conteúdos neste volume.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="group relative bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between"
                >
                  {/* Thumbnail / Icon Display */}
                  <div className="aspect-video w-full bg-neutral-950 flex items-center justify-center relative overflow-hidden">
                    {item.mediaType === "video" ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : item.mediaType === "image" ? (
                      <img
                        src={item.downloadUrl}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="transform group-hover:scale-110 transition-transform">
                        {getItemIcon(item)}
                      </div>
                    )}

                    {/* Center play icon for video and audio */}
                    {item.mediaType === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity pointer-events-none z-10">
                        <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    )}
                    {item.mediaType === "audio" && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity pointer-events-none z-10">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Quick action buttons on hover (z-20 to stay firmly above any overlay) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      {item.mediaType === "audio" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrackForPlaylist(item);
                            setShowPlaylistModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-neutral-900/95 hover:bg-neutral-800 text-emerald-400 hover:text-white border border-neutral-700/60 shadow-md transition-colors"
                          title="Adicionar à Playlist"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!item.isDirectory && (
                        <a
                          href={item.downloadUrl}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 shadow-md transition-colors"
                          title="Baixar arquivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingItem(item);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 shadow-md transition-colors"
                        title="Mover para outra pasta ou disco"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingItem(item);
                          setNewName(item.name);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 shadow-md transition-colors"
                        title="Renomear"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteItem(item, e)}
                        className="p-1.5 rounded-lg bg-neutral-900/95 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-900/60 shadow-md transition-colors"
                        title="Excluir do disco"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-3">
                    <h5 className="text-xs font-semibold text-white truncate" title={item.name}>
                      {item.name}
                    </h5>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mt-1">
                      <span>{item.isDirectory ? "Pasta" : formatBytes(item.size)}</span>
                      <span>{formatDate(item.updatedAt).split(" ")[0]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-neutral-400">
                <thead className="bg-neutral-950/60 border-b border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="p-3.5">Nome</th>
                    <th className="p-3.5 hidden sm:table-cell">Tamanho</th>
                    <th className="p-3.5 hidden md:table-cell">Modificado em</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="hover:bg-neutral-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="p-3.5 flex items-center gap-3">
                        <div className="flex-none">{getItemIcon(item)}</div>
                        <span className="font-semibold text-white truncate max-w-xs sm:max-w-md group-hover:text-red-400 transition-colors">
                          {item.name}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono hidden sm:table-cell">
                        {item.isDirectory ? "-" : formatBytes(item.size)}
                      </td>
                      <td className="p-3.5 font-mono hidden md:table-cell">
                        {formatDate(item.updatedAt)}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {item.mediaType === "audio" && (
                            <button
                              onClick={() => {
                                setSelectedTrackForPlaylist(item);
                                setShowPlaylistModal(true);
                              }}
                              className="p-1.5 hover:bg-neutral-800 rounded-lg text-emerald-400 hover:text-emerald-300"
                              title="Adicionar à Playlist"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!item.isDirectory && (
                            <a
                              href={item.downloadUrl}
                              download
                              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
                              title="Baixar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => setMovingItem(item)}
                            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
                            title="Mover para outra pasta ou disco"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setRenamingItem(item);
                              setNewName(item.name);
                            }}
                            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white"
                            title="Renomear"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteItem(item, e)}
                            className="p-1.5 hover:bg-rose-950/60 rounded-lg text-rose-400 hover:text-rose-300"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upload Drawer / Modal */}
      {showUploader && (
        <FileUploader
          storageId={currentStorageId}
          storageName={currentStorage?.name || "Armazenamento"}
          targetPath={currentPath}
          onClose={() => setShowUploader(false)}
          onUploadComplete={() => {
            loadDirectory(currentStorageId, currentPath);
            onRefreshRoots();
          }}
        />
      )}

      {/* Preview Modal for Images / Audios / Text */}
      {previewFile && (
        <MediaPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Move File / Folder Modal */}
      {movingItem && (
        <MoveModal
          file={movingItem}
          storageRoots={storageRoots}
          onClose={() => setMovingItem(null)}
          onMoveSuccess={() => {
            loadDirectory(currentStorageId, currentPath);
            onRefreshRoots();
          }}
        />
      )}

      {/* Playlist Manager / Add Modal */}
      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => {
          setShowPlaylistModal(false);
          setSelectedTrackForPlaylist(null);
        }}
        trackToAdd={selectedTrackForPlaylist}
      />
    </div>
  );
};
