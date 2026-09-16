import { playlistRepo } from "../db";

export async function handlePlaylistRoutes(req: Request, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  const method = req.method;

  // GET /api/playlists - List all playlists
  if (pathname === "/api/playlists" && method === "GET") {
    const playlists = playlistRepo.getAll();
    return Response.json({ success: true, playlists });
  }

  // POST /api/playlists - Create new playlist
  if (pathname === "/api/playlists" && method === "POST") {
    try {
      const body = await req.json();
      const { name } = body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return Response.json({ success: false, error: "Nome da playlist é obrigatório" }, { status: 400 });
      }

      const playlist = playlistRepo.create(name.trim());
      return Response.json({ success: true, playlist });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // GET /api/playlists/:id - Get playlist details with track list
  if (pathname.startsWith("/api/playlists/") && !pathname.includes("/items") && method === "GET") {
    const id = pathname.replace("/api/playlists/", "");
    const playlist = playlistRepo.getById(id);
    if (!playlist) {
      return Response.json({ success: false, error: "Playlist não encontrada" }, { status: 404 });
    }
    return Response.json({ success: true, playlist });
  }

  // DELETE /api/playlists/:id - Delete playlist
  if (pathname.startsWith("/api/playlists/") && !pathname.includes("/items") && method === "DELETE") {
    const id = pathname.replace("/api/playlists/", "");
    playlistRepo.delete(id);
    return Response.json({ success: true });
  }

  // POST /api/playlists/:id/items - Add track to playlist
  if (pathname.startsWith("/api/playlists/") && pathname.endsWith("/items") && method === "POST") {
    const parts = pathname.split("/");
    // /api/playlists/:id/items -> parts: ["", "api", "playlists", ":id", "items"]
    const playlistId = parts[3];

    try {
      const body = await req.json();
      const { fileId } = body;
      if (!fileId) {
        return Response.json({ success: false, error: "ID do arquivo é obrigatório" }, { status: 400 });
      }

      playlistRepo.addItem(playlistId, fileId);
      const updated = playlistRepo.getById(playlistId);
      return Response.json({ success: true, playlist: updated });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // DELETE /api/playlists/:id/items/:fileId - Remove track from playlist
  if (pathname.startsWith("/api/playlists/") && pathname.includes("/items/") && method === "DELETE") {
    const parts = pathname.split("/");
    // /api/playlists/:id/items/:fileId -> parts: ["", "api", "playlists", ":id", "items", ":fileId"]
    const playlistId = parts[3];
    const fileId = parts[5];

    if (playlistId && fileId) {
      playlistRepo.removeItem(playlistId, fileId);
      const updated = playlistRepo.getById(playlistId);
      return Response.json({ success: true, playlist: updated });
    }
    return Response.json({ success: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  return null;
}
