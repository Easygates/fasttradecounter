CREATE TYPE "public"."request_status" AS ENUM('NEW', 'ACKNOWLEDGED', 'PICKING', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "application_secrets" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"id" text PRIMARY KEY DEFAULT 'general' NOT NULL,
	"company_name" text DEFAULT 'Meridian Trade Supplies' NOT NULL,
	"company_initials" text DEFAULT 'MT' NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"alert_sound" text DEFAULT 'chime' NOT NULL,
	"volume" integer DEFAULT 65 NOT NULL,
	"repeat_interval" integer DEFAULT 8 NOT NULL,
	"max_alert_duration" integer DEFAULT 0 NOT NULL,
	"alert_behavior" text DEFAULT 'until_acknowledged' NOT NULL,
	"max_screenshot_mb" integer DEFAULT 10 NOT NULL,
	"screenshot_retention_days" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("application_settings"."id" = 'general'),
	CONSTRAINT "settings_volume_range" CHECK ("application_settings"."volume" BETWEEN 0 AND 100),
	CONSTRAINT "settings_repeat_range" CHECK ("application_settings"."repeat_interval" BETWEEN 3 AND 120),
	CONSTRAINT "settings_max_duration_range" CHECK ("application_settings"."max_alert_duration" BETWEEN 0 AND 86400),
	CONSTRAINT "settings_upload_range" CHECK ("application_settings"."max_screenshot_mb" BETWEEN 1 AND 20),
	CONSTRAINT "settings_retention_range" CHECK ("application_settings"."screenshot_retention_days" BETWEEN 1 AND 3650)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"picking_request_id" uuid NOT NULL,
	"previous_status" "request_status",
	"new_status" "request_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "picking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_key" uuid NOT NULL,
	"order_number" text NOT NULL,
	"message" text,
	"status" "request_status" DEFAULT 'NEW' NOT NULL,
	"screenshot_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"picking_started_at" timestamp with time zone,
	"picking_started_by" text,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "picking_requests_submission_key_unique" UNIQUE("submission_key"),
	CONSTRAINT "valid_order_number" CHECK ("picking_requests"."order_number" ~ '^[A-Za-z0-9-]{1,80}$'),
	CONSTRAINT "valid_message_length" CHECK ("picking_requests"."message" IS NULL OR length("picking_requests"."message") <= 1000),
	CONSTRAINT "completed_has_timestamp" CHECK ("picking_requests"."status" <> 'COMPLETED' OR "picking_requests"."completed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "private_screenshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"picking_request_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"byte_length" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_screenshots_picking_request_id_unique" UNIQUE("picking_request_id")
);
--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_picking_request_id_picking_requests_id_fk" FOREIGN KEY ("picking_request_id") REFERENCES "public"."picking_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_screenshots" ADD CONSTRAINT "private_screenshots_picking_request_id_picking_requests_id_fk" FOREIGN KEY ("picking_request_id") REFERENCES "public"."picking_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_history_request_idx" ON "order_status_history" USING btree ("picking_request_id","changed_at");--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "picking_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_completed_idx" ON "picking_requests" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "requests_order_number_idx" ON "picking_requests" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "screenshots_retention_idx" ON "private_screenshots" USING btree ("created_at");