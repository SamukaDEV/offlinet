import fs from "fs";
import crypto from "crypto";
import Router from "routerun";
import { storageRepo } from "../db";
import { scanStorageRoot, scanAllRoots } from "../scanner";

export const storageRouter = new Router();

// GET /api/storage - List all storage roots
storageRouter.get("/", (_req, res) => {
  const roots = storageRepo.getAll();
  return res.json({ success: true, roots });
});

// POST /api/storage/scan - Trigger re-index
storageRouter.post("/scan", (_req, res) => {
  scanAllRoots().catch(console.error);
  return res.json({ success: true, message: "Varredura iniciada em segundo plano" });
});

// POST /api/storage - Add new storage root
storageRouter.post("/", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { name, path: dirPath } = body;

    if (!name || !dirPath) {
      return res.json({ success: false, error: "Nome e caminho são obrigatórios" }, { status: 400 });
    }

    if (!fs.existsSync(dirPath)) {
      return res.json({ success: false, error: `Caminho "${dirPath}" não existe no servidor` }, { status: 400 });
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.json({ success: false, error: `O caminho "${dirPath}" não é uma pasta` }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const newRoot = storageRepo.add({ id, name, path: dirPath, isActive: true });

    // Trigger asynchronous scan for this new root
    scanStorageRoot(newRoot.id).catch(console.error);

    return res.json({ success: true, root: newRoot });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// PATCH /api/storage/:id - Update storage root
storageRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const body = await req.raw.json();
    const updated = storageRepo.update(id, body);
    return res.json({ success: updated });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// DELETE /api/storage/:id - Delete storage root
storageRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  const deleted = storageRepo.delete(id);
  return res.json({ success: deleted });
});
