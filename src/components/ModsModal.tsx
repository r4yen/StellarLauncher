import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, ChevronRight, Download, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Instance } from "../models/instance";
import { ModFile, ModrinthSearchResult } from "../models/mod";
import modrinthLogo from "../assets/modrinth.png";
import { addModFile, deleteMod, installModrinthMod, listMods, ModDownloadProgress, setModEnabled } from "../services/modService";
import { listen } from "@tauri-apps/api/event";
import { enrichModsWithModrinth, getProjectVersions, primaryJarFile, searchModrinthMods } from "../services/modrinthService";
import { joinDisplayPath } from "../utils/path";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ModsModalProps {
  cachedMods?: ModFile[];
  instance?: Instance;
  open: boolean;
  onClose: () => void;
  onCreateDownloadTask: (instanceName: string, label: string, targetPath: string) => string;
  onFailDownloadTask: (operationId: string) => void;
  onSetCachedMods: (instanceId: string, mods: ModFile[]) => void;
  onRefreshModrinthMods: (instance: Instance) => Promise<ModFile[]>;
}

export default function ModsModal({
  cachedMods,
  instance,
  open,
  onClose,
  onCreateDownloadTask,
  onFailDownloadTask,
  onSetCachedMods,
  onRefreshModrinthMods
}: ModsModalProps) {
  const [mods, setMods] = useState<ModFile[]>([]);
  const [query, setQuery] = useState("");
  const [modrinthOpen, setModrinthOpen] = useState(false);
  const [modrinthQuery, setModrinthQuery] = useState("");
  const [modrinthResults, setModrinthResults] = useState<ModrinthSearchResult[]>([]);
  const [modrinthOffset, setModrinthOffset] = useState(0);
  const [modrinthTotalHits, setModrinthTotalHits] = useState(0);
  const [modrinthLoading, setModrinthLoading] = useState(false);
  const [localRefreshLoading, setLocalRefreshLoading] = useState(false);
  const [busyModPath, setBusyModPath] = useState<string | undefined>();
  const [busyProjectId, setBusyProjectId] = useState<string | undefined>();
  const [modProgress, setModProgress] = useState<Record<string, { operationId: string; percent: number; status: string }>>({});
  const [error, setError] = useState<string | undefined>();

  const filteredMods = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mods;
    return mods.filter((mod) =>
      [mod.name, mod.fileName, mod.version, mod.authors.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [mods, query]);
  const modrinthPageSize = 12;
  const modrinthPage = Math.floor(modrinthOffset / modrinthPageSize) + 1;
  const modrinthPageCount = Math.max(1, Math.ceil(modrinthTotalHits / modrinthPageSize));
  const installedByProjectId = useMemo(() => {
    const installed = new Map<string, ModFile>();
    mods.forEach((mod) => {
      if (mod.modrinth?.projectId) installed.set(mod.modrinth.projectId, mod);
    });
    return installed;
  }, [mods]);
  const updatableMods = useMemo(() => mods.filter((mod) => mod.modrinth?.updateAvailable), [mods]);

  const loadLocalOnly = async () => {
    if (!instance) return;
    setError(undefined);
    try {
      setMods(cachedMods ?? (await listMods(instance)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    if (open) loadLocalOnly();
  }, [open, instance?.id, cachedMods]);

  const refreshModrinth = async () => {
    if (!instance) return;
    setLocalRefreshLoading(true);
    setError(undefined);
    try {
      setMods(await onRefreshModrinthMods(instance));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setLocalRefreshLoading(false);
    }
  };

  const toggleEnabled = async (mod: ModFile) => {
    const nextEnabled = !mod.enabled;
    const optimisticPath = nextEnabled ? mod.path.replace(/\.disabled$/i, "") : `${mod.path}.disabled`;
    const optimisticFileName = nextEnabled ? mod.fileName.replace(/\.disabled$/i, "") : `${mod.fileName}.disabled`;
    setMods((current) =>
      current.map((item) =>
        item.path === mod.path
          ? {
              ...item,
              enabled: nextEnabled,
              path: optimisticPath,
              fileName: optimisticFileName
            }
          : item
      )
    );

    try {
      const updated = await setModEnabled(mod.path, nextEnabled);
      setMods((current) => {
        const nextMods = current.map((item) => (item.path === optimisticPath ? { ...updated, modrinth: mod.modrinth } : item));
        if (instance) onSetCachedMods(instance.id, nextMods);
        return nextMods;
      });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : String(toggleError));
      loadLocalOnly();
    }
  };

  const removeMod = async (mod: ModFile) => {
    try {
      await deleteMod(mod.path);
      setMods((current) => {
        const nextMods = current.filter((item) => item.path !== mod.path);
        if (instance) onSetCachedMods(instance.id, nextMods);
        return nextMods;
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  };

  const addMod = async () => {
    if (!instance) return;

    try {
      const selected = await openDialog({
        multiple: false,
        title: "Select mod file",
        filters: [{ name: "Minecraft Mod", extensions: ["jar", "disabled"] }]
      });

      if (!selected || Array.isArray(selected)) return;

      const added = await addModFile(instance.gameDirectory, selected);
      setMods((current) => {
        const nextMods = [added, ...current];
        onSetCachedMods(instance.id, nextMods);
        return nextMods;
      });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : String(addError));
    }
  };

  useEffect(() => {
    if (!modrinthOpen || !instance) return;

    const timeoutId = window.setTimeout(async () => {
      setModrinthLoading(true);
      setError(undefined);
      try {
        const page = await searchModrinthMods(modrinthQuery, instance, modrinthOffset, modrinthPageSize);
        setModrinthResults(page.hits);
        setModrinthTotalHits(page.totalHits);
      } catch (searchError) {
        setError(searchError instanceof Error ? searchError.message : String(searchError));
      } finally {
        setModrinthLoading(false);
      }
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [instance, modrinthOpen, modrinthOffset, modrinthQuery]);

  useEffect(() => {
    setModrinthOffset(0);
  }, [modrinthQuery, instance?.id]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ModDownloadProgress>("mod-download-progress", (event) => {
      const progress = event.payload;
      setModProgress((current) => {
        const next = { ...current };
        Object.entries(current).forEach(([key, value]) => {
          if (value.operationId !== progress.operationId) return;
          const percent = progress.status === "completed" ? 100 : progress.totalBytes ? Math.min((progress.downloadedBytes / progress.totalBytes) * 100, 99) : value.percent;
          next[key] = {
            ...value,
            percent,
            status: progress.status
          };
        });
        return next;
      });
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const installSearchResult = async (result: ModrinthSearchResult) => {
    if (!instance) return;

    const installed = installedByProjectId.get(result.projectId);
    if (installed?.modrinth?.updateAvailable) {
      setBusyProjectId(result.projectId);
      try {
        await updateMod(installed);
      } finally {
        setBusyProjectId(undefined);
      }
      return;
    }
    if (installed) return;

    setBusyProjectId(result.projectId);
    setError(undefined);
    let operationId = "";
    try {
      const versions = await getProjectVersions(result.projectId, instance);
      const file = versions[0] ? primaryJarFile(versions[0]) : undefined;
      if (!file) throw new Error("No compatible Modrinth file found for this instance.");
      operationId = onCreateDownloadTask(instance.name, file.filename, joinDisplayPath(instance.gameDirectory, "mods", file.filename));
      setModProgress((current) => ({ ...current, [`project:${result.projectId}`]: { operationId, percent: 0, status: "pending" } }));
      const installed = await installModrinthMod(instance.gameDirectory, file.url, file.filename, undefined, operationId);
      const nextMods = [installed, ...mods];
      const enrichedMods = await enrichModsWithModrinth(nextMods, instance);
      setMods(enrichedMods);
      onSetCachedMods(instance.id, enrichedMods);
      setModProgress((current) => {
        const next = { ...current };
        delete next[`project:${result.projectId}`];
        return next;
      });
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : String(installError));
      if (operationId) onFailDownloadTask(operationId);
    } finally {
      setBusyProjectId(undefined);
    }
  };

  const updateMod = async (mod: ModFile, sourceMods = mods): Promise<ModFile[] | undefined> => {
    if (!instance || !mod.modrinth?.latestDownloadUrl || !mod.modrinth.latestFileName) return;

    setBusyModPath(mod.path);
    setError(undefined);
    const operationId = onCreateDownloadTask(instance.name, mod.modrinth.latestFileName, joinDisplayPath(instance.gameDirectory, "mods", mod.modrinth.latestFileName));
    setModProgress((current) => ({ ...current, [mod.path]: { operationId, percent: 0, status: "pending" } }));
    try {
      const updated = await installModrinthMod(instance.gameDirectory, mod.modrinth.latestDownloadUrl, mod.modrinth.latestFileName, mod.path, operationId);
      const nextMods = sourceMods.map((item) => (item.path === mod.path ? updated : item));
      const enrichedMods = await enrichModsWithModrinth(nextMods, instance);
      setMods(enrichedMods);
      onSetCachedMods(instance.id, enrichedMods);
      setModProgress((current) => {
        const next = { ...current };
        delete next[mod.path];
        return next;
      });
      return enrichedMods;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
      onFailDownloadTask(operationId);
    } finally {
      setBusyModPath(undefined);
    }
  };

  const updateAllMods = async () => {
    let workingMods = mods;
    for (const mod of updatableMods) {
      const currentMod = workingMods.find((item) => item.path === mod.path && item.modrinth?.updateAvailable);
      if (!currentMod) continue;
      const nextMods = await updateMod(currentMod, workingMods);
      if (nextMods) workingMods = nextMods;
    }
  };

  if (!open || !instance) return null;

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mods">
      <Card className={modrinthOpen ? "create-modal mods-modal mods-modal-wide" : "create-modal mods-modal"} tone="bright">
        <div className="mods-modal-top">
          <div className="modal-header">
            <div>
              <span>Mods</span>
              <h2>{instance.name}</h2>
            </div>
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="mods-toolbar">
            <label className="mods-search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mods" />
            </label>
            <Button icon={<Plus size={16} />} onClick={addMod} type="button">
              Add
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setModrinthOpen((current) => !current)} type="button" variant={modrinthOpen ? "primary" : "secondary"}>
              Modrinth
            </Button>
          </div>
        </div>
        {error ? <div className="error-panel">{error}</div> : null}
        <div className={modrinthOpen ? "mods-content mods-content-split" : "mods-content"}>
          <div className="mods-local-pane">
            <div className="mods-pane-header">
              <div>
                <strong>Installed mods</strong>
                <span>{filteredMods.length} shown</span>
              </div>
              <div className="mods-pane-actions">
                <Button icon={<Download size={15} />} disabled={updatableMods.length === 0 || Boolean(busyModPath)} onClick={updateAllMods} type="button" variant={updatableMods.length > 0 ? "primary" : "secondary"}>
                  Update all
                </Button>
                <button className="icon-button" disabled={localRefreshLoading} onClick={refreshModrinth} type="button" aria-label="Refresh Modrinth metadata" title="Refresh Modrinth metadata">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <div className="mods-list">
              {filteredMods.length > 0 ? (
                filteredMods.map((mod) => (
                <div className={mod.enabled ? "mod-row" : "mod-row mod-row-disabled"} key={mod.path}>
                  <input checked={mod.enabled} onChange={() => toggleEnabled(mod)} type="checkbox" />
                  <div className="mod-icon">
                    {mod.iconDataUrl ? <img src={mod.iconDataUrl} alt="" /> : <span>{mod.name.slice(0, 1)}</span>}
                  </div>
                  <div className="mod-main">
                    <strong>{mod.name}</strong>
                    <span>
                      {mod.modrinth ? <img className="modrinth-mark" src={modrinthLogo} alt="Modrinth" title="Found on Modrinth" /> : null}
                      {mod.fileName}
                    </span>
                  </div>
                  <div className="mod-meta">
                    <strong>{mod.version}</strong>
                    <span>{mod.authors.length ? mod.authors.join(", ") : "Unknown author"}</span>
                  </div>
                  {mod.modrinth ? (
                    <button
                      className={mod.modrinth.updateAvailable ? "icon-button mod-update-button mod-update-button-ready" : "icon-button mod-update-button"}
                      disabled={!mod.modrinth.updateAvailable || busyModPath === mod.path}
                      onClick={() => updateMod(mod)}
                      type="button"
                      aria-label={mod.modrinth.updateAvailable ? "Update mod" : "No update available"}
                      title={mod.modrinth.updateAvailable ? `Update from ${mod.version} to ${mod.modrinth.latestVersionName ?? "latest"}` : "No update available"}
                    >
                      <Download size={16} />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button className="icon-button" onClick={() => removeMod(mod)} type="button" aria-label="Delete mod">
                    <Trash2 size={16} />
                  </button>
                  <div className={modProgress[mod.path] ? "mod-row-progress mod-row-progress-active" : "mod-row-progress"}>
                    <div style={{ width: `${modProgress[mod.path]?.percent ?? 0}%` }} />
                  </div>
                </div>
                ))
              ) : (
                <Card className="empty-state">
                  <h3>{mods.length > 0 ? "No matching mods" : "No mods found"}</h3>
                  <p>{mods.length > 0 ? "Try a different search term." : "Add .jar files to the mods folder for this instance."}</p>
                </Card>
              )}
            </div>
          </div>
          {modrinthOpen ? (
            <aside className="modrinth-browser">
              <label className="mods-search">
                <Search size={16} />
                <input value={modrinthQuery} onChange={(event) => setModrinthQuery(event.target.value)} placeholder="Search Modrinth" />
              </label>
              <div className="modrinth-results">
                {modrinthLoading ? <div className="download-empty">Searching Modrinth...</div> : null}
                {!modrinthLoading && modrinthResults.length === 0 ? <div className="download-empty">No Modrinth results</div> : null}
                {modrinthResults.map((result) => (
                  <article className="modrinth-result" key={result.projectId}>
                    <div className="mod-icon">
                      {result.iconUrl ? <img src={result.iconUrl} alt="" /> : <span>{result.title.slice(0, 1)}</span>}
                    </div>
                    <div>
                      <strong>{result.title}</strong>
                      <span>{result.author} - {result.downloads.toLocaleString()} downloads</span>
                      <p>{result.description}</p>
                    </div>
                    <Button
                      disabled={
                        busyProjectId === result.projectId ||
                        Boolean(modProgress[`project:${result.projectId}`]) ||
                        Boolean(installedByProjectId.get(result.projectId) && !installedByProjectId.get(result.projectId)?.modrinth?.updateAvailable)
                      }
                      icon={<Download size={15} />}
                      onClick={() => installSearchResult(result)}
                      type="button"
                      variant={installedByProjectId.get(result.projectId)?.modrinth?.updateAvailable ? "primary" : "secondary"}
                    >
                      {installedByProjectId.get(result.projectId)?.modrinth?.updateAvailable ? "Update" : installedByProjectId.get(result.projectId) ? "Installed" : "Install"}
                    </Button>
                    <div className={modProgress[`project:${result.projectId}`] ? "mod-row-progress mod-row-progress-active modrinth-result-progress" : "mod-row-progress modrinth-result-progress"}>
                      <div style={{ width: `${modProgress[`project:${result.projectId}`]?.percent ?? 0}%` }} />
                    </div>
                  </article>
                ))}
              </div>
              <div className="modrinth-pagination">
                <button className="icon-button" disabled={modrinthOffset <= 0 || modrinthLoading} onClick={() => setModrinthOffset((current) => Math.max(0, current - modrinthPageSize))} type="button" aria-label="Previous Modrinth page">
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {modrinthPage} / {modrinthPageCount}
                </span>
                <button className="icon-button" disabled={modrinthOffset + modrinthPageSize >= modrinthTotalHits || modrinthLoading} onClick={() => setModrinthOffset((current) => current + modrinthPageSize)} type="button" aria-label="Next Modrinth page">
                  <ChevronRight size={16} />
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </Card>
    </div>,
    document.body
  );
}
