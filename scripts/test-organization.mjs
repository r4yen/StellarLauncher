import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const source=readFileSync(new URL("../src/models/organization.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {moveLibraryItem,removeLibraryFolder,orderedItems,folderOf,emptyOrganization}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const items=['a','b','c'].map(id=>({id}));
const fixture=()=>({folders:[{id:'pack',name:'Modpacks'}],placements:{}});
test('move into closed folder, reorder its entries and move back outside',()=>{
  let collection=moveLibraryItem(fixture(),['a','b','c'],'a','pack');
  collection=moveLibraryItem(collection,['a','b','c'],'b','pack','a');
  assert.deepEqual(orderedItems(items,collection,'pack').map(item=>item.id),['b','a']);
  assert.deepEqual(orderedItems(items,collection).map(item=>item.id),['c']);
  collection=moveLibraryItem(collection,['a','b','c'],'a',undefined,'c');
  assert.deepEqual(orderedItems(items,collection).map(item=>item.id),['a','c']);
});
test('removing a folder preserves every entry and appends its contents outside',()=>{
  const organized=moveLibraryItem(fixture(),['a','b','c'],'a','pack');
  const removed=removeLibraryFolder(organized,['a','b','c'],'pack');
  assert.equal(removed.folders.length,0);
  assert.deepEqual(orderedItems(items,removed).map(item=>item.id),['b','c','a']);
});
test('invalid foreign drops do not mutate organization; accounts stay separate',()=>{
  const collection=fixture();assert.equal(moveLibraryItem(collection,['a'],'unknown','pack'),collection);
  assert.equal(moveLibraryItem(collection,['a'],'a','missing'),collection);
  const organization=emptyOrganization();organization.instances=moveLibraryItem(collection,['a'],'a','pack');
  assert.equal(folderOf(organization.accounts,'a'),undefined);
  assert.equal(folderOf(organization.instances,'a'),'pack');
});
