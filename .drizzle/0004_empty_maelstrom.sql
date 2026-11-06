CREATE TABLE "image_variant_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"blob_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_variant_cache" ADD CONSTRAINT "image_variant_cache_blob_sha256_blob_sha256_fk" FOREIGN KEY ("blob_sha256") REFERENCES "public"."blob"("sha256") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_variant_cache_created_at_idx" ON "image_variant_cache" USING btree ("created_at");