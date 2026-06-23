CREATE TABLE "attorneys" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"firm_name" text NOT NULL,
	"title" text NOT NULL,
	"photo_url" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"bio" text NOT NULL,
	"years_of_experience" integer NOT NULL,
	"practice_areas" text[] NOT NULL,
	"jurisdictions" text[] NOT NULL,
	"office_address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"calendly_url" text,
	"fee_type" text NOT NULL,
	"offers_free_consultation" boolean NOT NULL,
	"video_conferencing" boolean NOT NULL,
	"languages" text[] NOT NULL,
	"website_url" text,
	"linkedin_url" text,
	"bar_number" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_pro" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"billing_tier" text,
	"terms_accepted_at" timestamp with time zone,
	"terms_accepted_ip" text,
	"city" text,
	"county" text,
	"state" text,
	"state_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"owner_id" text,
	"referred_by_id" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"attorney_id" integer,
	"query" text,
	"category" text,
	"path" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"handled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"scope" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attorneys" ADD CONSTRAINT "attorneys_referred_by_id_attorneys_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."attorneys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attorneys_status_idx" ON "attorneys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attorneys_practice_areas_gin" ON "attorneys" USING gin ("practice_areas");--> statement-breakpoint
CREATE INDEX "attorneys_owner_id_idx" ON "attorneys" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "attorneys_archived_at_idx" ON "attorneys" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "attorneys_status_archived_idx" ON "attorneys" USING btree ("status","archived_at");--> statement-breakpoint
CREATE INDEX "attorneys_state_county_lower_idx" ON "attorneys" USING btree (lower("state"),lower("county"));--> statement-breakpoint
CREATE INDEX "attorneys_referred_by_id_idx" ON "attorneys" USING btree ("referred_by_id");--> statement-breakpoint
CREATE INDEX "contact_messages_handled_idx" ON "contact_messages" USING btree ("handled");--> statement-breakpoint
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");