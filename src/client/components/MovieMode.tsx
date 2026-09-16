import React, { useState, useEffect } from "react";
import { Film, Sparkles, FolderPlus, Search, RefreshCw } from "lucide-react";
import type { CatalogData, FileItem } from "../../types";
import { MovieHero } from "./MovieHero";
import { MovieRow } from "./MovieRow";
import { MovieCard } from "./MovieCard";
import { Link } from "react-router-dom";

interface MovieModeProps {
  searchQuery: string;
  onPlayMovie: (movie: FileItem) => void;
  onOpenDetails: (movie: FileItem) => void;
}

export const MovieMode: React.FC<MovieModeProps> = ({
  searchQuery,
  onPlayMovie,
  onOpenDetails,
}) => {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/media/catalog");
      const data = await res.json();
      if (data.success) {
        setCatalog(data.catalog);
      }
    } catch (err) {
      console.error("[Catalog] Erro ao buscar catálogo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  if (loading && !catalog) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-24">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-medium">Carregando catálogo de filmes...</p>
        </div>
      </div>
    );
  }

  // Filtered search mode
  if (searchQuery.trim() && catalog) {
    // Collect all items across categories without duplicates
    const itemMap = new Map<string, FileItem>();
    if (catalog.featured) itemMap.set(catalog.featured.id, catalog.featured);
    catalog.continueWatching.forEach((i) => itemMap.set(i.id, i));
    catalog.categories.forEach((cat) => cat.items.forEach((i) => itemMap.set(i.id, i)));

    const matched = Array.from(itemMap.values()).filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-red-500" />
            <span>Resultados para &quot;{searchQuery}&quot; ({matched.length})</span>
          </h2>
        </div>

        {matched.length === 0 ? (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center">
            <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-300">Nenhum vídeo encontrado</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Tente buscar por outro termo ou explore pelo Explorador de Arquivos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {matched.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onPlay={onPlayMovie}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isEmpty = !catalog || catalog.totalMovies === 0;

  if (isEmpty) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-20 text-center">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-8 sm:p-12 backdrop-blur-md shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 text-red-500 flex items-center justify-center mx-auto mb-5">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">Nenhum filme catalogado ainda</h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-md mx-auto">
            Adicione vídeos nas suas pastas de armazenamento ou vincule novos diretórios com seus filmes e séries em outros discos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link
              to="/explorador"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 transition-all"
            >
              Enviar Arquivos
            </Link>
            <Link
              to="/armazenamento"
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-xl transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-neutral-400" />
              <span>Configurar Pastas dos Discos</span>
            </Link>
            <button
              onClick={loadCatalog}
              className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
              title="Recarregar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 select-none">
      {/* Hero Banner */}
      <MovieHero
        movie={catalog.featured || null}
        onPlay={onPlayMovie}
        onOpenDetails={onOpenDetails}
      />

      {/* Continue Watching Row */}
      {catalog.continueWatching && catalog.continueWatching.length > 0 && (
        <MovieRow
          title="Continuar Assistindo"
          items={catalog.continueWatching}
          onPlay={onPlayMovie}
          onOpenDetails={onOpenDetails}
        />
      )}

      {/* Catalog Categories Rows */}
      {catalog.categories.map((category) => (
        <MovieRow
          key={category.id}
          title={category.title}
          items={category.items}
          onPlay={onPlayMovie}
          onOpenDetails={onOpenDetails}
        />
      ))}
    </div>
  );
};
