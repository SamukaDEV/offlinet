import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "./MovieCard";
import type { FileItem } from "../../types";

interface MovieRowProps {
  title: string;
  items: FileItem[];
  onPlay: (movie: FileItem) => void;
  onOpenDetails: (movie: FileItem) => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({ title, items, onPlay, onOpenDetails }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!items || items.length === 0) return null;

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="relative my-8 px-4 sm:px-6 lg:px-8 group/row">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>{title}</span>
          <span className="text-xs font-normal text-neutral-500 font-mono">({items.length})</span>
        </h3>
      </div>

      <div className="relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => handleScroll("left")}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-neutral-800 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all shadow-xl border border-neutral-800"
          title="Rolar para a esquerda"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 scroll-smooth"
        >
          {items.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onPlay={onPlay}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => handleScroll("right")}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-neutral-800 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all shadow-xl border border-neutral-800"
          title="Rolar para a direita"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};
