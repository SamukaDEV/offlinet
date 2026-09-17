import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import {
  X,
  Save,
  Download,
  FileCode,
  Maximize2,
  Minimize2,
  WrapText,
  Sun,
  Moon,
  Check,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import type { FileItem } from "../../types";
import { formatBytes } from "../utils/format";
import { getMonacoLanguage, POPULAR_LANGUAGES } from "../utils/codeLanguages";

// Configura o Monaco Editor para carregar os assets estáticos localmente do servidor OffliNet (100% offline)
loader.config({
  paths: {
    vs: "/monaco/vs",
  },
});

interface MonacoTextEditorModalProps {
  file: FileItem | null;
  onClose: () => void;
  onSaved?: (updated: { id: string; size: number; updatedAt: number }) => void;
}

export const MonacoTextEditorModal: React.FC<MonacoTextEditorModalProps> = ({
  file,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState<string>("");
  const [initialContent, setInitialContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [language, setLanguage] = useState<string>("plaintext");
  const [theme, setTheme] = useState<"vs-dark" | "light" | "hc-black">("vs-dark");
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [fontSize, setFontSize] = useState<number>(14);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const editorRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);

  const isDirty = content !== initialContent;

  // Inicializar linguagem e carregar conteúdo ao abrir o arquivo
  useEffect(() => {
    if (!file) return;

    const detectedLang = getMonacoLanguage(file.name);
    setLanguage(detectedLang);
    setLoading(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    // Buscar conteúdo diretamente pelo endpoint de texto
    fetch(`/api/files/content/${file.id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Erro ao carregar arquivo (Status ${res.status})`);
        }
        const data = await res.json();
        if (data.success) {
          setContent(data.content);
          setInitialContent(data.content);
        } else {
          throw new Error(data.error || "Falha ao carregar conteúdo.");
        }
      })
      .catch((err) => {
        console.error("Falha ao carregar arquivo no editor:", err);
        setErrorMsg(err.message || "Não foi possível carregar o arquivo.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [file]);

  // Função para salvar arquivo
  const handleSave = useCallback(async () => {
    if (!file || saving) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/files/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: file.id,
          content: content,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setInitialContent(content);
        setSaveSuccess(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
        }, 2500);

        if (onSaved) {
          onSaved({
            id: file.id,
            size: data.size,
            updatedAt: data.updatedAt,
          });
        }
      } else {
        throw new Error(data.error || "Erro ao salvar arquivo.");
      }
    } catch (err: any) {
      console.error("Erro ao salvar arquivo:", err);
      setErrorMsg(err.message || "Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }, [file, saving, content, onSaved]);

  // Registra atalhos no editor Monaco
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Atalho Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    // Monitoramento da posição do cursor
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    editor.focus();
  };

  // Interceptar tentativa de fechar com alterações pendentes
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  // Listener para tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showUnsavedPrompt) {
        handleAttemptClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, showUnsavedPrompt]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen ? "fixed inset-0 rounded-none h-screen" : "max-w-6xl h-[92vh]"
        }`}
      >
        {/* Header / Toolbar */}
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-3 flex-none select-none">
          {/* File Information */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-none">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg" title={file.name}>
                  {file.name}
                </h3>
                {isDirty && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 animate-pulse flex-none"
                    title="Há alterações não salvas"
                  >
                    ● Não salvo
                  </span>
                )}
                {saveSuccess && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 flex-none transition-all">
                    <Check className="w-3 h-3" /> Salvo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-sm sm:max-w-md font-mono" title={file.relativePath}>
                {file.storageName ? `${file.storageName}: ` : ""}{file.relativePath || file.name}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Selector */}
            <div className="hidden sm:flex items-center">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-neutral-700 focus:outline-none focus:border-blue-500 transition-colors"
                title="Sintaxe do arquivo"
              >
                {POPULAR_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap((w) => (w === "on" ? "off" : "on"))}
              className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1 ${
                wordWrap === "on"
                  ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
              }`}
              title={wordWrap === "on" ? "Quebra de linha ativada" : "Quebra de linha desativada"}
            >
              <WrapText className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme((t) => (t === "vs-dark" ? "light" : t === "light" ? "hc-black" : "vs-dark"))}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title={`Tema atual: ${theme === "vs-dark" ? "Dark (VS Code)" : theme === "light" ? "Light" : "Alto Contraste"}`}
            >
              {theme === "vs-dark" ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : theme === "light" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <RotateCcw className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen((fs) => !fs)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white transition-colors hidden sm:flex"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download File */}
            <a
              href={file.downloadUrl}
              download
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
              title="Baixar arquivo"
            >
              <Download className="w-4 h-4" />
            </a>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                isDirty
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95"
                  : "bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-70"
              }`}
              title="Salvar alterações (Ctrl+S)"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={handleAttemptClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-1"
              title="Fechar editor (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Notification Banner if any */}
        {errorMsg && (
          <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-900/60 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-none" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-300 hover:text-white font-bold text-xs"
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 relative overflow-hidden bg-neutral-950">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Carregando arquivo no Monaco Editor...</p>
            </div>
          ) : (
            <Editor
              height="100%"
              width="100%"
              language={language}
              theme={theme}
              value={content}
              onChange={(newVal) => setContent(newVal || "")}
              onMount={handleEditorDidMount}
              options={{
                fontSize: fontSize,
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace",
                wordWrap: wordWrap,
                minimap: { enabled: true, maxColumn: 80 },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                renderWhitespace: "selection",
                tabSize: 2,
                cursorBlinking: "smooth",
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
                formatOnPaste: true,
              }}
              loading={
                <div className="flex items-center justify-center h-full text-neutral-400 gap-2 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span>Inicializando editor de código...</span>
                </div>
              }
            />
          )}
        </div>

        {/* Status Bar / Footer */}
        <div className="px-4 py-1.5 border-t border-neutral-800 bg-neutral-900/95 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 font-mono select-none">
          <div className="flex items-center gap-4">
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="hidden sm:inline">
              Linhas: {content.split("\n").length}
            </span>
            <span className="hidden sm:inline">
              Caracteres: {content.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline">
              Tamanho: {formatBytes(new Blob([content]).size)}
            </span>
            <span className="bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
              UTF-8
            </span>
            <span className="bg-neutral-800 px-2 py-0.5 rounded text-blue-400 uppercase font-bold">
              {language}
            </span>
          </div>
        </div>

        {/* Confirmation Modal when Closing with Unsaved Changes */}
        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-none">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Alterações não salvas</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Você fez alterações em <span className="text-neutral-200 font-semibold">{file.name}</span>. Se fechar agora, essas alterações serão perdidas.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  onClick={() => setShowUnsavedPrompt(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Continuar Editando
                </button>
                <button
                  onClick={() => {
                    setShowUnsavedPrompt(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/30 transition-colors"
                >
                  Descartar Alterações
                </button>
                <button
                  onClick={async () => {
                    await handleSave();
                    setShowUnsavedPrompt(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all"
                >
                  Salvar e Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
