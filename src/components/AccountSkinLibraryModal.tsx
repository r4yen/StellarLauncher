import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { Account } from "../models/account";
import { SkinLibraryItem } from "../models/skin";
import { minecraftHeadUrl } from "../services/avatarService";
import SkinLibrary from "./SkinLibrary";

interface AccountSkinLibraryModalProps {
  account?: Account;
  open: boolean;
  skins: SkinLibraryItem[];
  onAddSkin: (name: string) => void;
  onChangeAccountSkin: (accountId: string, skinId: string) => void;
  onClose: () => void;
  onMoveSkin: (skinId: string, direction: -1 | 1) => void;
  onRemoveSkin: (skinId: string) => void;
  onRenameSkin: (skinId: string, name: string) => void;
  onToggleSkinFavorite: (skinId: string) => void;
}

export default function AccountSkinLibraryModal({
  account,
  open,
  skins,
  onAddSkin,
  onChangeAccountSkin,
  onClose,
  onMoveSkin,
  onRemoveSkin,
  onRenameSkin,
  onToggleSkinFavorite
}: AccountSkinLibraryModalProps) {
  if (!open || !account) return null;

  const selectedSkinId =
    account.selectedSkinId && skins.some((skin) => skin.id === account.selectedSkinId)
      ? account.selectedSkinId
      : undefined;
  const avatarUrl = minecraftHeadUrl(account);

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${account.username} skin library`}>
      <div className="account-skin-modal">
        <div className="modal-header">
          <div className="account-skin-modal-title">
            {avatarUrl ? <img src={avatarUrl} alt={`${account.username} skin head`} /> : null}
            <div>
              <span>Skin</span>
              <h2>{account.username}</h2>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Close skin library" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <SkinLibrary
          selectedSkinId={selectedSkinId}
          skins={skins}
          onAddSkin={onAddSkin}
          onMoveSkin={onMoveSkin}
          onRemoveSkin={onRemoveSkin}
          onRenameSkin={onRenameSkin}
          onSelectSkin={(skinId) => onChangeAccountSkin(account.id, skinId)}
          onToggleFavorite={onToggleSkinFavorite}
        />
      </div>
    </div>,
    document.body
  );
}
