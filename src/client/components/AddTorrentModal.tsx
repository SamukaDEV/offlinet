import React, { useState, useEffect } from "react";
import {
  X,
  Magnet,
  FileUp,
  HardDrive,
  Folder,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { StorageRoot } from "../../types";

interface AddTorrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTorrentAdded: () => void;
  initialMagnet?: string;
  storageRoots: StorageRoot[];
}

export const AddTorrentModal: React.FC<AddTorrentModalProps> = ({
  isOpen,
  onClose,
  onTorrentAdded,
  initialMagnet = "",
  storageRoots,
}) => {
  const [tab, setTab] = useState<"magnet" | "file">("magnet");
  const [magnetUri, setMagnetUri] = useState(initialMagnet);
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [selectedStorageId, setSelectedStorageId] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState("Filmes");
  const [customFolder, setCustomFolder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialMagnet) {
      setMagnetUri(initialMagnet);
      setTab("magnet");
    }
  }, [initialMagnet]);

  useEffect(() => {
    if (storageRoots.length > 0 && !selectedStorageId) {
      const active = storageRoots.find((r) => r.isActive) || storageRoots[0];
      setSelectedStorageId(active.id);
    }
  }, [storageRoots, selectedStorageId]);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith(".torrent")) {
        setTorrentFile(f);
        setTab("file");
        setError(null);
      } else {
        setError("Por favor, selecione um arquivo com extensão .torrent");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const folderToUse = targetFolder === "custom" ? customFolder.trim() : targetFolder;

    try {
      if (tab === "magnet") {
        if (!magnetUri.trim().startsWith("magnet:?")) {
          throw new Error("O link informado não parece ser um Magnet Link válido (deve iniciar com 'magnet:?')");
        }

        const res = await fetch("/api/torrents/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            magnetUri: magnetUri.trim(),
            storageId: selectedStorageId,
            targetFolder: folderToUse,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Falha ao adicionar download");
        }
      } else {
        if (!torrentFile) {
          throw new Error("Selecione um arquivo .torrent");
        }

        const formData = new FormData();
        formData.append("file", torrentFile);
        formData.append("storageId", selectedStorageId);
        formData.append("targetFolder", folderToUse);

        const res = await fetch("/api/torrents/add", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Falha ao adicionar arquivo .torrent");
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setMagnetUri("");
        setTorrentFile(null);
        onTorrentAdded();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao iniciar o download.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Adicionar Torrent</h3>
              <p className="text-xs text-neutral-400">Download direto no servidor OffliNet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex gap-2 p-1 bg-neutral-950/60 rounded-xl border border-neutral-800/80">
          <button
            type="button"
            onClick={() => setTab("magnet")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "magnet"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Magnet className="w-4 h-4" />
            Link Magnet
          </button>
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "file"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <FileUp className="w-4 h-4" />
            Arquivo .Torrent
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Area */}
          {tab === "magnet" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Magnet className="w-3.5 h-3.5 text-amber-400" />
                Magnet Link
              </label>
              <textarea
                rows={3}
                value={magnetUri}
                onChange={(e) => setMagnetUri(e.target.value)}
                placeholder="Cole aqui o link magnet:?xt=urn:btih:..."
                className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors resize-none font-mono"
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <FileUp className="w-3.5 h-3.5 text-amber-400" />
                Arquivo .torrent
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 rounded-2xl p-5 text-center transition-colors cursor-pointer bg-neutral-950/40 group"
                onClick={() => document.getElementById("torrent-file-input")?.click()}
              >
                <input
                  id="torrent-file-input"
                  type="file"
                  accept=".torrent"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setTorrentFile(e.target.files[0]);
                      setError(null);
                    }
                  }}
                />
                <FileUp className="w-8 h-8 text-neutral-500 group-hover:text-amber-400 mx-auto mb-2 transition-colors" />
                {torrentFile ? (
                  <div>
                    <span className="text-xs font-bold text-amber-400 block break-all">
                      {torrentFile.name}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {(torrentFile.size / 1024).toFixed(1)} KB - Clique para trocar
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-neutral-300 block">
                      Arraste e solte o arquivo .torrent aqui
                    </span>
                    <span className="text-[11px] text-neutral-500 block mt-0.5">
                      ou clique para selecionar do computador
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Destination Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Storage Root */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                Disco de Destino
              </label>
              <select
                value={selectedStorageId}
                onChange={(e) => setSelectedStorageId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                {storageRoots.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Folder Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-neutral-400" />
                Pasta de Destino
              </label>
              <select
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                <option value="Filmes">Filmes (Catálogo Cinema)</option>
                <option value="Series">Series (Catálogo Cinema)</option>
                <option value="Downloads">Downloads</option>
                <option value="">Raiz do Disco</option>
                <option value="custom">Outra pasta...</option>
              </select>
            </div>
          </div>

          {targetFolder === "custom" && (
            <div className="space-y-1">
              <input
                type="text"
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                placeholder="Ex: Animes ou Documentarios/2026"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-none" />
              <span>Download adicionado com sucesso! Iniciando conexão com a rede...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Iniciar Download
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
