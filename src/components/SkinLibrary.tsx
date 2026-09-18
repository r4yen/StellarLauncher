import LocalizedError from "./LocalizedError";
import { useUiText } from "../uiLanguage";
import { FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Star, Trash2, UserCheck, X } from "lucide-react";
import { SkinLibraryItem } from "../models/skin";
import { canMoveSkin } from "../services/skinLibraryService";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface SkinLibraryProps {
  selectedSkinId?: string;
  skins: SkinLibraryItem[];
  onAddSkin: (name: string) => void;
  onMoveSkin: (skinId: string, direction: -1 | 1) => void;
  onRemoveSkin: (skinId: string) => void;
  onRenameSkin: (skinId: string, name: string) => void;
  onSelectSkin?: (skinId: string) => void;
  onToggleFavorite: (skinId: string) => void;
}

export default function SkinLibrary({ selectedSkinId, skins, onAddSkin, onMoveSkin, onRemoveSkin, onRenameSkin, onSelectSkin, onToggleFavorite }: SkinLibraryProps) {
  const ui = useUiText();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [editingSkinId, setEditingSkinId] = useState<string | undefined>();
  const [editingName, setEditingName] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();

    if (nextName.length < 3 || nextName.length > 16) {
      setError("Minecraft names must be 3 to 16 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nextName)) {
      setError("Only letters, numbers and underscores are allowed.");
      return;
    }

    onAddSkin(nextName);
    setName("");
    setError(undefined);
  };

  const startRename = (skin: SkinLibraryItem) => {
    setEditingSkinId(skin.id);
    setEditingName(skin.name);
  };

  const commitRename = () => {
    if (!editingSkinId) return;
    const nextName = editingName.trim();
    if (nextName.length > 0) onRenameSkin(editingSkinId, nextName);
    setEditingSkinId(undefined);
    setEditingName("");
  };

  return (
    <Card className="skin-library-card">
      <div className="skin-library-header">
        <div>
          <span>Skin</span>
          <h2>{ui("Skin Library")}</h2>
          <p>{ui("Loaded accounts are added automatically. You can also add a player name and reorder skins by dragging them.")}</p>
        </div>
        <form className="skin-add-form" onSubmit={submit}>
          <label>
            {ui("Player name")}<input
              maxLength={16}
              placeholder="Steve"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
            />
          </label>
          <Button icon={<Plus size={16} />} type="submit">
            {ui("Add Skin")}</Button>
        </form>
      </div>

      {error ? <p className="error-text"><LocalizedError message={error} /></p> : null}

      {skins.length > 0 ? (
        <div className="skin-library-grid">
          {skins.map((skin) => (
            <div
              className={`skin-tile ${skin.isFavorite ? "skin-tile-favorite" : ""}`}
              key={skin.id}
            >
              <button
                className={skin.isFavorite ? "favorite-star favorite-star-active skin-favorite-button" : "favorite-star skin-favorite-button"}
                type="button"
                aria-label={skin.isFavorite ? ui("Unfavorite {name}", {name: skin.name}) : ui("Favorite {name}", {name: skin.name})}
                onClick={() => onToggleFavorite(skin.id)}
              >
                <Star size={19} fill="currentColor" />
              </button>
              <div className="order-tools skin-order-tools">
                <button className="icon-button skin-small-action" disabled={!canMoveSkin(skins, skin.id, -1)} onClick={() => onMoveSkin(skin.id, -1)} type="button" aria-label={ui("Move {name} up", {name: skin.name})}>
                  <ArrowUp size={15} />
                </button>
                <button className="icon-button skin-small-action" disabled={!canMoveSkin(skins, skin.id, 1)} onClick={() => onMoveSkin(skin.id, 1)} type="button" aria-label={ui("Move {name} down", {name: skin.name})}>
                  <ArrowDown size={15} />
                </button>
              </div>
              <img className="skin-preview" src={skin.fullImageUrl ?? skin.imageUrl} alt={ui("{name} skin", {name: skin.name})} />
              <div className="skin-info">
                {editingSkinId === skin.id ? (
                  <div className="skin-rename-row">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") {
                          setEditingSkinId(undefined);
                          setEditingName("");
                        }
                      }}
                    />
                    <button className="icon-button skin-small-action" type="button" aria-label={ui("Save skin name")} onClick={commitRename}>
                      <Check size={15} />
                    </button>
                    <button
                      className="icon-button skin-small-action"
                      type="button"
                      aria-label={ui("Cancel rename")}
                      onClick={() => {
                        setEditingSkinId(undefined);
                        setEditingName("");
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <strong>{skin.name}</strong>
                )}
                <div className="skin-inline-actions">
                  {onSelectSkin ? (
                    <Button
                      className="skin-select-button"
                      icon={<UserCheck size={16} />}
                      variant={skin.id === selectedSkinId ? "secondary" : "primary"}
                      type="button"
                      onClick={() => onSelectSkin(skin.id)}
                    >
                      {skin.id === selectedSkinId ? ui("Selected") : ui("Select")}
                    </Button>
                  ) : null}
                  <Button className="skin-rename-button" icon={<Pencil size={15} />} variant="secondary" type="button" onClick={() => startRename(skin)}>
                    {ui("Rename")}</Button>
                </div>
              </div>
              <div className="skin-actions">
                <button className="icon-button icon-button-danger skin-small-action" type="button" aria-label={ui("Delete {name}", {name: skin.name})} onClick={() => onRemoveSkin(skin.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="skin-library-empty">
          <h3>{ui("No skins saved")}</h3>
          <p>{ui("Sign in, add an offline player, or enter a Minecraft name above.")}</p>
        </div>
      )}
    </Card>
  );
}
