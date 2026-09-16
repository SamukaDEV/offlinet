import React from "react";
import { Play, Info, HardDrive } from "lucide-react";
import type { FileItem } from "../../types";
import { formatSeconds, formatBytes } from "../utils/format";

interface MovieCardProps {
  movie: FileItem;
  onPlay: (movie: FileItem) => void;
  onOpenDetails: (movie: FileItem) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onPlay, onOpenDetails }) => {
  const hasProgress = movie.watchProgress && movie.watchProgress.percentage !== undefined && movie.watchProgress.percentage > 0;

  return (
    <div className="group relative flex-none w-56 sm:w-64 md:w-72 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-red-950/20">
      {/* Thumbnail Aspect Ratio 16:9 */}
      <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden cursor-pointer" onClick={() => onPlay(movie)}>
        <img
          src={movie.thumbnailUrl}
          alt={movie.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            // fallback if failed to load
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Play Icon Center Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Storage disk badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-neutral-300 font-medium">
          <HardDrive className="w-3 h-3 text-red-500" />
          <span className="line-clamp-1 max-w-[100px]">{movie.storageName || "Disco"}</span>
        </div>

        {/* Info button top-right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(movie);
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100"
          title="Ver detalhes"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* Continue watching progress bar */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${movie.watchProgress?.percentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Info Container */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-white truncate group-hover:text-red-400 transition-colors" title={movie.name}>
          {movie.name.replace(/\.[^/.]+$/, "")}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
          <span className="uppercase font-mono font-bold text-neutral-500">{movie.extension.replace(".", "")}</span>
          <span>{formatBytes(movie.size)}</span>
        </div>
      </div>
    </div>
  );
};
