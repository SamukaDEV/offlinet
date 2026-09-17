import React, { useState, useEffect } from "react";
import { X, Download, Music, Image as ImageIcon, FileText, AlertCircle, FileCode } from "lucide-react";
import type { FileItem } from "../../types";
import { formatBytes, formatDate } from "../utils/format";
import { canOpenAsText } from "../utils/codeLanguages";

interface MediaPreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  onOpenInEditor?: (file: FileItem) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ file, onClose, onOpenInEditor }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!file) return;

    // Se pode ser aberto como texto e não for imagem nem áudio binário
    if (canOpenAsText(file.name, file.mediaType)) {
      setLoadingText(true);
      fetch(`/api/files/content/${file.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setTextContent(data.content.slice(0, 50000));
          } else {
            setTextContent("Não foi possível carregar o arquivo de texto.");
          }
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent("Não foi possível carregar o arquivo de texto.");
          setLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [file]);

  if (!file) return null;

  const showEditorButton = onOpenInEditor && canOpenAsText(file.name, file.mediaType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            {file.mediaType === "image" && <ImageIcon className="w-5 h-5 text-purple-400 flex-none" />}
            {file.mediaType === "audio" && <Music className="w-5 h-5 text-emerald-400 flex-none" />}
            {file.mediaType === "document" && <FileText className="w-5 h-5 text-blue-400 flex-none" />}
            {file.mediaType !== "image" && file.mediaType !== "audio" && file.mediaType !== "document" && (
              <FileCode className="w-5 h-5 text-blue-400 flex-none" />
            )}
            <div className="truncate">
              <h3 className="text-sm font-bold text-white truncate">{file.name}</h3>
              <p className="text-[11px] text-neutral-400">
                {formatBytes(file.size)} • {formatDate(file.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showEditorButton && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInEditor(file);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                title="Abrir no Monaco Editor para editar"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Editar no Monaco</span>
              </button>
            )}
            <a
              href={file.downloadUrl}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Area */}
        <div className="p-6 flex-1 overflow-y-auto flex items-center justify-center min-h-[300px] bg-neutral-950">
          {file.mediaType === "image" && (
            <img
              src={file.downloadUrl}
              alt={file.name}
              className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
            />
          )}

          {file.mediaType === "audio" && (
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 p-6 rounded-2xl text-center space-y-4 shadow-xl">
              <div className="w-20 h-20 bg-emerald-950/60 border border-emerald-800/60 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                <Music className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{file.name}</h4>
                <p className="text-xs text-neutral-400 mt-1">{file.storageName}</p>
              </div>
              <audio controls autoPlay className="w-full mt-2 accent-emerald-500">
                <source src={file.streamUrl} type={file.mimeType} />
                Seu navegador não suporta áudio HTML5.
              </audio>
            </div>
          )}

          {textContent !== null && (
            <div className="w-full h-full max-h-[65vh] overflow-y-auto bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 font-mono text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {loadingText ? "Carregando conteúdo..." : textContent}
            </div>
          )}

          {file.mediaType === "document" && textContent === null && (
            <div className="text-center p-8">
              <FileText className="w-16 h-16 text-blue-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white">Visualização de Documento</h4>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto mt-1 mb-4">
                Este formato de arquivo ({file.extension.toUpperCase()}) pode ser baixado para visualização no seu leitor padrão.
              </p>
              <a
                href={file.downloadUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Baixar para Abrir</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
