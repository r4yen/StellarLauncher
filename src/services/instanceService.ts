import { CreateInstanceInput, Instance, InstanceStatus } from "../models/instance";
import { loadInstances, saveInstances } from "./storageService";

export async function getInstances(fallback: Instance[]): Promise<Instance[]> {
  return loadInstances(fallback);
}

export async function persistInstances(instances: Instance[]): Promise<Instance[]> {
  return saveInstances(instances);
}

export async function createInstance(instances: Instance[], input: CreateInstanceInput): Promise<Instance[]> {
  const createdAt = new Date().toISOString();
  const idBase = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = `${idBase || "instance"}-${Date.now().toString(36)}`;
  const instance: Instance = {
    ...input,
    id,
    createdAt,
    lastPlayedAt: undefined,
    playtimeSeconds: 0,
    isFavorite: false,
    order: 0,
    status: input.name.trim() && input.minecraftVersion.trim() ? "ready" : "incomplete",
    loaderVersion: input.loaderType === "vanilla" ? "" : input.loaderVersion
  };

  return persistInstances(normalizeInstanceOrder([instance, ...sortInstances(instances)]));
}

export async function updateInstance(instances: Instance[], instanceId: string, input: CreateInstanceInput): Promise<Instance[]> {
  const status: InstanceStatus = input.name.trim() && input.minecraftVersion.trim() ? "ready" : "incomplete";
  const nextInstances = instances.map((instance) =>
    instance.id === instanceId
      ? {
          ...instance,
          ...input,
          loaderVersion: input.loaderType === "vanilla" ? "" : input.loaderVersion,
          status
        }
      : instance
  );

  return persistInstances(sortInstances(nextInstances));
}

export async function deleteInstance(instances: Instance[], instanceId: string): Promise<Instance[]> {
  return persistInstances(normalizeInstanceOrder(instances.filter((instance) => instance.id !== instanceId)));
}

export async function toggleInstanceFavorite(instances: Instance[], instanceId: string): Promise<Instance[]> {
  const nextFavorite = !instances.find((instance) => instance.id === instanceId)?.isFavorite;
  const groupMaxOrder = Math.max(
    -1,
    ...instances
      .filter((instance) => Boolean(instance.isFavorite) === nextFavorite && instance.id !== instanceId)
      .map((instance) => instance.order ?? 0)
  );
  return persistInstances(sortInstances(instances.map((instance) => (instance.id === instanceId ? { ...instance, isFavorite: nextFavorite, order: groupMaxOrder + 1 } : instance))));
}

export async function moveInstance(instances: Instance[], instanceId: string, direction: -1 | 1): Promise<Instance[]> {
  const sorted = sortInstances(instances);
  const index = sorted.findIndex((instance) => instance.id === instanceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return instances;
  if (Boolean(sorted[index].isFavorite) !== Boolean(sorted[target].isFavorite)) return instances;

  const next = [...sorted];
  [next[index], next[target]] = [next[target], next[index]];
  return persistInstances(normalizeInstanceOrder(next));
}

export function sortInstances(instances: Instance[]): Instance[] {
  return [...instances].sort((left, right) => {
    if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) return left.isFavorite ? -1 : 1;
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

function normalizeInstanceOrder(instances: Instance[]): Instance[] {
  let favoriteOrder = 0;
  let regularOrder = 0;
  return instances.map((instance) => {
    if (instance.isFavorite) {
      return { ...instance, order: favoriteOrder++ };
    }

    return { ...instance, order: regularOrder++ };
  });
}

export function canMoveInstance(instances: Instance[], instanceId: string, direction: -1 | 1): boolean {
  const sorted = sortInstances(instances);
  const index = sorted.findIndex((instance) => instance.id === instanceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return false;
  return Boolean(sorted[index].isFavorite) === Boolean(sorted[target].isFavorite);
}

export function formatPlaytime(totalSeconds = 0): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const units = [
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 }
  ];
  const parts: string[] = [];
  let remaining = seconds;

  for (const unit of units) {
    const value = Math.floor(remaining / unit.seconds);
    if (value <= 0 && parts.length === 0 && unit.label !== "second") continue;
    if (value > 0 || unit.label === "second") {
      parts.push(`${value} ${unit.label}${value === 1 ? "" : "s"}`);
      remaining -= value * unit.seconds;
    }
    if (parts.length === 2) break;
  }

  return parts.join(" ");
}

export function formatCompactPlaytime(totalSeconds = 0): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const units = [
    { label: "y", seconds: 31536000 },
    { label: "w", seconds: 604800 },
    { label: "d", seconds: 86400 },
    { label: "h", seconds: 3600 },
    { label: "min", seconds: 60 },
    { label: "sec", seconds: 1 }
  ];
  const parts: string[] = [];
  let remaining = seconds;

  for (const unit of units) {
    const value = Math.floor(remaining / unit.seconds);
    if (value <= 0 && parts.length === 0 && unit.label !== "sec") continue;
    if (value > 0 || unit.label === "sec") {
      parts.push(`${value}${unit.label}`);
      remaining -= value * unit.seconds;
    }
    if (parts.length === 2) break;
  }

  return parts.join(" ");
}

export function validateInstanceInput(input: CreateInstanceInput): string[] {
  const errors: string[] = [];

  if (!input.name.trim()) errors.push("Instance name is required.");
  if (!input.minecraftVersion.trim()) errors.push("Minecraft version is required.");
  if (input.loaderType !== "vanilla" && !input.loaderVersion.trim()) errors.push("Modloader version is required.");
  if (!input.gameDirectory.trim()) errors.push("Game directory is required.");
  if (!Number.isFinite(input.ramMb) || input.ramMb < 1024) errors.push("RAM must be at least 1024 MB.");

  return errors;
}
