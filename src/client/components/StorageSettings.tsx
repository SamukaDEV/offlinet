import React, { useState } from "react";
import {
  HardDrive,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  Copy,
  Check,
  Tv,
  Smartphone,
  CheckCircle,
  AlertCircle,
  FolderPlus,
  Cpu,
} from "lucide-react";
import type { StorageRoot, SystemInfo } from "../../types";

interface StorageSettingsProps {
  storageRoots: StorageRoot[];
  systemInfo: SystemInfo | null;
  onRefresh: () => void;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({
  storageRoots,
  systemInfo,
  onRefresh,
}) => {
  const [name, setName] = useState("");
  const [dirPath, setDirPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleAddStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim() || !dirPath.trim()) {
      setErrorMsg("Nome e caminho da pasta são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), path: dirPath.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Volume "${name}" adicionado com sucesso! Indexação iniciada.`);
        setName("");
        setDirPath("");
        onRefresh();
      } else {
        setErrorMsg(data.error || "Erro ao adicionar pasta");
      }
    } catch (err: any) {
      setErrorMsg("Erro de conexão: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoot = async (id: string, rootName: string) => {
    const confirmed = window.confirm(
      `Deseja desvincular a pasta "${rootName}" do OffliNet? (Seus arquivos físicos no disco NÃO serão apagados).`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/storage/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onRefresh();
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/storage/scan", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Varredura e catalogação de mídias iniciada em segundo plano.");
        setTimeout(() => {
          onRefresh();
          setIsScanning(false);
        }, 2000);
      }
    } catch {
      setIsScanning(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-10">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <HardDrive className="w-8 h-8 text-red-500" />
          <span>Configurações de Armazenamento & LAN</span>
        </h2>
        <p className="text-sm text-neutral-400 mt-1">
          Defina pastas e volumes em diferentes discos do sistema operacional para catalogar e reproduzir seus arquivos em qualquer aparelho da casa.
        </p>
      </div>

      {/* LAN Connectivity Card (Smart TV & Celulares) */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/80 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Servidor LAN Ativo
              </span>
              <span className="text-xs text-neutral-400 font-mono">Bun Server v1.3+</span>
            </div>
            <h3 className="text-xl font-bold text-white">Acesse o OffliNet em outros aparelhos</h3>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl">
              Abra o navegador da sua <strong>Smart TV (Samsung, LG, Android TV)</strong>, <strong>iPhone</strong>,{" "}
              <strong>Android</strong> ou outro PC conectado ao mesmo Wi-Fi e digite um dos endereços abaixo:
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-neutral-300">
                <Tv className="w-5 h-5 text-red-500" />
              </div>
              <div className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-neutral-300">
                <Smartphone className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* URLs List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {systemInfo?.lanUrls.map((url) => {
            const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
            return (
              <div
                key={url}
                className="bg-neutral-950/80 border border-neutral-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 group hover:border-neutral-700 transition-colors"
              >
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                    {isLocal ? "Acesso Local (Neste PC)" : "Acesso na Rede Wi-Fi / LAN"}
                  </span>
                  <span className="text-sm font-mono font-bold text-white tracking-wide truncate block">
                    {url}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(url)}
                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors flex-none"
                  title="Copiar URL"
                >
                  {copiedUrl === url ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Volumes Grid & Add Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Configured Storage Volumes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Pastas e Volumes Configurados</span>
              <span className="text-xs text-neutral-500 font-mono">({storageRoots.length})</span>
            </h3>

            <button
              onClick={handleTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-red-500" : ""}`} />
              <span>{isScanning ? "Varrendo Discos..." : "Varrer e Indexar Tudo"}</span>
            </button>
          </div>

          <div className="space-y-3">
            {storageRoots.map((root) => (
              <div
                key={root.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-4 group hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start gap-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center flex-none mt-0.5">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white truncate">{root.name}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] font-semibold">
                        Ativo
                      </span>
                    </div>
                    <p className="text-xs font-mono text-neutral-400 truncate mt-1" title={root.path}>
                      {root.path}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {root.fileCount || 0} itens catalogados
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  <button
                    onClick={() => handleDeleteRoot(root.id, root.name)}
                    className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    title="Desvincular pasta (não apaga arquivos do disco)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Add New Storage Form */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Adicionar Pasta / Volume</h3>
              <p className="text-xs text-neutral-400">Vincule qualquer diretório do PC</p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-none text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-none text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddStorage} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1.5">Nome Amigável / Rótulo</label>
              <input
                type="text"
                placeholder="Ex: Disco D - Filmes & Séries"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1.5">
                Caminho Completo no Sistema Operacional
              </label>
              <input
                type="text"
                placeholder="Ex: D:\Filmes ou C:\Users\nome\Videos"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 font-mono focus:outline-none focus:border-red-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1.5">
                Funciona em Windows (<code>C:\...</code>, <code>D:\...</code>) ou Linux/macOS (<code>/media/...</code>).
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? "Validando pasta..." : "Adicionar e Indexar"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
