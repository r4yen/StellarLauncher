import { Image, MoreHorizontal, Star, Trash2, UserCheck } from "lucide-react";
import { useUiLanguage, useUiText } from "../uiLanguage";
import { Account } from "../models/account";
import { minecraftHeadUrl } from "../services/avatarService";
import Button from "./ui/Button";
import StatusBadge from "./StatusBadge";
import LocalizedError from "./LocalizedError";
interface Props {
  account:Account; onOpenSkinLibrary?:(id:string)=>void; onRemoveAccount?:(id:string)=>void;
  onToggleFavorite?:(id:string)=>void; onMove?:(id:string,direction:-1|1)=>void;
  onSelectAccount:(id:string)=>void; canMoveUp?:boolean;canMoveDown?:boolean;
}
export default function AccountCard({account,onOpenSkinLibrary,onRemoveAccount,onToggleFavorite,onSelectAccount}:Props){
  const ui=useUiText(),language=useUiLanguage();const avatar=minecraftHeadUrl(account);
  const date=account.tokenExpiresAt?new Date(account.tokenExpiresAt).toLocaleDateString(language):undefined;
  const action=(callback:()=>void)=>(event:React.MouseEvent)=>{event.currentTarget.closest("details")?.removeAttribute("open");callback();};
  return <article className={`instance-row account-row ${account.isFavorite?"instance-row-favorite":""} ${account.isActive?"account-row-active":""}`}>
    {avatar?<img className="instance-row-icon" src={avatar} alt={ui("{name} skin head",{name:account.username})}/>:<span className="instance-row-icon account-row-avatar" style={{background:account.avatarColor}}>{account.username.slice(0,1)}</span>}
    <div className="instance-row-main"><h3>{account.username}</h3><p>{account.type==="microsoft"?"Microsoft":ui("Offline account")}</p><small title={account.uuid}>{account.uuid||ui("Offline profile")}</small>{account.errorMessage&&<LocalizedError message={account.errorMessage}/>}</div>
    <div className="instance-row-state"><StatusBadge state={account.loginStatus} label={account.isActive?ui("Selected"):undefined}/><small>{date?ui("Token expires {date}",{date}):ui("No token expiry")}</small></div>
    <button className={account.isFavorite?"favorite-star favorite-star-active":"favorite-star"} aria-label={ui(account.isFavorite?"Unfavorite account":"Favorite account")} onClick={()=>onToggleFavorite?.(account.id)}><Star size={17} fill={account.isFavorite?"currentColor":"none"}/></button>
    <Button icon={<UserCheck size={15}/>} variant={account.isActive?"secondary":"primary"} onClick={()=>onSelectAccount(account.id)}>{ui(account.isActive?"Selected":"Select")}</Button>
    <details className="instance-more"><summary aria-label={ui("Account actions")}><MoreHorizontal size={20}/></summary><div className="instance-menu"><button onClick={action(()=>onOpenSkinLibrary?.(account.id))}><Image size={15}/>{ui("Skin Library")}</button><button className="danger-text" onClick={action(()=>onRemoveAccount?.(account.id))}><Trash2 size={15}/>{ui("Remove account")}</button></div></details>
  </article>;
}
