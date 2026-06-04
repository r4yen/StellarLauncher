import { Account } from "../models/account";
import { loadAccounts, saveAccounts } from "./storageService";
import { invoke } from "@tauri-apps/api/core";

export async function getAccounts(fallback: Account[]): Promise<Account[]> {
  return loadAccounts(fallback);
}

export async function persistAccounts(accounts: Account[]): Promise<Account[]> {
  return saveAccounts(accounts);
}

export async function setActiveAccount(accounts: Account[], accountId: string): Promise<Account[]> {
  const nextAccounts = accounts.map((account) => ({
    ...account,
    isActive: account.id === accountId,
    lastUsedAt: account.id === accountId ? new Date().toISOString() : account.lastUsedAt
  }));

  return persistAccounts(sortAccounts(nextAccounts));
}

export async function removeAccount(accounts: Account[], accountId: string): Promise<Account[]> {
  try {
    await invoke("remove_account_tokens", { accountId });
  } catch {
    // Browser fallback and first-run mock accounts may not have keyring entries.
  }

  const remaining = accounts.filter((account) => account.id !== accountId);
  const hasActive = remaining.some((account) => account.isActive);
  const nextAccounts = hasActive || remaining.length === 0 ? remaining : [{ ...remaining[0], isActive: true }, ...remaining.slice(1)];

  return persistAccounts(sortAccounts(nextAccounts));
}

export async function upsertAccount(accounts: Account[], account: Account): Promise<Account[]> {
  const withoutAccount = accounts.filter((existing) => existing.id !== account.id);
  const nextAccounts = normalizeAccountOrder([
    { ...account, isActive: true, order: 0 },
    ...withoutAccount.map((existing, index) => ({ ...existing, isActive: false, order: existing.order ?? index + 1 }))
  ]);

  return persistAccounts(nextAccounts);
}

function normalizeOfflinePlayerName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 16) : "Player";
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "player";
}

function stableOfflineUuid(name: string): string {
  let hash = 2166136261;
  const source = `OfflinePlayer:${name}`;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-3${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex}${hex.slice(0, 4)}`;
}

function offlineSkinHeadDataUrl(name: string): string {
  const seed = Array.from(name).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
  const base = ["#8b5cf6", "#22d3ee", "#34d399", "#f59e0b", "#f472b6"][Math.abs(seed) % 5];
  const shadow = ["#4c1d95", "#155e75", "#166534", "#92400e", "#9d174d"][Math.abs(seed >> 3) % 5];
  const eye = "#111827";
  const pixels = [
    [shadow, shadow, base, base, base, base, shadow, shadow],
    [shadow, base, base, base, base, base, base, shadow],
    [base, base, base, base, base, base, base, base],
    [base, base, eye, base, base, eye, base, base],
    [base, base, base, base, base, base, base, base],
    [base, base, shadow, shadow, shadow, shadow, base, base],
    [shadow, base, base, base, base, base, base, shadow],
    [shadow, shadow, base, base, base, base, shadow, shadow]
  ];
  const rects = pixels
    .flatMap((row, y) => row.map((color, x) => `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${color}" />`))
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" shape-rendering="crispEdges">${rects}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function createOfflinePlayerAccount(name: string, isActive = true): Account {
  const username = normalizeOfflinePlayerName(name);

  return {
    id: `offline-${slugify(username)}-${Date.now().toString(36)}`,
    username,
    uuid: stableOfflineUuid(username),
    type: "offline",
    avatarColor: "#8b5cf6",
    skinHeadUrl: offlineSkinHeadDataUrl(username),
    loginStatus: "offline",
    lastUsedAt: new Date().toISOString(),
    isActive,
    isFavorite: false
  };
}

export async function addOfflinePlayerAccount(accounts: Account[], name: string): Promise<Account[]> {
  return upsertAccount(accounts, createOfflinePlayerAccount(name));
}

export async function toggleAccountFavorite(accounts: Account[], accountId: string): Promise<Account[]> {
  return persistAccounts(
    sortAccounts(
      accounts.map((account) =>
        account.id === accountId ? { ...account, isFavorite: !account.isFavorite } : account
      )
    )
  );
}

export async function moveAccount(accounts: Account[], accountId: string, direction: -1 | 1): Promise<Account[]> {
  const sorted = sortAccounts(accounts);
  const index = sorted.findIndex((account) => account.id === accountId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return accounts;

  const next = [...sorted];
  [next[index], next[target]] = [next[target], next[index]];
  return persistAccounts(normalizeAccountOrder(next));
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((left, right) => {
    if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) return left.isFavorite ? -1 : 1;
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

function normalizeAccountOrder(accounts: Account[]): Account[] {
  return accounts.map((account, index) => ({ ...account, order: index }));
}
