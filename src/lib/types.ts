export type Status = "NEW" | "ACKNOWLEDGED" | "PICKING" | "COMPLETED";
export type Workspace = "counter" | "display";
export interface PickingRequest {
  id: string; submissionKey: string; orderNumber: string; message: string | null;
  status: Status; screenshotPath: string | null; createdAt: string; createdBy: string | null;
  acknowledgedAt: string | null; acknowledgedBy: string | null;
  pickingStartedAt: string | null; pickingStartedBy: string | null;
  completedAt: string | null; completedBy: string | null; updatedAt: string;
}
export interface AppSettings {
  id: string; companyName: string; companyInitials: string; soundEnabled: boolean;
  alertSound: string; volume: number; repeatInterval: number; maxAlertDuration: number;
  alertBehavior: string; maxScreenshotMb: number; screenshotRetentionDays: number; updatedAt: string;
}
export interface Snapshot {
  requests: PickingRequest[];
  counts: { NEW: number; ACKNOWLEDGED: number; PICKING: number; COMPLETED: number; active: number };
  settings: AppSettings; serverTime: string;
}
export interface HistoryResult { requests: PickingRequest[]; total: number; page: number; pageSize: number }
export const statusLabels: Record<Status, string> = { NEW: "New", ACKNOWLEDGED: "Acknowledged", PICKING: "Picking", COMPLETED: "Completed" };
export const defaultSettings: AppSettings = {
  id: "general", companyName: "Meridian Trade Supplies", companyInitials: "MT", soundEnabled: true,
  alertSound: "chime", volume: 65, repeatInterval: 8, maxAlertDuration: 0,
  alertBehavior: "until_acknowledged", maxScreenshotMb: 10, screenshotRetentionDays: 90, updatedAt: "",
};
