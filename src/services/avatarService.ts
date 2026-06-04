import { Account } from "../models/account";

export function minecraftHeadUrl(account: Account): string | undefined {
  if (account.type === "offline") return account.skinHeadUrl;
  const uuid = account.uuid.replace(/-/g, "");
  return uuid ? `https://mc-heads.net/head/${uuid}/96` : account.skinHeadUrl;
}
