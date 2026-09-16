import React from "react";
import { Play, Info, HardDrive, Sparkles } from "lucide-react";
import type { FileItem } from "../../types";
import { formatBytes } from "../utils/format";

interface MovieHeroProps {
  movie: FileItem | null;
  onPlay: (movie: FileItem) => void;
  onOpenDetails: (movie: FileItem) => void;
}

export const MovieHero: React.FC<MovieHeroProps> = ({ movie, onPlay, onOpenDetails }) => {
  if (!movie) {
    return (
      <div className="relative w-full h-[45vh] sm:h-[55vh] flex items-center justify-center bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 px-4 text-center">
        <div className="max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 text-red-500 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Sua Central de Streaming LAN</h2>
          <p className="text-sm text-neutral-400 mt-2">
            Adicione vídeos e filmes nas suas pastas configuradas para começar a assistir com qualidade original e sem delay.
          </p>
        </div>
      </div>
    );
  }

  const cleanTitle = movie.name.replace(/\.[^/.]+$/, "");

  return (
    <div className="relative w-full h-[55vh] sm:h-[70vh] flex items-end pb-12 sm:pb-16 overflow-hidden select-none">
      {/* Background Poster Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={movie.thumbnailUrl}
          alt={movie.name}
          className="w-full h-full object-cover object-center filter brightness-[0.65] contrast-[1.1] scale-105 transition-transform duration-1000"
        />
        {/* Cinematic Vignette & Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/40 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-2xl">
          {/* Tag / Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
              Destaque LAN
            </span>
            <div className="flex items-center gap-1 text-xs text-neutral-300 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
              <span>{movie.storageName}</span>
            </div>
            <span className="text-xs text-neutral-400">• {formatBytes(movie.size)}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
            {cleanTitle}
          </h1>

          <p className="text-sm text-neutral-300 mt-2 line-clamp-2 drop-shadow">
            Reprodução em tempo real com buffer instantâneo diretamente do disco local.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => onPlay(movie)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-extrabold text-sm sm:text-base shadow-xl shadow-white/10 hover:scale-105 transition-all"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>Assistir Agora</span>
            </button>

            <button
              onClick={() => onOpenDetails(movie)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white font-semibold text-sm sm:text-base backdrop-blur-md border border-neutral-700/60 hover:scale-105 transition-all"
            >
              <Info className="w-5 h-5 text-neutral-300" />
              <span>Mais Informações</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
