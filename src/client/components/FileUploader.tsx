import React, { useState, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle, FileUp, Loader2, RotateCcw } from "lucide-react";
import { formatBytes } from "../utils/format";

interface FileUploaderProps {
  storageId: string | null;
  storageName: string | null;
  targetPath: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface UploadQueueItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  uploadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  storageId,
  storageName,
  targetPath,
  onClose,
  onUploadComplete,
}) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!storageId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Selecione um Disco de Armazenamento</h3>
          <p className="text-sm text-neutral-400 mt-2">
            Por favor, selecione uma unidade ou pasta de armazenamento antes de enviar arquivos.
          </p>
          <button
            onClick={onClose}
            className="mt-5 px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-xl text-sm transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
      progress: 0,
      totalBytes: f.size,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const uploadFileItem = (item: UploadQueueItem): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const cleanFolder = targetPath === "/" ? "" : targetPath;

      setQueue((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "uploading", progress: 0, uploadedBytes: 0, error: undefined }
            : i
        )
      );

      xhr.open("POST", "/api/files/upload-stream");
      xhr.setRequestHeader("x-storage-id", storageId);
      xhr.setRequestHeader("x-target-folder", encodeURIComponent(cleanFolder));
      xhr.setRequestHeader("x-file-name", encodeURIComponent(item.file.name));

      // Handle precise progress for large files
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
          setQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    progress,
                    uploadedBytes: event.loaded,
                    totalBytes: event.total,
                  }
                : i
            )
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              setQueue((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        status: "done",
                        progress: 100,
                        uploadedBytes: item.file.size,
                        error: undefined,
                      }
                    : i
                )
              );
              resolve(true);
              return;
            }
          } catch {}
        }

        let errorMsg = `Falha no envio (Status: ${xhr.status})`;
        if (xhr.status === 413) {
          errorMsg = "Arquivo excede o limite do servidor (413 Payload Too Large)";
        } else if (xhr.responseText) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.error) errorMsg = parsed.error;
          } catch {}
        }

        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "error", error: errorMsg } : i
          )
        );
        resolve(false);
      };

      xhr.onerror = () => {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: "Erro de conexão durante o upload" }
              : i
          )
        );
        resolve(false);
      };

      xhr.ontimeout = () => {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: "Tempo limite esgotado durante o envio" }
              : i
          )
        );
        resolve(false);
      };

      // Send raw binary stream of the file
      xhr.send(item.file);
    });
  };

  const startUploads = async () => {
    setIsProcessing(true);
    const pending = queue.filter((i) => i.status === "pending");

    let anySuccess = false;
    for (const item of pending) {
      const ok = await uploadFileItem(item);
      if (ok) anySuccess = true;
    }

    setIsProcessing(false);
    if (anySuccess) {
      onUploadComplete();
    }
  };

  const retryItem = async (id: string) => {
    if (isProcessing) return;
    const item = queue.find((i) => i.id === id);
    if (!item) return;

    setIsProcessing(true);
    const ok = await uploadFileItem(item);
    setIsProcessing(false);
    if (ok) {
      onUploadComplete();
    }
  };

  const retryAllFailed = async () => {
    if (isProcessing) return;
    const failedItems = queue.filter((i) => i.status === "error");
    if (failedItems.length === 0) return;

    setIsProcessing(true);
    let anySuccess = false;
    for (const item of failedItems) {
      const ok = await uploadFileItem(item);
      if (ok) anySuccess = true;
    }
    setIsProcessing(false);
    if (anySuccess) {
      onUploadComplete();
    }
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  const totalFiles = queue.length;
  const doneFiles = queue.filter((i) => i.status === "done").length;
  const errorFiles = queue.filter((i) => i.status === "error").length;
  const pendingFiles = queue.filter((i) => i.status === "pending").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center">
              <FileUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Enviar Arquivos para o Servidor</h3>
              <p className="text-xs text-neutral-400">
                Destino: <span className="text-neutral-200 font-medium">{storageName}</span> •{" "}
                <span className="font-mono">{targetPath === "/" ? "Raiz" : targetPath}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelection(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-red-500 bg-red-950/20 scale-[0.99]"
                : "border-neutral-800 hover:border-neutral-700 bg-neutral-950/50 hover:bg-neutral-950"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelection(e.target.files)}
            />
            <Upload className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-neutral-200">
              Arraste e solte arquivos aqui ou <span className="text-red-500">clique para selecionar</span>
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Suporta filmes em 4K, 1080p (2GB, 10GB, 50GB+), fotos e documentos com upload contínuo
            </p>
          </div>

          {/* Queue List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>
                  Fila de envio ({doneFiles}/{totalFiles} concluídos
                  {errorFiles > 0 && (
                    <span className="text-rose-400 font-medium"> • {errorFiles} com falha</span>
                  )})
                </span>
                <div className="flex items-center gap-2.5">
                  {errorFiles > 1 && !isProcessing && (
                    <button
                      onClick={retryAllFailed}
                      className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition-colors hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Tentar todos com falha ({errorFiles})</span>
                    </button>
                  )}
                  {totalFiles > 0 && !isProcessing && (
                    <button
                      onClick={() => setQueue([])}
                      className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      Limpar lista
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 truncate">
                        <p className="text-white font-medium truncate">{item.file.name}</p>
                        <p className="text-neutral-500 text-[11px] font-mono mt-0.5">
                          {item.status === "uploading" && item.uploadedBytes !== undefined
                            ? `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.totalBytes || item.file.size)} (${item.progress}%)`
                            : formatBytes(item.file.size)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-none">
                        {item.status === "uploading" && (
                          <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </div>
                        )}
                        {item.status === "done" && (
                          <div className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            <span>Concluído</span>
                          </div>
                        )}
                        {item.status === "error" && (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 text-rose-400 font-medium mr-1" title={item.error}>
                              <AlertCircle className="w-4 h-4" />
                              <span>Erro</span>
                            </div>
                            <button
                              onClick={() => retryItem(item.id)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-all font-medium text-[11px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              title="Tentar novamente o envio deste arquivo"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Tentar novamente</span>
                            </button>
                            {!isProcessing && (
                              <button
                                onClick={() => removeQueueItem(item.id)}
                                className="text-neutral-500 hover:text-neutral-300 p-1 cursor-pointer"
                                title="Remover da lista"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        {item.status === "pending" && !isProcessing && (
                          <button
                            onClick={() => removeQueueItem(item.id)}
                            className="text-neutral-500 hover:text-neutral-300 p-1 cursor-pointer"
                            title="Remover da lista"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {item.status === "uploading" && (
                      <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-red-600 h-full rounded-full transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error message detail */}
                    {item.status === "error" && item.error && (
                      <p className="text-rose-400 text-[11px] mt-1">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            {errorFiles > 0 && pendingFiles > 0 && !isProcessing && (
              <button
                onClick={retryAllFailed}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-rose-400 hover:text-rose-300 text-xs font-semibold border border-neutral-700/60 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reenviar falhas ({errorFiles})</span>
              </button>
            )}

            {isProcessing ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 opacity-50 cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando arquivos...</span>
              </button>
            ) : pendingFiles > 0 ? (
              <button
                onClick={() => startUploads()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Iniciar Envio ({pendingFiles})</span>
              </button>
            ) : errorFiles > 0 ? (
              <button
                onClick={retryAllFailed}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tentar Novamente ({errorFiles} {errorFiles === 1 ? "falha" : "falhas"})</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 opacity-50 cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-red-600/20"
              >
                <Upload className="w-4 h-4" />
                <span>Iniciar Envio (0)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
