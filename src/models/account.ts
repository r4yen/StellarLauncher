export type AccountType = "microsoft" | "offline";
export type AccountLoginStatus = "active" | "expired" | "refreshRequired" | "offline" | "error";

export interface Account {
  id: string;
  username: string;
  uuid: string;
  type: AccountType;
  avatarColor: string;
  skinHeadUrl?: string;
  loginStatus: AccountLoginStatus;
  tokenExpiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  isFavorite?: boolean;
  order?: number;
  errorMessage?: string;
}

export interface DeviceLoginStart {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  directVerificationUri: string;
  message: string;
  expiresAt: string;
  intervalSeconds: number;
}

export interface DeviceLoginPollResult {
  status: "pending" | "complete" | "error";
  account?: Account;
  message?: string;
}
