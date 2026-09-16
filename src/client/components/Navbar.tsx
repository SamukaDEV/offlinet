import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Film, FolderOpen, HardDrive, Wifi, Copy, Check, Tv, Search } from "lucide-react";
import type { SystemInfo } from "../../types";

interface NavbarProps {
  systemInfo?: SystemInfo | null;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ systemInfo, searchQuery = "", onSearchChange }) => {
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const lanUrl = systemInfo?.lanUrls.find(u => !u.includes("localhost") && !u.includes("127.0.0.1")) || systemInfo?.lanUrls[0] || "http://localhost:3000";

  const handleCopyLan = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { path: "/", label: "Modo Filme", icon: Film },
    { path: "/explorador", label: "Explorador de Arquivos", icon: FolderOpen },
    { path: "/armazenamento", label: "Discos & LAN", icon: HardDrive },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? "bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 shadow-2xl py-3"
          : "bg-gradient-to-b from-neutral-950/95 via-neutral-950/60 to-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
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

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-1.5 bg-neutral-900/60 p-1 rounded-xl border border-neutral-800/60 backdrop-blur-sm">
            {navLinks.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                      : "text-neutral-300 hover:text-white hover:bg-neutral-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: LAN IP Chip & Search */}
        <div className="flex items-center gap-3">
          {/* Quick Search */}
          {onSearchChange && (
            <div className="relative hidden sm:block">
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

          {/* Mobile TV Link icon */}
          <Link
            to="/armazenamento"
            className="lg:hidden p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
            title="Conectar Smart TV / Dispositivos LAN"
          >
            <Tv className="w-4 h-4 text-red-500" />
          </Link>
        </div>
      </div>

      {/* Mobile nav bottom bar on small devices */}
      <div className="md:hidden flex items-center justify-around border-t border-neutral-800/80 bg-neutral-950/95 py-2 px-3 mt-3">
        {navLinks.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 text-[11px] py-1 px-3 rounded-md transition-colors ${
                active ? "text-red-500 font-bold" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label.replace(" de Arquivos", "").replace(" & LAN", "")}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
