import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Film,
  FolderOpen,
  HardDrive,
  Wifi,
  Copy,
  Check,
  Search,
  ChevronDown,
  X,
  Layers,
  Download,
} from "lucide-react";
import type { SystemInfo } from "../../types";

interface NavbarProps {
  systemInfo?: SystemInfo | null;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

interface ModeOption {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge: string;
  colorClass: string;
}

const MODES: ModeOption[] = [
  {
    id: "cinema",
    label: "Cinema",
    path: "/",
    icon: Film,
    description: "Catálogo de filmes, séries e streaming de alta fidelidade",
    badge: "Streaming",
    colorClass: "text-red-500 bg-red-500/10 border-red-500/30",
  },
  {
    id: "arquivos",
    label: "Arquivos",
    path: "/explorador",
    icon: FolderOpen,
    description: "Explorador de pastas, transferências e editor de código",
    badge: "Nuvem & Código",
    colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  {
    id: "torrents",
    label: "Torrents",
    path: "/torrents",
    icon: Download,
    description: "Gerenciador de downloads torrent, links magnet e fila",
    badge: "BitTorrent",
    colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    path: "/armazenamento",
    icon: HardDrive,
    description: "Gerenciamento de discos, status e conexão de Smart TVs",
    badge: "Sistema & LAN",
    colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
];

export const Navbar: React.FC<NavbarProps> = ({ systemInfo, searchQuery = "", onSearchChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fechar modal de modo com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModeModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const lanUrl =
    systemInfo?.lanUrls.find((u) => !u.includes("localhost") && !u.includes("127.0.0.1")) ||
    systemInfo?.lanUrls[0] ||
    "http://localhost:3000";

  const handleCopyLan = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Identifica o modo ativo baseado na rota atual
  const currentMode =
    MODES.find((m) => {
      if (m.path === "/") return location.pathname === "/";
      return location.pathname.startsWith(m.path);
    }) || MODES[0];

  const handleSelectMode = (path: string) => {
    setShowModeModal(false);
    navigate(path);
  };

  const isCinemaMode = location.pathname === "/";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? "bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 shadow-2xl py-3"
            : "bg-gradient-to-b from-neutral-950/95 via-neutral-950/60 to-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Logo & Mode Selector */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2.5 group flex-none">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-red-500 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
                <Film className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1">
                  OFFLI<span className="text-red-500">NET</span>
                </span>
                <span className="text-[10px] block font-semibold uppercase tracking-widest text-neutral-400">
                  LAN Media Hub
                </span>
              </div>
            </Link>

            {/* Single Mode Button Trigger */}
            <button
              onClick={() => setShowModeModal(true)}
              className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-white transition-all shadow-sm group active:scale-95"
              title="Clique para alterar o modo de exibição"
            >
              <currentMode.icon className="w-4 h-4 text-red-500 flex-none" />
              <span className="text-xs sm:text-sm font-bold text-neutral-100">{currentMode.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors flex-none" />
            </button>
          </div>

          {/* Right Controls: Search (Only Cinema Mode) & LAN IP Chip */}
          <div className="flex items-center gap-3">
            {/* Quick Search - Only visible in Cinema Mode */}
            {isCinemaMode && onSearchChange && (
              <div className="relative hidden sm:block animate-in fade-in duration-200">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar filmes, pastas..."
                  className="bg-neutral-900/80 border border-neutral-800 rounded-full pl-9 pr-4 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 w-44 lg:w-60 transition-all"
                />
              </div>
            )}

            {/* LAN URL Pill for TVs and phones */}
            <div className="hidden lg:flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-full pl-3 pr-2 py-1 text-xs text-neutral-300 shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
              <span className="font-mono text-[11px] text-neutral-300 font-semibold">{lanUrl}</span>
              <button
                onClick={handleCopyLan}
                title="Copiar endereço LAN para abrir no celular ou Smart TV"
                className="p-1 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mode Selection Dialog / Modal */}
      {showModeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setShowModeModal(false)}
        >
          <div
            className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Selecionar Modo</h3>
                  <p className="text-xs text-neutral-400">Escolha como deseja explorar seu hub local</p>
                </div>
              </div>
              <button
                onClick={() => setShowModeModal(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modes Cards Grid */}
            <div className="space-y-3">
              {MODES.map((mode) => {
                const isActive = currentMode.id === mode.id;
                const Icon = mode.icon;

                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSelectMode(mode.path)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 group ${
                      isActive
                        ? "bg-neutral-850 border-red-500/60 shadow-lg shadow-red-950/30"
                        : "bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-none transition-transform group-hover:scale-105 border ${
                          isActive
                            ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30"
                            : "bg-neutral-800 text-neutral-300 border-neutral-700/60 group-hover:text-white"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                            {mode.label}
                          </h4>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mode.colorClass}`}>
                            {mode.badge}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed line-clamp-2">
                          {mode.description}
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="flex-none flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-xl">
                        <Check className="w-3.5 h-3.5" />
                        <span>Atual</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

