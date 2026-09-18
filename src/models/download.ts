export type DownloadTaskStatus = "pending" | "downloading" | "completed" | "error" | "cancelled";

export interface DownloadTask {
  id: string;
  cancelOperationId?: string;
  instanceId: string;
  instanceName: string;
  label: string;
  targetPath: string;
  status: DownloadTaskStatus;
  downloadedMb: number;
  totalMb: number;
  percent: number;
  etaSeconds?: number;
  startedAt: string;
  updatedAt: string;
}
