CREATE TABLE "blob" (
	"sha256" text PRIMARY KEY NOT NULL,
	"byte_size" bigint NOT NULL,
	"mime" text NOT NULL,
	"blurhash" text
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"blob_sha256" text NOT NULL,
	"extension" text NOT NULL,
	"kind" text NOT NULL,
	"delete_code" text NOT NULL,
	"original_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_owner_blob_unique" UNIQUE("owner_id","blob_sha256")
);
--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_blob_sha256_blob_sha256_fk" FOREIGN KEY ("blob_sha256") REFERENCES "public"."blob"("sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_ownerId_idx" ON "file" USING btree ("owner_id");