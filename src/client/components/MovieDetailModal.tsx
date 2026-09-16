import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Download,
  Trash2,
  HardDrive,
  Clock,
  FileVideo,
  Folder,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import type { FileItem } from "../../types";
import { formatBytes, formatSeconds, formatDate } from "../utils/format";

interface MovieDetailModalProps {
  file: FileItem | null;
  onClose: () => void;
  onPlay: (file: FileItem) => void;
  onFileDeleted?: (fileId: string) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  file,
  onClose,
  onPlay,
  onFileDeleted,
}) => {
  const [detailData, setDetailData] = useState<{
    siblings: FileItem[];
    hasSubtitle: boolean;
  }>({ siblings: [], hasSubtitle: false });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!file) return;
    fetch(`/api/media/detail/${file.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDetailData({
            siblings: data.siblings || [],
            hasSubtitle: data.hasSubtitle || false,
          });
        }
      })
      .catch(() => {});
  }, [file]);

  if (!file) return null;

  const handleResetProgress = async () => {
    try {
      await fetch(`/api/media/progress/${file.id}`, { method: "DELETE" });
      if (file.watchProgress) {
        file.watchProgress = undefined;
      }
      onClose();
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (onFileDeleted) onFileDeleted(file.id);
        onClose();
      } else {
        alert(data.error || "Erro ao excluir arquivo");
      }
    } catch (err: any) {
      alert("Erro ao excluir arquivo: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header Preview Image */}
        <div className="relative aspect-video w-full max-h-72 bg-neutral-950 overflow-hidden flex-none">
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-white backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Quick Play button floating */}
          <div className="absolute bottom-4 left-6 flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onPlay(file);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/30 transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{file.watchProgress && !file.watchProgress.completed ? "Continuar Assistindo" : "Assistir"}</span>
            </button>

            <a
              href={file.downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 hover:text-white text-sm font-semibold rounded-xl backdrop-blur-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Baixar</span>
            </a>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Title & Storage Details */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{cleanTitle}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-400">
              <span className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 rounded-md text-neutral-300 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-red-500" />
                {file.storageName}
              </span>
              <span className="uppercase font-bold text-neutral-300 bg-neutral-800/60 px-2 py-1 rounded">
                {file.extension.replace(".", "")}
              </span>
              <span>{formatBytes(file.size)}</span>
              <span>• Atualizado em {formatDate(file.updatedAt)}</span>
              {detailData.hasSubtitle && (
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                  Legenda Disponível
                </span>
              )}
            </div>
          </div>

          {/* Watch Progress Bar */}
          {file.watchProgress && (
            <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-neutral-400 mb-1.5">
                  <span className="font-semibold text-neutral-300">Progresso</span>
                  <span>{file.watchProgress.percentage}% assistido</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{ width: `${file.watchProgress.percentage}%` }}
                  />
                </div>
              </div>
              <button
                onClick={handleResetProgress}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Reiniciar progresso de onde parou"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            </div>
          )}

          {/* Path info */}
          <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800/60 text-xs font-mono text-neutral-400 flex items-start gap-2 break-all">
            <Folder className="w-4 h-4 text-neutral-500 flex-none mt-0.5" />
            <div>
              <span className="text-neutral-500 font-sans block mb-0.5 text-[11px]">Caminho no servidor:</span>
              <span className="text-neutral-300">{file.fullPath}</span>
            </div>
          </div>

          {/* Episodes / Sibling Files */}
          {detailData.siblings.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-red-500" />
                <span>Outros episódios e vídeos na mesma pasta ({detailData.siblings.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {detailData.siblings.map((sib) => (
                  <div
                    key={sib.id}
                    onClick={() => {
                      onClose();
                      onPlay(sib);
                    }}
                    className="flex items-center justify-between p-2.5 bg-neutral-950 hover:bg-neutral-800 rounded-lg border border-neutral-800/60 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Play className="w-3.5 h-3.5 text-neutral-500 group-hover:text-red-500 flex-none" />
                      <span className="text-xs text-neutral-300 truncate font-medium group-hover:text-white">
                        {sib.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono flex-none ml-2">
                      {formatBytes(sib.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete Action footer */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                confirmDelete
                  ? "bg-rose-700 text-white hover:bg-rose-800"
                  : "text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{confirmDelete ? "Confirmar exclusão permanente do disco?" : "Excluir arquivo"}</span>
            </button>

            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
