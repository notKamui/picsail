# Picsail

Picsail is a self-hosted image library. Upload JPEG, PNG, GIF, or WebP images,
share public links, and manage your files in the workspace. Administrators can
review and delete files across users.

The app uses TanStack Start, oRPC, Better Auth, PostgreSQL, and S3-compatible
object storage. Public image URLs support ordered still-image transformations;
animated GIFs are served as originals.

## Local development

1. Install the project dependencies with `vp install`.
2. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET` to a
   generated secret (`vp run auth:secret`). The example database and storage
   settings match the development Compose services; do not use their credentials
   in production.
3. Start PostgreSQL and RustFS with `vp run dev:docker:up`.
4. Apply the database migrations with `vp run db:migrate`.
5. Start the app with `vp run dev` and open <http://localhost:3000/>.

Uploads require an account. RustFS stores originals and cached variants; the
bucket and cache expiration policy are initialized by the application.
`MAX_UPLOAD_BYTES` and the `IMAGE_CACHE_*` environment variables control the
upload and cache limits. See `.env.example` for the available settings.

## API

The oRPC procedures provide the typed application API and an OpenAPI interface.
With the app running, visit <http://localhost:3000/api/docs> for the API
reference or <http://localhost:3000/api/openapi.json> for its schema.
Public files are served under `/f/{id}.{extension}`; resized variants use
`/f/{dimensions}/{id}.{extension}`.

For still images, add up to 16 transformation segments before the filename.
They execute from left to right:

- `800`, `800x600`, or `x600` resize within those dimensions (maximum 4096 per axis).
- `fit` immediately after a resize crops it to fill the requested dimensions,
  for example `/f/800x600/fit/{id}.jpg`.
- `left`, `right`, and `upside` rotate 90 degrees counterclockwise, 90 degrees
  clockwise, and 180 degrees respectively.

The filename extension selects the output format: `.jpg` (or `.jpeg`), `.png`,
`.webp`, or `.avif`. For example, `/f/800x600/fit/right/{id}.webp` resizes,
crops and rotates the image, then serves it as WebP. Requesting the original
format without transformations returns the original bytes.

Deletion requires a signed-in owner or administrator. Public image links can
be accessed without signing in.

## Production

Build the standalone Node server and container image with:

```sh
vp build
vp run start
docker build -f deployment/Dockerfile -t picsail .
```

The standalone server runs `.drizzle` migrations before listening on `PORT`.
For Docker, pass production settings at runtime with an environment file:

```sh
docker run --env-file /path/to/picsail.env -p 3000:3000 picsail
```

The image runs as a non-root user and does not include Vite+. Configure
`DATABASE_URL`, `BASE_URL`, `BETTER_AUTH_SECRET`, and the S3 settings for services
reachable from the container. `ADMIN_EMAILS` is a comma-separated list of
existing account email addresses to grant the admin role at startup. The S3
bucket must already exist.

## Checks

Run `vp check` for formatting, lint, and type checks, `vp test` for tests, and
`vp run build` for a production build.
