import { sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, timestamp, integer, boolean, index, check, customType } from "drizzle-orm/pg-core";

export const requestStatus = pgEnum("request_status", ["NEW", "ACKNOWLEDGED", "PICKING", "COMPLETED"]);
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const pickingRequests = pgTable("picking_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionKey: uuid("submission_key").notNull().unique(),
  orderNumber: text("order_number").notNull(),
  message: text("message"),
  status: requestStatus("status").notNull().default("NEW"),
  screenshotPath: text("screenshot_path"),
  createdAt: time("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
  acknowledgedAt: time("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
  pickingStartedAt: time("picking_started_at"),
  pickingStartedBy: text("picking_started_by"),
  completedAt: time("completed_at"),
  completedBy: text("completed_by"),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (t) => [
  index("requests_status_created_idx").on(t.status, t.createdAt),
  index("requests_completed_idx").on(t.completedAt),
  index("requests_order_number_idx").on(t.orderNumber),
  check("valid_order_number", sql`${t.orderNumber} ~ '^[A-Za-z0-9-]{1,80}$'`),
  check("valid_message_length", sql`${t.message} IS NULL OR length(${t.message}) <= 1000`),
  check("completed_has_timestamp", sql`${t.status} <> 'COMPLETED' OR ${t.completedAt} IS NOT NULL`),
]);

export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  pickingRequestId: uuid("picking_request_id").notNull().references(() => pickingRequests.id, { onDelete: "restrict" }),
  previousStatus: requestStatus("previous_status"),
  newStatus: requestStatus("new_status").notNull(),
  changedAt: time("changed_at").notNull().defaultNow(),
  changedBy: text("changed_by").notNull(),
  notes: text("notes"),
}, (t) => [index("status_history_request_idx").on(t.pickingRequestId, t.changedAt)]);

export const screenshots = pgTable("private_screenshots", {
  id: uuid("id").primaryKey(),
  pickingRequestId: uuid("picking_request_id").notNull().unique().references(() => pickingRequests.id, { onDelete: "restrict" }),
  contentType: text("content_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  data: bytea("data").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, (t) => [index("screenshots_retention_idx").on(t.createdAt)]);

export const applicationSettings = pgTable("application_settings", {
  id: text("id").primaryKey().default("general"),
  companyName: text("company_name").notNull().default("Meridian Trade Supplies"),
  companyInitials: text("company_initials").notNull().default("MT"),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  alertSound: text("alert_sound").notNull().default("chime"),
  volume: integer("volume").notNull().default(65),
  repeatInterval: integer("repeat_interval").notNull().default(8),
  maxAlertDuration: integer("max_alert_duration").notNull().default(0),
  alertBehavior: text("alert_behavior").notNull().default("until_acknowledged"),
  maxScreenshotMb: integer("max_screenshot_mb").notNull().default(10),
  screenshotRetentionDays: integer("screenshot_retention_days").notNull().default(90),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (t) => [
  check("settings_singleton", sql`${t.id} = 'general'`),
  check("settings_volume_range", sql`${t.volume} BETWEEN 0 AND 100`),
  check("settings_repeat_range", sql`${t.repeatInterval} BETWEEN 3 AND 120`),
  check("settings_max_duration_range", sql`${t.maxAlertDuration} BETWEEN 0 AND 86400`),
  check("settings_upload_range", sql`${t.maxScreenshotMb} BETWEEN 1 AND 20`),
  check("settings_retention_range", sql`${t.screenshotRetentionDays} BETWEEN 1 AND 3650`),
]);

// Server-only signing material. Never included in API responses.
export const applicationSecrets = pgTable("application_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
