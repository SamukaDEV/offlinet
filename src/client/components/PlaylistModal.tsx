import React, { useState, useEffect } from "react";
import { X, Plus, Music, Play, Trash2, Check, ListMusic, Disc } from "lucide-react";
import type { FileItem, Playlist } from "../../types";
import { useAudio } from "../context/AudioContext";

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToAdd?: FileItem | null;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({ isOpen, onClose, trackToAdd }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<string>>(new Set());

  const { playPlaylist } = useAudio();

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (data.success && data.playlists) {
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error("[Playlists] Erro ao carregar playlists:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      setAddedPlaylistIds(new Set());
      setNewPlaylistName("");
    }
  }, [isOpen]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || creating) return;

    try {
      setCreating(true);
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });
      const data = await res.json();

      if (data.success && data.playlist) {
        setNewPlaylistName("");
        // If trackToAdd is active, immediately add the track to the newly created playlist
        if (trackToAdd) {
          await handleAddToPlaylist(data.playlist.id);
        }
        await loadPlaylists();
      }
    } catch (err) {
      console.error("[Playlists] Erro ao criar playlist:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!trackToAdd) return;

    try {
      const res = await fetch(`/api/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: trackToAdd.id }),
      });
      const data = await res.json();

      if (data.success) {
        setAddedPlaylistIds((prev) => new Set([...prev, playlistId]));
        await loadPlaylists();
      }
    } catch (err) {
      console.error("[Playlists] Erro ao adicionar música:", err);
    }
  };

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente excluir esta playlist?")) return;

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      }
    } catch (err) {
      console.error("[Playlists] Erro ao deletar playlist:", err);
    }
  };

  const handlePlayPlaylistDirectly = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/playlists/${playlistId}`);
      const data = await res.json();
      if (data.success && data.playlist) {
        if (!data.playlist.items || data.playlist.items.length === 0) {
          alert("Esta playlist ainda não possui faixas adicionadas.");
          return;
        }
        playPlaylist(data.playlist);
        onClose();
      }
    } catch (err) {
      console.error("[Playlists] Erro ao carregar playlist para tocar:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {trackToAdd ? "Adicionar à Playlist" : "Minhas Playlists"}
              </h3>
              {trackToAdd && (
                <p className="text-xs text-neutral-400 truncate max-w-[260px]">
                  {trackToAdd.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create playlist input form */}
        <form onSubmit={handleCreatePlaylist} className="p-4 border-b border-neutral-800 bg-neutral-950/40">
          <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
            Nova Playlist
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Ex: Treino, Rock Clássico, Favoritas..."
              className="flex-1 bg-neutral-800 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim() || creating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>{creating ? "Criando..." : "Criar"}</span>
            </button>
          </div>
        </form>

        {/* Playlists List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8 text-neutral-500 text-xs">Carregando playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8">
              <Disc className="w-10 h-10 text-neutral-600 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-neutral-400">Nenhuma playlist criada ainda</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Crie sua primeira playlist usando o campo acima.
              </p>
            </div>
          ) : (
            playlists.map((playlist) => {
              const isAdded = addedPlaylistIds.has(playlist.id);

              return (
                <div
                  key={playlist.id}
                  onClick={() => {
                    if (trackToAdd && !isAdded) {
                      handleAddToPlaylist(playlist.id);
                    }
                  }}
                  className={`group p-3 rounded-xl border flex items-center justify-between transition-all ${
                    trackToAdd
                      ? "cursor-pointer hover:border-emerald-500/50 hover:bg-neutral-800/60"
                      : "hover:bg-neutral-800/30"
                  } ${
                    isAdded
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                      : "bg-neutral-800/40 border-neutral-700/60 text-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 transition-colors flex-none">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate text-white">{playlist.name}</p>
                      <p className="text-[11px] text-neutral-400">
                        {playlist.itemCount} {playlist.itemCount === 1 ? "música" : "músicas"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-none ml-2">
                    {trackToAdd ? (
                      isAdded ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Adicionado
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          + Adicionar
                        </span>
                      )
                    ) : (
                      <>
                        <button
                          onClick={(e) => handlePlayPlaylistDirectly(playlist.id, e)}
                          title="Tocar playlist"
                          className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                          title="Excluir playlist"
                          className="p-2 rounded-lg hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
