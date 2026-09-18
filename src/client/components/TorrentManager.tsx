import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Download,
  Upload,
  Pause,
  Play,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  HardDrive,
  Folder,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Film,
  ExternalLink,
  Magnet,
  Layers,
  Sparkles,
  Check,
} from "lucide-react";
import type { TorrentItem, StorageRoot, FileItem } from "../../types";
import { formatBytes, formatSpeed, formatEta, formatDate } from "../utils/format";
import { AddTorrentModal } from "./AddTorrentModal";

interface TorrentManagerProps {
  storageRoots: StorageRoot[];
  onPlayVideo?: (file: FileItem) => void;
  initialMagnet?: string;
}

export const TorrentManager: React.FC<TorrentManagerProps> = ({
  storageRoots,
  onPlayVideo,
  initialMagnet,
}) => {
  const [torrents, setTorrents] = useState<TorrentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "downloading" | "completed" | "paused">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(Boolean(initialMagnet));
  const [pendingMagnet, setPendingMagnet] = useState(initialMagnet || "");
  const [expandedTorrent, setExpandedTorrent] = useState<string | null>(null);

  // Delete modal state
  const [torrentToDelete, setTorrentToDelete] = useState<TorrentItem | null>(null);
  const [deleteDiskFiles, setDeleteDiskFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Protocol handler registration feedback
  const [protocolRegistered, setProtocolRegistered] = useState(false);

  const fetchTorrents = useCallback(async () => {
    try {
      const res = await fetch("/api/torrents");
      const data = await res.json();
      if (data.success && Array.isArray(data.torrents)) {
        setTorrents(data.torrents);
      }
    } catch (err) {
      console.error("[TorrentManager] Erro ao carregar torrents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 1500);
    return () => clearInterval(interval);
  }, [fetchTorrents]);

  useEffect(() => {
    if (initialMagnet) {
      setPendingMagnet(initialMagnet);
      setIsAddModalOpen(true);
    }
  }, [initialMagnet]);

  const handleRegisterProtocol = () => {
    if (typeof window !== "undefined" && "registerProtocolHandler" in navigator) {
      try {
        const handlerUrl = `${window.location.origin}/torrents?magnet=%s`;
        (navigator as any).registerProtocolHandler("magnet", handlerUrl);
        setProtocolRegistered(true);
        setTimeout(() => setProtocolRegistered(false), 3500);
      } catch (err) {
        console.warn("[PWA] Erro ao registrar manipulador de protocolo:", err);
      }
    }
  };

  const handlePause = async (infoHash: string) => {
    try {
      await fetch(`/api/torrents/${infoHash}/pause`, { method: "POST" });
      fetchTorrents();
    } catch (err) {
      console.error("[TorrentManager] Erro ao pausar:", err);
    }
  };

  const handleResume = async (infoHash: string) => {
    try {
      await fetch(`/api/torrents/${infoHash}/resume`, { method: "POST" });
      fetchTorrents();
    } catch (err) {
      console.error("[TorrentManager] Erro ao retomar:", err);
    }
  };

  const confirmDelete = async () => {
    if (!torrentToDelete) return;
    setIsDeleting(true);
    try {
      await fetch(
        `/api/torrents/${torrentToDelete.infoHash}?deleteFiles=${deleteDiskFiles}`,
        { method: "DELETE" }
      );
      setTorrentToDelete(null);
      setDeleteDiskFiles(false);
      fetchTorrents();
    } catch (err) {
      console.error("[TorrentManager] Erro ao excluir torrent:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Aggregated stats
  const totalDownloadSpeed = useMemo(() => {
    return torrents.reduce((acc, t) => acc + (t.downloadSpeed || 0), 0);
  }, [torrents]);

  const totalUploadSpeed = useMemo(() => {
    return torrents.reduce((acc, t) => acc + (t.uploadSpeed || 0), 0);
  }, [torrents]);

  const activeCount = useMemo(() => {
    return torrents.filter((t) => t.status === "downloading" || t.status === "metadata").length;
  }, [torrents]);

  const completedCount = useMemo(() => {
    return torrents.filter((t) => t.status === "completed").length;
  }, [torrents]);

  // Filtered list
  const filteredTorrents = useMemo(() => {
    return torrents.filter((t) => {
      // Status filter
      if (activeFilter === "downloading" && t.status !== "downloading" && t.status !== "metadata") return false;
      if (activeFilter === "completed" && t.status !== "completed") return false;
      if (activeFilter === "paused" && t.status !== "paused") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.infoHash.toLowerCase().includes(q) ||
          (t.targetFolder && t.targetFolder.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [torrents, activeFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Host Torrent Engine
            </span>
            <span className="text-xs text-neutral-500">• Rede LAN & Nuvem</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            Gerenciador de Torrents
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Baixe filmes, séries e arquivos via BitTorrent direto para os discos do seu servidor LAN
          </p>
        </div>

        {/* Top Actions: Add & PWA Association */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRegisterProtocol}
            title="Abrir links magnet do navegador diretamente no OffliNet"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
              protocolRegistered
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-neutral-900/80 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            {protocolRegistered ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Registrado no Navegador</span>
              </>
            ) : (
              <>
                <Magnet className="w-4 h-4 text-amber-400" />
                <span>Associar Links Magnet (PWA)</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setPendingMagnet("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Adicionar Torrent</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Download */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-none">
            <Download className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Download Atual
            </span>
            <span className="text-lg sm:text-xl font-black text-white truncate block">
              {formatSpeed(totalDownloadSpeed)}
            </span>
          </div>
        </div>

        {/* Total Upload */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-none">
            <Upload className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Upload Atual
            </span>
            <span className="text-lg sm:text-xl font-black text-white truncate block">
              {formatSpeed(totalUploadSpeed)}
            </span>
          </div>
        </div>

        {/* Active Downloads */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-none">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Downloads Ativos
            </span>
            <span className="text-lg sm:text-xl font-black text-white block">
              {activeCount}
            </span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-300 flex-none">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Concluídos
            </span>
            <span className="text-lg sm:text-xl font-black text-white block">
              {completedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-2.5">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Todos ({torrents.length})
          </button>
          <button
            onClick={() => setActiveFilter("downloading")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === "downloading"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Baixando ({activeCount})
          </button>
          <button
            onClick={() => setActiveFilter("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === "completed"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Concluídos ({completedCount})
          </button>
          <button
            onClick={() => setActiveFilter("paused")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === "paused"
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Pausados ({torrents.filter((t) => t.status === "paused").length})
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou pasta..."
            className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Torrents List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto opacity-75" />
          <p className="text-xs text-neutral-400">Consultando torrents no servidor...</p>
        </div>
      ) : filteredTorrents.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-neutral-900/30 border border-dashed border-neutral-800 rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400 mx-auto">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Nenhum torrent encontrado</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? "Nenhum download corresponde aos termos buscados."
                : "Adicione um link magnet ou faça upload de um arquivo .torrent para começar a baixar mídias."}
            </p>
          </div>
          <button
            onClick={() => {
              setPendingMagnet("");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar Primeiro Torrent
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTorrents.map((torrent) => {
            const isExpanded = expandedTorrent === torrent.infoHash;
            const percent = Math.min(100, Math.round((torrent.progress || 0) * 100));
            const isCompleted = torrent.status === "completed";
            const isPaused = torrent.status === "paused";
            const isMetadata = torrent.status === "metadata";
            const isError = torrent.status === "error";

            return (
              <div
                key={torrent.infoHash}
                className="bg-neutral-900/80 border border-neutral-800/90 hover:border-neutral-700/90 rounded-2xl p-4 sm:p-5 transition-all shadow-md space-y-3.5 group"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none border shadow-inner ${
                        isCompleted
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : isPaused
                          ? "bg-neutral-800 border-neutral-700 text-neutral-400"
                          : isError
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isPaused ? (
                        <Pause className="w-5 h-5" />
                      ) : isError ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <Download className="w-5 h-5 animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xl" title={torrent.name}>
                          {torrent.name}
                        </h3>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isCompleted
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : isPaused
                              ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                              : isError
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : isMetadata
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                          }`}
                        >
                          {isCompleted
                            ? "Concluído"
                            : isPaused
                            ? "Pausado"
                            : isError
                            ? "Erro"
                            : isMetadata
                            ? "Buscando Metadados..."
                            : "Baixando"}
                        </span>
                      </div>

                      {/* Details row (Storage, Folder, Size) */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mt-1">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
                          {torrent.storageName || "Armazenamento"}
                        </span>
                        {torrent.targetFolder && (
                          <span className="flex items-center gap-1 text-neutral-400">
                            <Folder className="w-3.5 h-3.5 text-neutral-500" />
                            {torrent.targetFolder}
                          </span>
                        )}
                        <span>
                          {formatBytes(torrent.downloadedBytes)} de {formatBytes(torrent.totalSize)}
                        </span>
                        {torrent.numPeers > 0 && (
                          <span className="text-neutral-400">
                            {torrent.numPeers} {torrent.numPeers === 1 ? "par" : "pares"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Pause / Resume */}
                    {!isCompleted && !isError && (
                      <button
                        onClick={() => (isPaused ? handleResume(torrent.infoHash) : handlePause(torrent.infoHash))}
                        className="p-2 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-200 hover:text-white transition-colors"
                        title={isPaused ? "Retomar download" : "Pausar download"}
                      >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => setTorrentToDelete(torrent)}
                      className="p-2 rounded-xl bg-neutral-800/90 hover:bg-red-500/20 border border-neutral-700/60 text-neutral-400 hover:text-red-400 transition-colors"
                      title="Excluir torrent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Expand/Collapse files */}
                    {torrent.files && torrent.files.length > 0 && (
                      <button
                        onClick={() => setExpandedTorrent(isExpanded ? null : torrent.infoHash)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700/60 text-xs text-neutral-300 transition-colors"
                        title="Ver arquivos do torrent"
                      >
                        <span>{torrent.files.length} arq.</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800/60">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isCompleted
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                          : isPaused
                          ? "bg-neutral-600"
                          : "bg-gradient-to-r from-amber-600 to-amber-400"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Progress info & Speeds */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-neutral-200">{percent}%</span>
                      {!isCompleted && !isPaused && torrent.downloadSpeed > 0 && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          ↓ {formatSpeed(torrent.downloadSpeed)}
                        </span>
                      )}
                      {!isCompleted && !isPaused && torrent.uploadSpeed > 0 && (
                        <span className="text-blue-400 flex items-center gap-1">
                          ↑ {formatSpeed(torrent.uploadSpeed)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && !isPaused && torrent.timeRemaining > 0 && (
                        <span className="text-neutral-400">
                          {formatEta(Math.round(torrent.timeRemaining / 1000))}
                        </span>
                      )}
                      {isCompleted && torrent.completedAt && (
                        <span className="text-neutral-500 font-sans">
                          Concluído em {formatDate(torrent.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Files Accordion */}
                {isExpanded && torrent.files && torrent.files.length > 0 && (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2 animate-in fade-in duration-200">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Arquivos do Pacote ({torrent.files.length})
                    </span>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {torrent.files.map((file, idx) => {
                        const filePercent = Math.min(100, Math.round((file.progress || 0) * 100));
                        const isVideo = file.name.match(/\.(mp4|mkv|webm|avi|mov)$/i);

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isVideo ? (
                                <Film className="w-3.5 h-3.5 text-red-400 flex-none" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-neutral-500 flex-none" />
                              )}
                              <span className="text-neutral-300 truncate font-mono text-[11px]" title={file.name}>
                                {file.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 flex-none">
                              <span className="text-neutral-500 text-[11px]">
                                {formatBytes(file.length)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  filePercent === 100
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-neutral-800 text-neutral-400"
                                }`}
                              >
                                {filePercent}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Torrent Modal */}
      <AddTorrentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTorrentAdded={() => fetchTorrents()}
        initialMagnet={pendingMagnet}
        storageRoots={storageRoots}
      />

      {/* Delete Confirmation Modal */}
      {torrentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setTorrentToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400 pb-2 border-b border-neutral-800">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remover Torrent</h3>
                <p className="text-xs text-neutral-400">Confirmar exclusão da fila do host</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Você tem certeza de que deseja remover o download de{" "}
              <strong className="text-white font-bold">{torrentToDelete.name}</strong>?
            </p>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteDiskFiles}
                onChange={(e) => setDeleteDiskFiles(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-700 text-red-500 focus:ring-red-500 bg-neutral-900"
              />
              <span>Excluir também os arquivos baixados do disco rígido</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTorrentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20 transition-all active:scale-95"
              >
                {isDeleting ? "Removendo..." : "Confirmar Remoção"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
