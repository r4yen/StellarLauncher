import { ReactNode, useState } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { CollectionKind, CollectionOrganization, folderOf, moveLibraryItem, orderedItems, removeLibraryFolder } from "../models/organization";
import { useUiText } from "../uiLanguage";
import Button from "./ui/Button";

interface Props<T> {
  kind: CollectionKind; items: T[]; collection: CollectionOrganization;
  onChange: (collection: CollectionOrganization) => void;
  renderItem: (item: T) => ReactNode;
  matches?: (item: T) => boolean;
}
export default function OrganizedList<T extends {id:string}>({kind,items,collection,onChange,renderItem,matches}: Props<T>) {
  const ui=useUiText();
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const [editing,setEditing]=useState<string>();
  const [name,setName]=useState("");
  const [dragOver,setDragOver]=useState<string>();
  const ids=items.map(item=>item.id);
  const mime=`application/x-stellar-${kind}`;
  const saveFolder=()=>{
    const trimmed=name.trim();if(!trimmed)return;
    onChange({...collection,folders:editing==="new"?[...collection.folders,{id:crypto.randomUUID(),name:trimmed}]:collection.folders.map(folder=>folder.id===editing?{...folder,name:trimmed}:folder)});
    setEditing(undefined);setName("");
  };
  const start=(event:React.DragEvent,id:string,type:"item"|"folder")=>{event.dataTransfer.setData(mime,JSON.stringify({id,type}));event.dataTransfer.effectAllowed="move";};
  const drop=(event:React.DragEvent,folderId?:string,beforeId?:string)=>{
    event.preventDefault();event.stopPropagation();setDragOver(undefined);
    try{const data=JSON.parse(event.dataTransfer.getData(mime));
      if(data.type==="item")onChange(moveLibraryItem(collection,ids,data.id,folderId,beforeId));
      else if(data.type==="folder"&&folderId&&data.id!==folderId){const folders=collection.folders.filter(item=>item.id!==data.id);const moved=collection.folders.find(item=>item.id===data.id);if(moved){const bounds=event.currentTarget.querySelector("header")?.getBoundingClientRect();const after=bounds&&event.clientY>bounds.top+bounds.height/2?1:0;folders.splice(folders.findIndex(item=>item.id===folderId)+after,0,moved);onChange({...collection,folders});}}
    }catch{/* Ignore drags from other applications or collections. */}
  };
  const over=(event:React.DragEvent,id:string)=>{if(event.dataTransfer.types.includes(mime)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";setDragOver(id);}};
  const row=(item:T)=><div className={`organized-row ${dragOver===item.id?"drop-before":""}`} key={item.id} onDragOver={event=>over(event,item.id)} onDrop={event=>{const folder=folderOf(collection,item.id);const siblings=orderedItems(items,collection,folder);const bounds=event.currentTarget.getBoundingClientRect();const after=event.clientY>bounds.top+bounds.height/2;drop(event,folder,after?siblings[siblings.findIndex(sibling=>sibling.id===item.id)+1]?.id:item.id);}}>
    <button className="drag-handle" draggable aria-label={ui("Drag to move")} title={ui("Drag to move")} onDragStart={event=>start(event,item.id,"item")} onDragEnd={()=>setDragOver(undefined)}><GripVertical size={17}/></button>{renderItem(item)}
  </div>;
  const root=orderedItems(items,collection).filter(item=>!matches||matches(item));
  return <div className="organized-library">
    <div className="library-toolbar"><small>{ui("Drag entries into folders or to a new position.")}</small><Button variant="secondary" icon={<FolderPlus size={16}/>} onClick={()=>{setEditing("new");setName("");}}>{ui("New folder")}</Button></div>
    {editing&&<form className="folder-editor" onSubmit={event=>{event.preventDefault();saveFolder();}}><input autoFocus maxLength={80} aria-label={ui("Folder name")} value={name} onChange={event=>setName(event.target.value)}/><Button disabled={!name.trim()} type="submit">{ui("Save")}</Button><Button type="button" variant="ghost" onClick={()=>setEditing(undefined)}>{ui("Cancel")}</Button></form>}
    <div className={`unfiled-list ${dragOver==="root"?"drop-target":""}`} onDragOver={event=>over(event,"root")} onDrop={event=>drop(event)}>
      {collection.folders.length>0&&<div className="unfiled-heading">{ui("Outside folders")}</div>}{root.map(row)}
      {collection.folders.length>0&&!root.length&&<p className="folder-empty">{ui("Drop entries here to remove them from a folder.")}</p>}
    </div>
    {collection.folders.map(folder=>{
      const all=orderedItems(items,collection,folder.id);const visible=all.filter(item=>!matches||matches(item));const open=expanded.has(folder.id);
      return <section className={`library-folder ${dragOver===folder.id?"drop-target":""}`} key={folder.id} onDragOver={event=>over(event,folder.id)} onDrop={event=>drop(event,folder.id)}>
        <header><button className="drag-handle" draggable aria-label={ui("Drag folder")} onDragStart={event=>start(event,folder.id,"folder")} onDragEnd={()=>setDragOver(undefined)}><GripVertical size={17}/></button><button className="folder-toggle" aria-expanded={open} onClick={()=>setExpanded(current=>{const next=new Set(current);next.has(folder.id)?next.delete(folder.id):next.add(folder.id);return next;})}><ChevronRight className={open?"folder-chevron-open":""} size={16}/>{open?<FolderOpen size={19}/>:<Folder size={19}/>}<strong>{folder.name}</strong><span>{all.length}</span></button><button className="icon-button" aria-label={ui("Rename folder")} onClick={()=>{setEditing(folder.id);setName(folder.name);}}><Pencil size={15}/></button><button className="icon-button" aria-label={ui("Remove folder")} title={ui("Remove folder; keep its entries")} onClick={()=>onChange(removeLibraryFolder(collection,ids,folder.id))}><Trash2 size={15}/></button></header>
        {open&&<div className="folder-contents">{visible.map(row)}{!visible.length&&<p className="folder-empty">{ui("No entries in this folder.")}</p>}</div>}
      </section>;
    })}
  </div>;
}
