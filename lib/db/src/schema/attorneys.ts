import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const attorneysTable = pgTable(
  "attorneys",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    firmName: text("firm_name").notNull(),
    title: text("title").notNull(),
    photoUrl: text("photo_url").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    bio: text("bio").notNull(),
    yearsOfExperience: integer("years_of_experience").notNull(),
    practiceAreas: text("practice_areas").array().notNull(),
    jurisdictions: text("jurisdictions").array().notNull(),
    officeAddress: text("office_address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    calendlyUrl: text("calendly_url"),
    feeType: text("fee_type").notNull(),
    offersFreeConsultation: boolean("offers_free_consultation").notNull(),
    videoConferencing: boolean("video_conferencing").notNull(),
    languages: text("languages").array().notNull(),
    websiteUrl: text("website_url"),
    linkedinUrl: text("linkedin_url"),
    // State bar number, self-reported at signup, used for admin verification.
    barNumber: text("bar_number"),
    // Set true by an admin after manually checking the attorney's bar standing.
    isVerified: boolean("is_verified").notNull().default(false),
    // Paid "Pro" listing flag: Pro listings rank above free listings in search.
    // Driven by an active Pro-tier Stripe subscription (reconcileBilling); an
    // admin can still toggle it manually for comped listings.
    isPro: boolean("is_pro").notNull().default(false),
    // Stripe billing (paid-posts model). A listing is only PUBLIC while it has an
    // active/trialing subscription (see approvedVisibleCondition); demo rows are
    // exempt. These columns are denormalized from Stripe by reconcileBilling and
    // are never exposed on the public Attorney response (zod strips them).
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    // Stripe subscription status: active, trialing, past_due, canceled, unpaid,
    // incomplete, incomplete_expired, paused — or null when never subscribed.
    subscriptionStatus: text("subscription_status"),
    // Plan tier of the current subscription: "founding" | "basic" | "pro" | null.
    billingTier: text("billing_tier"),
    // Terms-acceptance audit trail: stamped server-side when the attorney
    // creates or resubmits a listing through the gated form.
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsAcceptedIp: text("terms_accepted_ip"),
    // Structured location, derived server-side from officeAddress (for SEO county
    // landing pages). Nullable: a row whose city isn't in the county lookup keeps
    // these null and is simply omitted from county pages until backfilled.
    city: text("city"),
    county: text("county"),
    state: text("state"),
    stateCode: text("state_code"),
    status: text("status").notNull().default("pending"),
    isDemo: boolean("is_demo").notNull().default(false),
    ownerId: text("owner_id"),
    // The attorney who referred THIS one (self-reference), captured at signup
    // from the referral picker. Set once at listing creation and immutable
    // thereafter (admin-clearable only). Drives the referral leaderboard and the
    // referral search-ranking boost. ON DELETE SET NULL so removing a referrer
    // doesn't orphan their referees' rows.
    referredById: integer("referred_by_id").references(
      (): AnyPgColumn => attorneysTable.id,
      { onDelete: "set null" },
    ),
    // Soft-delete marker. When set, the listing is archived: hidden from all
    // public reads and the normal admin queue, but recoverable via restore.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Every public read filters on status; most also filter/rank by practice area.
    index("attorneys_status_idx").on(t.status),
    index("attorneys_practice_areas_gin").using("gin", t.practiceAreas),
    // The "my listings" lookup filters by owner_id.
    index("attorneys_owner_id_idx").on(t.ownerId),
    // Public reads and the admin queue exclude archived rows; the archived view
    // selects them.
    index("attorneys_archived_at_idx").on(t.archivedAt),
    // The hot public read path filters status = 'approved' AND archived_at IS NULL
    // together; a composite supports that predicate better than either single
    // column index alone.
    index("attorneys_status_archived_idx").on(t.status, t.archivedAt),
    // County SEO landing pages filter case-insensitively on state + county
    // (lower(state) = lower($1) AND lower(county) = lower($2)). A functional index
    // on the lowercased columns is what those predicates can actually use; a plain
    // b-tree on county would be ignored.
    index("attorneys_state_county_lower_idx").on(
      sql`lower(${t.state})`,
      sql`lower(${t.county})`,
    ),
    // The referral leaderboard + ranking boost count referees by referred_by_id.
    index("attorneys_referred_by_id_idx").on(t.referredById),
  ],
);

export const insertAttorneySchema = createInsertSchema(attorneysTable).omit({
  id: true,
});
export type InsertAttorney = z.infer<typeof insertAttorneySchema>;
export type Attorney = typeof attorneysTable.$inferSelect;
