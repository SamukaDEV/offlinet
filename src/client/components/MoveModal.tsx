import React, { useState, useEffect } from "react";
import {
  FolderInput,
  X,
  HardDrive,
  Folder,
  CheckCircle,
  AlertCircle,
  Loader2,
  FolderPlus,
  ArrowRight,
} from "lucide-react";
import type { FileItem, StorageRoot } from "../../types";
import { formatBytes } from "../utils/format";

interface MoveModalProps {
  file: FileItem | null;
  storageRoots: StorageRoot[];
  onClose: () => void;
  onMoveSuccess: () => void;
}

interface TargetFolderOption {
  relativePath: string;
  name: string;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  file,
  storageRoots,
  onClose,
  onMoveSuccess,
}) => {
  const [selectedStorageId, setSelectedStorageId] = useState<string>(
    file?.storageId || storageRoots[0]?.id || ""
  );
  const [selectedFolder, setSelectedFolder] = useState<string>("/");
  const [folders, setFolders] = useState<TargetFolderOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New subfolder option
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");

  // Load target storage folders
  useEffect(() => {
    if (!selectedStorageId) return;

    setLoadingFolders(true);
    fetch(`/api/files/folders?storageId=${selectedStorageId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.folders) {
          setFolders(data.folders);
          // Default to root if current folder not in list
          if (!data.folders.some((f: TargetFolderOption) => f.relativePath === selectedFolder)) {
            setSelectedFolder("/");
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar pastas de destino:", err);
      })
      .finally(() => {
        setLoadingFolders(false);
      });
  }, [selectedStorageId]);

  if (!file) return null;

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsMoving(true);

    try {
      let finalTargetFolder = selectedFolder === "/" ? "" : selectedFolder;

      // If user wants to create a new subfolder in destination
      if (showNewFolderInput && newSubfolderName.trim()) {
        finalTargetFolder = finalTargetFolder
          ? `${finalTargetFolder}/${newSubfolderName.trim()}`
          : newSubfolderName.trim();
      }

      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          targetStorageId: selectedStorageId,
          targetParentPath: finalTargetFolder,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onMoveSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || "Erro ao mover arquivo");
      }
    } catch (err: any) {
      setErrorMsg("Falha na requisição: " + err.message);
    } finally {
      setIsMoving(false);
    }
  };

  const currentStorageName =
    storageRoots.find((r) => r.id === file.storageId)?.name || file.storageName || "Volume Atual";
  const targetStorage = storageRoots.find((r) => r.id === selectedStorageId);
  const isCrossDrive = file.storageId !== selectedStorageId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mover Arquivo / Pasta</h3>
              <p className="text-xs text-neutral-400">Transfira entre pastas ou discos diferentes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleMove} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* File Card info */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 flex items-center justify-between gap-3">
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Item a ser movido</span>
              <h4 className="text-sm font-bold text-white truncate">{file.name}</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {formatBytes(file.size)} • {file.storageName} {file.relativePath ? `(${file.relativePath})` : ""}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-none text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Target Storage Volume */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-red-500" />
              <span>1. Escolha o Volume / Disco de Destino:</span>
            </label>
            <select
              value={selectedStorageId}
              onChange={(e) => setSelectedStorageId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
            >
              {storageRoots.map((root) => (
                <option key={root.id} value={root.id}>
                  {root.name} ({root.path})
                </option>
              ))}
            </select>
          </div>

          {/* Target Folder Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Escolha a Pasta de Destino:</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1 font-semibold"
              >
                <FolderPlus className="w-3 h-3" />
                <span>{showNewFolderInput ? "Usar pasta existente" : "+ Criar nova pasta"}</span>
              </button>
            </div>

            {loadingFolders ? (
              <div className="py-2 text-neutral-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando pastas...</span>
              </div>
            ) : (
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-red-500"
              >
                {folders.map((f) => (
                  <option key={f.relativePath} value={f.relativePath}>
                    {f.relativePath === "/" ? "📁 / (Raiz do volume)" : `📁 /${f.relativePath}`}
                  </option>
                ))}
              </select>
            )}

            {/* Optional New Subfolder input */}
            {showNewFolderInput && (
              <div className="mt-2 pl-2 border-l-2 border-red-500 space-y-1">
                <label className="text-[11px] text-neutral-400 block font-medium">
                  Nome da nova subpasta dentro de &quot;{selectedFolder}&quot;:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nova Categoria"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-red-500"
                />
              </div>
            )}
          </div>

          {/* Cross-drive Notice */}
          {isCrossDrive && (
            <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex items-center gap-2.5 text-neutral-400 text-[11px]">
              <ArrowRight className="w-4 h-4 text-blue-400 flex-none" />
              <div>
                <span className="text-white font-semibold block">Transferência entre Unidades</span>
                <span>
                  O arquivo será transferido de <strong>{currentStorageName}</strong> para <strong>{targetStorage?.name}</strong> com preservação do seu histórico.
                </span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white transition-colors font-medium"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isMoving || loadingFolders}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all"
            >
              {isMoving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Movendo arquivo...</span>
                </>
              ) : (
                <>
                  <FolderInput className="w-4 h-4" />
                  <span>Mover para Cá</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
