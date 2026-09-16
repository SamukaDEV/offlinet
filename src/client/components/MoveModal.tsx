import React, { useState, useEffect, useCallback } from "react";
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
  ChevronRight,
  CornerLeftUp,
  Search,
  Check,
} from "lucide-react";
import type { FileItem, StorageRoot } from "../../types";
import { formatBytes } from "../utils/format";

interface MoveModalProps {
  file: FileItem | null;
  storageRoots: StorageRoot[];
  onClose: () => void;
  onMoveSuccess: () => void;
}

interface BreadcrumbItem {
  name: string;
  path: string;
  storageId: string | null;
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
  const [currentNavPath, setCurrentNavPath] = useState<string>("/");
  const [subfolders, setSubfolders] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Create folder inline
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [isMoving, setIsMoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load subfolders for target storage and path
  const loadDirectory = useCallback(async (storageId: string, folderPath: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/files/browse?storageId=${storageId}&path=${encodeURIComponent(folderPath)}`
      );
      const data = await res.json();
      if (data.success) {
        const dirs = (data.items || []).filter((i: FileItem) => i.isDirectory);
        setSubfolders(dirs);
        setBreadcrumbs(data.breadcrumbs || []);
        setCurrentNavPath(data.currentPath || "/");
      }
    } catch (err: any) {
      setErrorMsg("Erro ao carregar diretório: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // When storage changes, reset to root "/" and load
  useEffect(() => {
    if (selectedStorageId) {
      setCurrentNavPath("/");
      setSearchQuery("");
      setShowCreateFolder(false);
      loadDirectory(selectedStorageId, "/");
    }
  }, [selectedStorageId, loadDirectory]);

  if (!file) return null;

  const handleNavigate = (path: string) => {
    setSearchQuery("");
    setShowCreateFolder(false);
    loadDirectory(selectedStorageId, path);
  };

  const handleNavigateUp = () => {
    // If at root, do nothing
    if (currentNavPath === "/" || !breadcrumbs || breadcrumbs.length <= 2) {
      return;
    }
    // Previous breadcrumb before current
    const parentCrumb = breadcrumbs[breadcrumbs.length - 2];
    if (parentCrumb) {
      handleNavigate(parentCrumb.path);
    } else {
      handleNavigate("/");
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !selectedStorageId) return;

    setIsCreatingFolder(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageId: selectedStorageId,
          parentPath: currentNavPath,
          folderName: newFolderName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        const createdFolderName = newFolderName.trim();
        setNewFolderName("");
        setShowCreateFolder(false);

        // Calculate path to navigate directly into the new folder
        const targetNewPath =
          currentNavPath === "/"
            ? createdFolderName
            : `${currentNavPath.replace(/^\/+|\/+$/g, "")}/${createdFolderName}`;

        await loadDirectory(selectedStorageId, targetNewPath);
      } else {
        setErrorMsg(data.error || "Erro ao criar nova pasta");
      }
    } catch (err: any) {
      setErrorMsg("Falha ao criar pasta: " + err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleMove = async () => {
    setErrorMsg(null);
    setIsMoving(true);

    try {
      const targetFolder = currentNavPath === "/" ? "" : currentNavPath.replace(/^\/+|\/+$/g, "");

      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.id,
          targetStorageId: selectedStorageId,
          targetParentPath: targetFolder,
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
      setErrorMsg("Falha ao mover arquivo: " + err.message);
    } finally {
      setIsMoving(false);
    }
  };

  const currentStorage = storageRoots.find((r) => r.id === file.storageId);
  const targetStorage = storageRoots.find((r) => r.id === selectedStorageId);

  // Normalize paths to verify if current opened location is the same as source
  const sourceFolderNormalized = (file.parentPath || "/").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const targetFolderNormalized = currentNavPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const isSameLocation =
    file.storageId === selectedStorageId && sourceFolderNormalized === targetFolderNormalized;

  const isCrossDrive = file.storageId !== selectedStorageId;

  // Filter subfolders by search
  const filteredFolders = subfolders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center flex-none">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mover Arquivo / Pasta</h3>
              <p className="text-xs text-neutral-400">
                Navegue pelas pastas do servidor e escolha o local exato de destino
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* File Card Info */}
          <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800/80 flex items-center justify-between gap-3">
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Item Selecionado</span>
              <h4 className="text-sm font-bold text-white truncate">{file.name}</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {formatBytes(file.size)} • Local atual:{" "}
                <span className="text-neutral-200 font-medium">{currentStorage?.name}</span>{" "}
                <span className="font-mono text-neutral-500">
                  ({file.parentPath === "/" ? "Raiz" : file.parentPath})
                </span>
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

          {/* 1. Storage Volume Tabs */}
          <div>
            <label className="block text-neutral-300 font-bold uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-red-500" />
              <span>1. Selecione a Unidade / Volume:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {storageRoots.map((root) => {
                const isSelected = root.id === selectedStorageId;
                return (
                  <button
                    key={root.id}
                    type="button"
                    onClick={() => setSelectedStorageId(root.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all group ${
                      isSelected
                        ? "bg-red-600/10 border-red-500/80 text-white shadow-sm"
                        : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <HardDrive className={`w-3.5 h-3.5 flex-none ${isSelected ? "text-red-500" : "text-neutral-500"}`} />
                      <span className="font-semibold truncate">{root.name}</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono truncate mt-1 pl-5" title={root.path}>
                      {root.path}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Interactive Folder Explorer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-neutral-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Navegue até a Pasta de Destino:</span>
              </label>

              <button
                type="button"
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                className="text-red-500 hover:text-red-400 font-semibold flex items-center gap-1 text-[11px]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{showCreateFolder ? "Cancelar nova pasta" : "+ Nova pasta aqui"}</span>
              </button>
            </div>

            {/* Breadcrumb Navigation Bar */}
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar font-mono text-xs">
                {breadcrumbs.map((bc, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-neutral-600 flex-none" />}
                    <button
                      type="button"
                      onClick={() => handleNavigate(bc.path)}
                      className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                        idx === breadcrumbs.length - 1
                          ? "text-white font-bold bg-neutral-800"
                          : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                      }`}
                    >
                      {bc.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Navigate Up / Back Button */}
              {currentNavPath !== "/" && (
                <button
                  type="button"
                  onClick={handleNavigateUp}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-semibold flex-none transition-colors"
                  title="Subir um nível de pasta"
                >
                  <CornerLeftUp className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              )}
            </div>

            {/* Create Folder Form */}
            {showCreateFolder && (
              <form
                onSubmit={handleCreateFolder}
                className="bg-neutral-950 p-3 rounded-xl border border-red-500/50 flex items-center gap-2 animate-in fade-in"
              >
                <FolderPlus className="w-4 h-4 text-red-500 flex-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome da nova pasta..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs"
                >
                  {isCreatingFolder ? "Criando..." : "Criar e Entrar"}
                </button>
              </form>
            )}

            {/* Folder Browser Search Filter (if multiple folders) */}
            {subfolders.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar pastas nesta pasta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            {/* Folder Browser List */}
            <div className="border border-neutral-800 rounded-2xl bg-neutral-950/70 p-2 max-h-56 overflow-y-auto space-y-1">
              {loading ? (
                <div className="p-8 text-center text-neutral-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  <span>Carregando pastas...</span>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="p-6 text-center text-neutral-500">
                  <Folder className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-neutral-400 font-medium">Esta pasta não possui subpastas.</p>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    O arquivo será movido diretamente para dentro desta pasta atual.
                  </p>
                </div>
              ) : (
                filteredFolders.map((subfolder) => (
                  <button
                    key={subfolder.id}
                    type="button"
                    onClick={() => handleNavigate(subfolder.relativePath)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors group text-left"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 group-hover:scale-110 transition-transform flex-none" />
                      <span className="font-semibold text-neutral-200 group-hover:text-white truncate">
                        {subfolder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500 group-hover:text-neutral-300 text-[11px]">
                      <span>Abrir</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Destination Path Preview Card */}
          <div
            className={`p-3.5 rounded-2xl border transition-colors ${
              isSameLocation
                ? "bg-amber-950/20 border-amber-800/80"
                : "bg-neutral-950 border-neutral-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                  Destino Selecionado:
                </span>
                <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                  <span className="text-red-500">{targetStorage?.name}</span>
                  <span className="text-neutral-500">&gt;</span>
                  <span className="font-mono text-neutral-300">
                    {currentNavPath === "/" ? "Raiz do Disco (/)" : currentNavPath}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 font-mono mt-1 break-all">
                  {targetStorage?.path}
                  {currentNavPath !== "/" ? `\\${currentNavPath.replace(/\//g, "\\")}` : ""}
                  \\{file.name}
                </p>
              </div>

              {isSameLocation && (
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-none">
                  Já está aqui
                </span>
              )}
            </div>

            {isCrossDrive && (
              <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center gap-1.5 text-blue-400 text-[11px]">
                <ArrowRight className="w-3.5 h-3.5 flex-none" />
                <span>Transferência entre discos físicos ({currentStorage?.name} &rarr; {targetStorage?.name})</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors font-medium text-xs"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleMove}
            disabled={isMoving || isSameLocation}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-red-600/20 text-xs transition-all"
          >
            {isMoving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Movendo arquivo...</span>
              </>
            ) : isSameLocation ? (
              <span>Selecione uma pasta diferente</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  Mover para &quot;{currentNavPath === "/" ? targetStorage?.name : currentNavPath.split("/").pop()}&quot;
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
