# Restaurant Reviews

A restaurant review platform: reviewers browse, filter and rate restaurants; owners manage their
own listings. A full-stack TypeScript monorepo: a Next.js and Material UI frontend, an Express and
MongoDB API with a hexagonal architecture, and images stored on S3 behind CloudFront.

It was built in six phases, each ending in a running application; all six are complete.

## Contents

- [Restaurant Reviews](#restaurant-reviews)
  - [Contents](#contents)
  - [Status](#status)
  - [Quick start](#quick-start)
  - [Feature checklist](#feature-checklist)
  - [Repository layout](#repository-layout)
  - [Prerequisites](#prerequisites)
  - [Setup and run](#setup-and-run)
    - [Image storage (LocalStack and a local CDN)](#image-storage-localstack-and-a-local-cdn)
    - [Images in production (S3 and CloudFront)](#images-in-production-s3-and-cloudfront)
    - [Demo data](#demo-data)
    - [Registering locally](#registering-locally)
    - [Environment variables](#environment-variables)
    - [Tests](#tests)
  - [Scripts](#scripts)
    - [Git hooks](#git-hooks)
  - [API](#api)
  - [Restaurants and images](#restaurants-and-images)
  - [Browsing](#browsing)
  - [Reviews and ratings](#reviews-and-ratings)
    - [Cleaning up orphaned reviews](#cleaning-up-orphaned-reviews)
  - [Accounts and security](#accounts-and-security)
  - [Backend architecture](#backend-architecture)
  - [Frontend structure](#frontend-structure)
  - [Design decisions and trade-offs](#design-decisions-and-trade-offs)
    - [Known limitations and next steps](#known-limitations-and-next-steps)

## Status

| Phase | Scope                                                           | State |
| ----- | --------------------------------------------------------------- | ----- |
| 1     | Three-package workspace and app shell                           | Done  |
| 2     | Accounts: email OTP registration, sign in, sign out             | Done  |
| 3     | Owner restaurant management with image upload (S3 / LocalStack) | Done  |
| 4     | Public browsing: filters, sorting, pagination, persistence      | Done  |
| 5     | Reviews and ratings                                             | Done  |
| 6     | Hardening and documentation                                     | Done  |

**What it does:** a visitor can register as a reviewer or a restaurant owner using a code emailed
to them, sign in, and sign out. An owner can add restaurants with a preview image, edit them,
replace the image, and delete them. Owners cannot touch each other's restaurants, and reviewers
cannot manage restaurants at all.

Anyone, signed in or not, can browse the restaurant list, filter it by cuisine and average
rating, sort it best or worst first, page through it, and open a restaurant's own page. The
last filters and order are remembered in the browser and applied again on the next visit.

A signed-in reviewer can rate a restaurant from one to five stars with a comment, once per
restaurant, and delete their review to write a new one. Every review updates the
restaurant's average, which the list's rating filter and order use. Anyone can read the reviews
on a restaurant's page; owners cannot write any. A reviewer's account page lists every review
they have written, with a link to each restaurant and a Delete button.

## Quick start

With Node.js 24, pnpm 10, a local MongoDB and Docker running (see Prerequisites):

```sh
pnpm install
pnpm infra:up   # LocalStack (S3) and the local CDN, and the image bucket
pnpm seed       # demo accounts, restaurants and reviews
pnpm dev        # http://localhost:3000
```

Sign in with `owner1@example.com` (an owner) or `reviewer2@example.com` (a reviewer with no
reviews yet); every demo password is `Password123`. More accounts are listed under Demo data.

## Feature checklist

| Feature                                                                                               | Where                                                                         | Tested in                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Register with email and password, choosing reviewer or owner                                          | `/register`; `POST /api/auth/request-otp`, `/register` (email code first)     | `authRoutes.int.test.ts`, `RegisterUserUseCase.test.ts`, `common/tests/schemas/auth.test.ts` |
| Owners create, read, update and delete their restaurants: title, preview image, location, description | `/owner/restaurants`; `POST/PATCH/DELETE /api/restaurants`                    | `restaurantRoutes.int.test.ts`, `*RestaurantUseCase.test.ts`                                 |
| Owners can only manage their own restaurants                                                          | `OwnedRestaurants`; 403 for someone else's                                    | `UpdateRestaurantUseCase.test.ts`, `DeleteRestaurantUseCase.test.ts`, route tests            |
| Reviewers list restaurants, filter by cuisine and average rating                                      | `/`; `GET /api/restaurants?cuisine&minRating&maxRating`                       | `ListRestaurantsUseCase.test.ts`, `restaurantRoutes.int.test.ts`                             |
| Sorted best to worst by default, switchable to worst first                                            | `sort=rating_desc` (default) / `rating_asc`; unrated last                     | the same                                                                                     |
| Last filter and sort remembered across visits                                                         | `localStorage`, applied on returning to `/`                                   | `listPreferencesStore.test.ts`, `listQuery.test.ts`                                          |
| A detail page per restaurant, with its reviews                                                        | `/restaurants/[slug]`                                                         | `reviewRoutes.int.test.ts`                                                                   |
| Reviewers rate (1 to 5 stars) and comment, once per restaurant; ratings drive the averages            | `POST /api/restaurants/:id/reviews`; `RestaurantRatings`                      | `CreateReviewUseCase.test.ts`, `RestaurantRatings.test.ts`, `reviewRoutes.int.test.ts`       |
| Single-page app                                                                                       | Next.js App Router: server-rendered first loads, client-side navigation after | browser checks per phase                                                                     |
| Security, authorization, validation and edge cases                                                    | see Accounts and security, and the sections on each feature                   | throughout; `common/tests` for every shared schema                                           |

## Repository layout

```
common/        @restaurant-reviews/common    constants and types shared by both apps
backend/       @restaurant-reviews/backend   Express 5 + Mongoose API (hexagonal architecture)
frontend/      @restaurant-reviews/frontend  Next.js (App Router) + Material UI + Redux Toolkit / RTK Query
```

The three packages form one pnpm workspace. `frontend` and `backend` both depend on `common`, so
validation rules and data shapes are defined once.

`AGENTS.md` holds the working conventions for anyone changing the code, coding agents included:
commands, layer rules, test layout and known pitfalls. `CLAUDE.md` points Claude Code to it.

## Prerequisites

- Node.js 24 (an `.nvmrc` is included: `nvm use`)
- pnpm 10 (`corepack enable` will provide it)
- MongoDB running locally on port 27017
- Docker, for LocalStack (standing in for AWS S3) and a small nginx CDN in front of it

## Setup and run

```sh
pnpm install
pnpm infra:up   # starts LocalStack and the local CDN, and creates the image bucket
pnpm seed       # optional: demo accounts and restaurants
pnpm dev
```

`pnpm dev` builds `common`, then starts all three packages in watch mode:

- Frontend: http://localhost:3000
- API: http://127.0.0.1:4000 (the frontend proxies `/api/*` to it, so the browser uses one origin)

No `.env` files are needed for local development; the defaults point at a local MongoDB and at
LocalStack with its CDN. To override them, copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env.local`.

### Image storage (LocalStack and a local CDN)

`pnpm infra:up` starts two containers (`docker-compose.yml`) and then creates and configures the
bucket (`backend/scripts/storage/setupStorage.ts`):

| Container     | Address                 | Stands in for     | Used for                                              |
| ------------- | ----------------------- | ----------------- | ----------------------------------------------------- |
| `localstack`  | `http://127.0.0.1:4566` | Amazon S3         | Browser uploads (presigned POST) and the API's checks |
| `cdn` (nginx) | `http://127.0.0.1:4567` | Amazon CloudFront | Every image the browser displays                      |

The CDN container (`infra/cdn/nginx.conf`) serves only published images, at
`/<bucket>/restaurants/<file>`, caches them, and answers 404 for anything else, so uploads waiting
under `pending/` cannot be reached through it. It sends every image with
`X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox; default-src 'none'` (see
"Why images have their own origin" below), and an `X-Cache-Status` header (`HIT` or `MISS`) for
checking the cache.

- LocalStack is pinned to `localstack/localstack:4.4.0`, the community edition. Later images refuse
  to start without a LocalStack account token. CloudFront itself is a paid LocalStack feature,
  which is why an nginx cache stands in for it.
- LocalStack keeps nothing when its container is removed. After `pnpm infra:down` or a fresh
  machine, run `pnpm infra:up` again; restaurants created before then will show missing images.
- One protection is enforced by AWS S3 but not by the LocalStack community edition: the signature
  on a presigned upload's policy.
- The lifecycle rule that expires abandoned uploads in `pending/` is applied to the LocalStack
  bucket too (a test checks it), but only AWS is relied on to actually delete expired files.
  The shortest expiry S3 allows is a day, so this cannot be exercised quickly in a test.

### Images in production (S3 and CloudFront)

1. Create the bucket's distribution in CloudFront with the bucket as its origin, accessed through
   an Origin Access Control (OAC), and a behaviour for `/restaurants/*` only.
2. Run `pnpm storage:setup` with production credentials and `CLOUDFRONT_DISTRIBUTION_ARN` set to
   the image distribution's ARN (`arn:aws:cloudfront::<account>:distribution/<id>`). The bucket
   then blocks all public access, and its policy lets only that distribution read
   `restaurants/*`. Against AWS the script refuses to run without the ARN, rather than leave the
   images readable straight from the bucket. Re-run it if the image distribution is replaced.
3. Attach a response headers policy to that behaviour, with the same two headers as the local
   CDN: the content-type options header (`nosniff`, a built-in security header) and a custom
   `Content-Security-Policy: sandbox; default-src 'none'`, both set to override the origin.
4. Set `IMAGE_BASE_URL` for the API to the distribution's address (for example
   `https://d111111abcdef8.cloudfront.net`). The API refuses to start in production without it.

**Why images have their own origin.** Uploaded files are served from a different address from
the app, the way large sites keep user content apart (`googleusercontent.com`,
`githubusercontent.com`, `fbcdn.net`). Even a file that got past every check could then not run
script as the app or receive its cookies. Use the distribution's own `*.cloudfront.net` address,
or a custom domain that is not a subdomain of the app's: `img.example.com` is a different origin
from `www.example.com` but the same _site_, which browsers still treat as related (for example,
`SameSite` cookies are sent between them). The two headers are a second layer: browsers never
reinterpret an image as another type, and an image opened directly as a page runs in a sandbox
with no scripts and nothing allowed to load. Neither affects displaying it in an `<img>` tag.

The app and the API can sit behind one CloudFront distribution of their own (pages and
`/_next/static/*` to Next.js, `/api/*` to Express with caching disabled and cookies and the
`Origin` header forwarded). Express would then need `trust proxy` set for CloudFront, so rate
limits count real client addresses rather than CloudFront's.

Published images are stored with `Cache-Control: public, max-age=31536000, immutable`. That is safe
because an image never changes: replacing it creates a new file under a new key. A deleted image
can stay in the CDN's cache until it expires; nothing links to it any more and its key is never
reused. If it must disappear at once, a CloudFront invalidation for its path would be needed.

### Demo data

`pnpm seed` fills the development database with accounts, fifteen restaurants across every
cuisine, each with a generated preview image uploaded to LocalStack, and about eighty reviews.
The averages are worked out from those reviews by the same code the API uses. Three
restaurants have no reviews, to show how unrated ones are listed. It needs MongoDB and `pnpm infra:up`.
It refuses to run when accounts already exist; `pnpm seed --reset` deletes all accounts,
sessions, restaurants and reviews first. It never runs with `NODE_ENV=production`.

Every seeded account's password is `Password123`:

| Email                                        | Role     | Notes                                                |
| -------------------------------------------- | -------- | ---------------------------------------------------- |
| `owner1@example.com`                         | owner    | Owns eight of the restaurants                        |
| `owner2@example.com`                         | owner    | Owns the other seven                                 |
| `reviewer1@example.com`                      | reviewer | Has reviewed Le Petit Bistro, so shows "Your review" |
| `reviewer2@example.com`                      | reviewer | No reviews yet: can review any restaurant            |
| `reviewer3@example.com`                      | reviewer | No reviews yet                                       |
| `diner1@example.com` to `diner9@example.com` | reviewer | Wrote the seeded reviews                             |

### Registering locally

Registration and password reset email a 6-digit code. By default (`EMAIL_PROVIDER=console`) the backend does not
send email; it prints each message to its log instead. Look for this in the `pnpm dev` output (the `api` lines):

```
--- email (not sent: EMAIL_PROVIDER is console) ---
To: you@example.com
Subject: 123456 is your Restaurant Reviews verification code
```

To send real email, set `EMAIL_PROVIDER` to `smtp` or `ses` and fill in the matching variables
below. Emails are sent with both a plain-text and an HTML part.

### Environment variables

| Package  | Variable                                   | Default                                                             | Purpose                                                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| backend  | `NODE_ENV`                                 | `development`                                                       | `development`, `test`, `production`                                                      |
| backend  | `PORT`                                     | `4000`                                                              | Port the API listens on                                                                  |
| backend  | `MONGODB_URI`                              | `mongodb://127.0.0.1:27017/restaurant_reviews`                      | MongoDB connection string                                                                |
| backend  | `JWT_SECRET`                               | a development-only value                                            | Signs access tokens and keys code hashes; at least 32 characters                         |
| backend  | `BCRYPT_ROUNDS`                            | `12`                                                                | Password hashing cost                                                                    |
| backend  | `ACCESS_TOKEN_TTL_MINUTES`                 | `15`                                                                | Lifetime of an access token (1 to 60)                                                    |
| backend  | `REFRESH_TOKEN_TTL_DAYS`                   | `7`                                                                 | Lifetime of a refresh token: how long a user stays signed in (1 to 30)                   |
| backend  | `ALLOWED_ORIGINS`                          | `http://localhost:3000,http://127.0.0.1:3000`                       | Browser origins allowed to make state-changing requests                                  |
| backend  | `EMAIL_PROVIDER`                           | `console`                                                           | `console` (print to the log), `smtp` or `ses`                                            |
| backend  | `EMAIL_FROM`                               | `Restaurant Reviews <no-reply@...>`                                 | Sender address; for SES it must be a verified identity                                   |
| backend  | `SMTP_HOST`                                | unset                                                               | SMTP server. Required when the provider is `smtp`                                        |
| backend  | `SMTP_PORT`                                | `587`                                                               | SMTP port (465 uses implicit TLS)                                                        |
| backend  | `SMTP_USER`, `SMTP_PASS`                   | unset                                                               | SMTP credentials, if the server needs them: both or neither                              |
| backend  | `AWS_REGION`                               | unset                                                               | Region of the SES identity. Required when the provider is `ses`                          |
| backend  | `S3_BUCKET`                                | `restaurant-reviews`                                                | Bucket for restaurant images                                                             |
| backend  | `S3_REGION`                                | `us-east-1`                                                         | Region of the bucket                                                                     |
| backend  | `S3_ENDPOINT`                              | LocalStack (`http://127.0.0.1:4566`) outside production             | S3-compatible endpoint; leave unset in production for AWS itself                         |
| backend  | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | LocalStack's `test` outside production                              | Explicit S3 credentials; unset in production uses the AWS SDK's default chain            |
| backend  | `IMAGE_BASE_URL`                           | the local CDN (`http://127.0.0.1:4567/<bucket>`) outside production | Address images are loaded from: the CDN. Required in production (the CloudFront address) |
| frontend | `API_URL`                                  | `http://127.0.0.1:4000`                                             | Where `/api/*` is proxied to                                                             |

For SES, AWS credentials are not configured here: the AWS SDK finds them itself (environment
variables, shared config, or the role attached to the instance, task or function).

The backend validates its environment at startup and exits with a readable message if a value is
invalid or MongoDB cannot be reached. In production it also refuses to start with the development
`JWT_SECRET` or with `EMAIL_PROVIDER=console`. It refuses `SMTP_USER` without `SMTP_PASS` (or the
reverse) in any environment, rather than failing at the first email.

The table lists what the running API reads. One more variable is read only by
`pnpm storage:setup`, and validated by that script rather than at API startup:

| Variable                      | Default | Purpose                                                                                                                                               |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFRONT_DISTRIBUTION_ARN` | unset   | The image distribution allowed to read the bucket. Required when the script targets AWS; leave unset against LocalStack, where the local CDN reads it |

### Tests

| Command                 | Runs                                                                               | Needs                                                 |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm test:unit`        | Unit tests (`*.test.ts`): one class or function with in-memory fakes               | Nothing                                               |
| `pnpm test:integration` | Integration tests (`*.int.test.ts`): the real HTTP app, the S3 adapter and the CDN | MongoDB, and `pnpm infra:up` for the S3 and CDN tests |
| `pnpm test`             | Both                                                                               | Both                                                  |

The backend integration tests use a real MongoDB,
in a separate database (`restaurant_reviews_test`, or `MONGODB_URI_TEST` if set) that they empty
before each test. They never touch the development database.

The tests for the S3 adapter run against LocalStack, in a separate `restaurant-reviews-test` bucket.
When LocalStack is not running they are skipped, not failed, so the rest of the suite needs only
MongoDB. Everywhere else, file storage is replaced by an in-memory fake.

`common` has its own tests for every shared schema, so each validation rule (lengths, byte
limits, enums, page bounds) is checked directly as well as through the API. Some tests are
type-level (`expectTypeOf`, `@ts-expect-error`) and are enforced by `pnpm typecheck`: they pin
down `ExactlyOne` and the record types Mongoose infers from the schemas.

In every package the tests live in a `tests/` folder beside `src/` and mirror its structure, so the
tests for `src/application/use-cases/auth/LoginUseCase.ts` are in
`tests/application/use-cases/auth/LoginUseCase.test.ts`. Shared fakes and fixtures are in
`tests/support/`.

## Scripts

Run from the repository root.

| Command                       | What it does                                                  |
| ----------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                    | Start everything in watch mode                                |
| `pnpm build`                  | Production build of all packages                              |
| `pnpm test`                   | Run all tests                                                 |
| `pnpm test:unit`              | Run the unit tests only (no services needed)                  |
| `pnpm test:integration`       | Run the integration tests (MongoDB, LocalStack)               |
| `pnpm typecheck`              | Type-check all packages (build `common` first)                |
| `pnpm lint`                   | ESLint across the repository                                  |
| `pnpm format`                 | Prettier across the repository                                |
| `pnpm infra:up`               | Start LocalStack and the CDN, set up the bucket               |
| `pnpm infra:down`             | Stop LocalStack and the CDN (stored images are discarded)     |
| `pnpm seed`                   | Add demo accounts and restaurants (`--reset` to replace them) |
| `pnpm reviews:delete-orphans` | Delete reviews of deleted restaurants (`--dry-run` to count)  |

### Git hooks

`pnpm install` sets up two Git hooks with Husky (`.husky/`):

| Hook         | Runs                                                                                                                                    | Time    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `pre-commit` | lint-staged on the staged files only: `eslint --fix`, then Prettier. Fixes are added to the commit; an error ESLint cannot fix stops it | seconds |
| `pre-push`   | Builds `common`, then `pnpm typecheck`, `pnpm lint`, `prettier --check .` and `pnpm test:unit`                                          | ~40 s   |

The push hook leaves out the integration tests because they need MongoDB and LocalStack; run
`pnpm test` before pushing changes to the API. To skip a hook once, add `--no-verify` to the
`git commit` or `git push`; set `HUSKY=0` to turn the hooks off entirely (for example in CI).

## API

Every error response has the same shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "No route for GET /api/nope", "details": [] } }
```

`details` is optional and lists per-field problems for validation errors.

| Method and path                         | Access                   | Notes                                                                                                                                                                                 |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/request-otp`            | public                   | `email`. Emails a code. Always 204, whatever the state of the address                                                                                                                 |
| `POST /api/auth/register`               | public                   | `name`, `email`, `password`, `role`, `otp`. Creates the user and signs them in; also `tokens` with `X-Client: mobile`                                                                 |
| `POST /api/auth/login`                  | public                   | `email`, `password`. Signs the user in; also `tokens` with `X-Client: mobile`                                                                                                         |
| `POST /api/auth/password-reset/request` | public, rate limited     | `email`. Emails a reset code. Always 204, whatever the state of the address                                                                                                           |
| `POST /api/auth/password-reset/confirm` | public, rate limited     | `email`, `otp`, `password`. Sets the new password, ends every session of the account and signs the user in; also `tokens` with `X-Client: mobile`                                     |
| `POST /api/auth/refresh`                | refresh token            | Issues a new access token. Optional `refreshToken` in place of the cookie; with `X-Client: mobile` also answers `accessToken`. `401 SESSION_ENDED` when there is no session to resume |
| `POST /api/auth/logout`                 | access token             | Ends the session on the server and clears the cookies                                                                                                                                 |
| `GET /api/auth/session`                 | any                      | `{ user }` for a valid access token, `{ user: null }` otherwise                                                                                                                       |
| `POST /api/uploads/presign`             | owner                    | `contentType`, `size`. Permission to upload one image straight to storage                                                                                                             |
| `GET /api/restaurants/mine`             | owner                    | The caller's restaurants, newest first                                                                                                                                                |
| `POST /api/restaurants`                 | owner                    | `title`, `slug`, `location`, `description`, `cuisine`, `imageKey`. 409 if the slug is taken                                                                                           |
| `PATCH /api/restaurants/:id`            | owner of that restaurant | Any of those fields; `imageKey` only to replace the image                                                                                                                             |
| `DELETE /api/restaurants/:id`           | owner of that restaurant | Deletes the restaurant, its reviews and its image                                                                                                                                     |
| `GET /api/restaurants`                  | public                   | One page of restaurants, filtered and sorted. See "Browsing" below                                                                                                                    |
| `GET /api/restaurants/by-slug/:slug`    | public                   | The restaurant with that slug (any case), as used by its public page. 404 if there is none                                                                                            |
| `GET /api/restaurants/:id`              | public                   | One restaurant by id, as used by the owner's edit page. 404 for an unknown or malformed id                                                                                            |
| `GET /api/restaurants/:id/reviews`      | public                   | `page`, `limit` (default 10, max 50). Newest first. 404 for an unknown restaurant                                                                                                     |
| `GET /api/restaurants/:id/reviews/mine` | reviewer                 | `{ review }`: the caller's review of it, or `null`                                                                                                                                    |
| `POST /api/restaurants/:id/reviews`     | reviewer, rate limited   | `rating` (whole stars, 1 to 5), `comment` (1 to 1,000 characters). 409 if already reviewed                                                                                            |
| `GET /api/reviews/mine`                 | reviewer                 | The caller's reviews across restaurants, newest first, each with `restaurantSlug`, `restaurantTitle` and `restaurantImageUrl`. `page`, `limit`                                        |
| `DELETE /api/reviews/:id`               | author of that review    | Deletes it; the restaurant's average is recalculated                                                                                                                                  |

Error codes: `VALIDATION_FAILED` and `INVALID_OTP` (400), `INVALID_JSON` (400),
`INVALID_CREDENTIALS` and `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
`PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), `SERVICE_UNAVAILABLE` (503).

## Restaurants and images

**Who may do what.** Owner-only routes run two checks: `requireUser` (a valid access token) and
then `requireRole('owner')`, which reads the role from the token. A reviewer is answered 403 and a
guest 401. Changing or deleting a restaurant also requires it to be the caller's own: every use
case that modifies a restaurant loads it through `OwnedRestaurants`, which answers 404 for one
that does not exist and 403 for someone else's. The owner of a new restaurant is always the
caller; owner and rating cannot be set through the API.

**Public URLs.** A restaurant's page is `/restaurants/<slug>`, for example
`/restaurants/le-petit-bistro`, which reads better in a search result or a shared link than a
database id.

- **The owner chooses it when creating the restaurant.** The form suggests one from the title
  as they type (`slugify` in `common`): lowercase ASCII letters and digits joined by hyphens,
  accents dropped and letters such as ß and ø spelled out, so `Crêpe Expectations` becomes
  `crepe-expectations` and `Straße` becomes `strasse`. Once the owner edits the field, the
  suggestion stops following the title. A title with nothing usable, such as one written in
  Thai, suggests nothing, and the owner types one.
- **Validated on both sides** by `restaurantSlugSchema`: lowercase letters and digits, single
  hyphens between words, at most 60 characters. The `restaurants` model checks the same pattern,
  so no write path, the seed script included, can store a slug outside it.
- **Case-insensitive, stored in lowercase.** Capitals are lowercased rather than refused, at
  every layer (the form's preview, the API's schema, the model), so `Le-Petit-Bistro` is saved
  as `le-petit-bistro`. Looking one up lowercases it the same way, and the page redirects
  (308) to the lowercase address. A value that could never be a slug is answered 404 without
  a database query.
- **Unique.** A slug another restaurant has is refused with 409 and a message on the slug field.
  The unique index is the only check, so it also settles two owners claiming the same slug at
  the same moment, with the same answer. The upload is kept, so the owner can pick another slug
  and submit again without uploading the file again.
- **Fixed after creation.** The edit form shows it read-only, and `PATCH` ignores it, so links
  and search results never break. The price is a URL that can show an old name after a rename.
- **Its own route.** It is `GET /api/restaurants/by-slug/:slug` rather than one `/:idOrSlug`
  route. A combined route would have to forbid slugs that look like ids (24 hex characters is a
  valid slug) and reserve every word used by a fixed route such as `/restaurants/mine`. Below
  the HTTP layer both routes share one lookup: `findOne` takes exactly one of `id` or `slug`.
- **Ids stay internal.** Reviews and the owner's pages (`/owner/restaurants/<id>/edit`) still use
  the id.

**Image upload.** Image files never pass through the API:

1. The browser asks `POST /api/uploads/presign` for permission, declaring the type and size. It
   gets back a presigned POST for one new key under `pending/<ownerId>/`, valid for 5 minutes.
   S3 itself enforces the policy: that exact key, that content type, and at most 5 MB.
2. The browser uploads the file straight to the bucket, with a progress bar. It uses
   `XMLHttpRequest` rather than `fetch`, because `fetch` cannot report upload progress. Leaving
   the form while the upload is running cancels it, rather than letting it finish unseen.
3. Saving the restaurant sends only the key. The API trusts nothing about it: the key must be in
   the caller's own upload area, a file must be there, it must be within the size limit, and its
   first bytes must be a real JPEG, PNG or WebP (a renamed script is rejected, and deleted). It
   is then copied to `restaurants/<new key>` with the detected content type and a one-year
   immutable cache lifetime. `restaurants/` is the only part of the bucket the CDN serves, and
   browsers load images only through the CDN.
4. The upload in `pending/` is deleted only once the restaurant has been saved. If saving fails
   (the database is briefly unavailable, say), the copy in `restaurants/` is deleted but the
   upload is kept, so pressing Save again works without choosing and uploading the file again.
   Replacing an image deletes the old file only once the restaurant points at the new one.
   Deleting a restaurant deletes its image. A failure to delete a file is logged, never shown to
   the user.
5. Uploads never attached to a restaurant (the owner gave up, or never saved) are expired from
   `pending/` by a bucket lifecycle rule after a day. S3 applies it in the background, so one can
   remain for up to about two days; it stays private throughout, since neither the CDN nor the
   bucket policy gives access to `pending/`.

## Browsing

`GET /api/restaurants` takes these query parameters, all optional:

| Parameter   | Values                                   | Default       |
| ----------- | ---------------------------------------- | ------------- |
| `cuisine`   | one of the cuisines in `common`          | all cuisines  |
| `minRating` | whole number 1 to 5                      | no minimum    |
| `maxRating` | whole number 1 to 5, not below the min   | no maximum    |
| `sort`      | `rating_desc` (best first), `rating_asc` | `rating_desc` |
| `page`      | 1 to 10,000                              | 1             |
| `limit`     | 1 to 50                                  | 12            |

It answers `{ items, page, limit, total, totalPages }`. Any invalid value is a 400 with a
detail for each parameter at fault; unknown parameters are ignored and never reach the
database query.

- **Rating bounds are inclusive and literal.** `minRating=4` keeps averages of 4.0 and up;
  `maxRating=4` keeps 4.0 and below, so a 4.6 is excluded.
- **Unrated restaurants come last in both orders**, because "no reviews" is neither the best
  nor the worst rating. Any rating bound excludes them.
- **Ties are broken by id**, so the order is stable and paging never repeats or skips one.
- A page past the end returns no items with the real `total`, so the client can tell "nothing
  matches" from "this page is past the last one".

**In the frontend**, the list's state lives in the URL (`/?cuisine=italian&sort=rating_asc`),
so every view can be bookmarked or shared and Back works. The first load is rendered on the
server from that URL, so the response already contains the restaurants (good for first paint,
shared links and crawlers). After that the browser takes over: a change updates the URL with
the History API, which Next.js syncs with `useSearchParams` without asking the server for a new
page, and RTK Query fetches the matching results from the API. Each combination is cached for
a minute, so switching back to one seen recently, or pressing Back, makes no request. While
new results load, the previous ones stay visible, dimmed under a progress bar. A filter change
returns to page 1. Creating, editing or deleting a restaurant invalidates the cached lists.

The last filters and order are saved in `localStorage`. Opening `/` with none in the URL applies
the saved ones; a URL that names any (a shared link) wins and becomes the saved choice. Saved
values and URLs are parsed leniently: anything invalid falls back to its default rather than
showing an error. Choosing a minimum above the current maximum clears the maximum, and the
other way round, so the combination sent to the API is always valid.

Other cases handled: an empty result with filters offers to clear them; a preview image that
fails to load is replaced by a placeholder; an unknown restaurant id gets the 404 page with a
real 404 status; an API outage shows an error page with a retry button.

## Reviews and ratings

- **One review per reviewer per restaurant.** The use case checks first, for a clear 409, and a
  unique index on `{ restaurant, author }` catches two requests sent at the same moment, which
  also answer 409. A reviewer who deletes their review may write a new one.
- **Who may review.** Only reviewers: the route requires the role, and the use case checks the
  account again when it loads the author's name. Owners and guests are refused (403 and 401).
  Only a review's author may delete it.
- **The author and restaurant come from the session and the URL**, never from the body, so a
  request cannot post as someone else or onto another restaurant.
- **The author's name is copied onto the review** when it is written, so listing reviews needs no
  join. Names cannot change after registration, so the copy cannot go stale.
- **Averages are recalculated, not adjusted.** After every review write, the restaurant's
  `ratingAvg` and `ratingCount` are worked out again from all of its reviews (`$group`) and
  stored. A standalone MongoDB has no multi-document transactions, so a review could be saved
  and the update after it fail; recalculating means the next review write corrects it, and
  running it twice is harmless. Averages are rounded to one decimal place, the precision they
  are shown and filtered at, so a restaurant shown as "4.0" always matches "4 stars or more".
- **Two review writes at once cannot leave an old average.** Each recalculation first takes the
  restaurant's next `ratingRevision` (an atomic `$inc`), then reads the reviews, and stores its
  result only if the revision is still its own. One that started later read the reviews later,
  so it saw at least as many, and it stores instead; the last to start always stores. Without
  this, a recalculation that read the reviews first but finished last would overwrite a newer
  average. `ratingCount` cannot do this job: it goes down when a review is deleted, and one review
  added while another is removed leaves it unchanged with a different average.
- **Deleting a restaurant deletes its reviews**, after the restaurant itself. If that second step
  fails, or a review is posted at the same moment, the reviews left behind cannot be reached; see
  [Cleaning up orphaned reviews](#cleaning-up-orphaned-reviews).

On a restaurant's page the first page of reviews is rendered on the server with the rest of the
page; further pages are fetched in the browser. A guest is asked to sign in, a reviewer sees
the form or their own review with a Delete button, and an owner sees only the reviews. After a
review is written or deleted, the server part of the page is refreshed, so the new average and
the first page of reviews arrive together.

Review dates are shown in the visitor's own time zone. The server cannot know that zone, so it
renders dates in UTC, and the browser does the same while hydrating so the markup matches; right
after, it re-renders them in its own zone (`components/LocalDate.tsx`, using `useHydrated`). The
two can differ by a day near midnight. Hovering or focusing a date shows the exact time and the
zone, for example "17 Oct 2026, 02:35 GMT+14".

On `/account`, a reviewer sees all of their reviews, newest first, ten per page, each under the
name of its restaurant. The names are looked up when the list is read (one query per page) rather
than copied onto the reviews, because owners can rename restaurants. Deleting a review there
updates the restaurant's average just as it does on the restaurant's page.

### Cleaning up orphaned reviews

A review whose restaurant no longer exists is an orphan. Deleting a restaurant removes the record
first and its reviews second, so that a failure never leaves a listed restaurant without its
reviews. The price is that a failure between the two steps, or a review posted at the moment the
restaurant is deleted, leaves reviews behind. Nobody can open them: the restaurant's page is gone,
and "My reviews" leaves them out. But they still count towards that list's totals, so its page
count can be too high and a page can come up short.

`pnpm reviews:delete-orphans` deletes them. It finds every restaurant id that reviews point to,
keeps the ones that still exist, and deletes the reviews of the rest. Add `--dry-run` to only
count them. It is safe to run at any time and as often as wanted: a review whose restaurant
exists is never touched, and a run that overlaps a restaurant deletion only removes what that
deletion would.

**In production, schedule it.** Orphans are rare, but nothing else removes them.

- **What to run:** `pnpm build` bundles the job alongside the server, as
  `backend/dist/delete-orphaned-reviews.js`. In `backend/`, run
  `node dist/delete-orphaned-reviews.js` (or `pnpm job:delete-orphaned-reviews`) with the same
  environment as the API. It connects only to MongoDB and needs no `tsx`.
- **How often:** daily is plenty, at a quiet hour. It reads one id per reviewed restaurant, so
  it stays cheap as data grows.
- **Where:** whatever runs scheduled jobs next to the API. For example, a cron entry on the API's
  server (`0 3 * * * cd /srv/app/backend && node dist/delete-orphaned-reviews.js`), an Amazon
  EventBridge Scheduler rule that starts the same command as an ECS task, or a scheduled
  function if the API itself is deployed as one.
- **Watching it:** it prints how many reviews it deleted, and exits non-zero if it fails (for
  example when MongoDB cannot be reached), so the scheduler's failure alerts cover it. A count
  that keeps growing points at restaurant deletions that keep failing halfway, which is worth
  looking into.

## Accounts and security

**Registration** takes two requests. `request-otp` emails a 6-digit code; `register` sends the
details and the code together, and the user record is written only if the code is right. There is
never an unverified account in the database.

- A code lasts 10 minutes, allows 5 attempts (counted atomically, so parallel guesses cannot exceed
  the limit), and works once. Only a keyed hash of it is stored, bound to the email it was sent to.
- A new code can be requested for an address once every 60 seconds.
- `request-otp` answers the same way for every address. If the address already has an account, the
  email it receives says so and contains no code, so the endpoint cannot be used to find out which
  emails are registered.
- The role is chosen at registration from `reviewer` or `owner` and cannot be changed afterwards.

**Signing in** returns the same `INVALID_CREDENTIALS` error for a wrong password and an unknown
email, and does the same password-hashing work in both cases so timing does not distinguish them.

**Resetting a forgotten password** ("Forgot your password?" on the sign-in page, `/reset-password`)
works like registration: `password-reset/request` emails a code, and `password-reset/confirm`
sends the address, the code and the new password together.

- The codes follow the same rules as registration codes, through the same code (`EmailCodes`): 10
  minutes, 5 attempts, single use, a keyed hash only, and one request per minute per address.
- Each code is stored with its purpose, so the two kinds are separate. A registration code
  cannot reset a password, and a reset code cannot create an account. Asking to register with
  someone's address cannot cancel their pending reset either, since that only replaces the
  registration code.
- `password-reset/request` answers 204 for every address. An address without an account is
  emailed a notice instead of a code, so neither the answer nor the time it takes shows which
  addresses have accounts.
- The new password must meet the registration rules. Saving it ends every session of the
  account, on every device, then signs the user in on this one. Someone signed in with the old
  password (often the reason for a reset) loses access at their next refresh. An access token
  they already hold keeps working for at most its remaining minutes, as after signing out.
- Both endpoints share the rate limits of their registration counterparts: 5 emailed codes and 20
  code or password checks per 15 minutes per client.

**Staying signed in** uses an access token and a refresh token. The browser receives both in
`HttpOnly` cookies, which page scripts cannot read, and each cookie is scoped by path to where it
is needed. A mobile client, which cannot rely on a browser's cookie jar, sends `X-Client: mobile`
when registering, signing in or resetting the password, and also gets both in the body as
`tokens`. Without that header the body holds only the user.

| Token   | Cookie          | Sent to                  | Lifetime   | What it is                                                     |
| ------- | --------------- | ------------------------ | ---------- | -------------------------------------------------------------- |
| Access  | `access_token`  | `/api`                   | 15 minutes | A signed JWT (HS256) carrying the user id, role and session id |
| Refresh | `refresh_token` | `/api/auth/refresh` only | 7 days     | A random secret; the server stores only its hash               |

- Protected endpoints require a valid access token and answer `401 UNAUTHENTICATED` without one.
  A mobile client may send it as `Authorization: Bearer <token>` instead of the cookie; when both
  are sent, the header is used.
  They trust its signed claims (user id, role, session id) and do not query the database to
  authenticate, so the check costs nothing per request.
- `POST /api/auth/refresh` exchanges the refresh token for a new access token. It is the only
  endpoint the browser sends the refresh token to, and the token is accepted nowhere else: it is
  not a JWT, and the access token cannot be used in its place. A mobile client sends it as
  `refreshToken` in the body instead (which wins over the cookie when both are sent) and, with
  `X-Client: mobile`, gets the new access token back as `accessToken`.
- When a request fails because the access token has expired, the frontend refreshes once and
  repeats the request, so the user stays signed in for the refresh token's lifetime without
  noticing.
- Signing out requires the access token, which names the session to end. The session record is
  deleted, so its refresh token can never produce another access token. Each device has its own
  session and is signed out separately.
- An issued access token cannot be revoked, which is why it is short-lived: after sign-out a
  copied one works for at most its remaining minutes.
- Cookies are `SameSite=Lax` (`Strict` for the refresh token) and `Secure` in production. A
  refresh that finds nothing to resume (no refresh token, an unknown or expired one, or a removed
  account) clears both and answers `401 SESSION_ENDED`. That is the only answer that means the
  session is over: the frontend treats any other failed refresh (the API unreachable, a 5xx,
  a 429) as "could not tell", keeps the user signed in, and tries again on the next request.
- Because the claims are trusted as issued, they can be out of date for as long as an access
  token lives. Two checkpoints do read the database and catch an account that has been removed:
  `GET /api/auth/session`, which the UI calls on every page load, and the refresh. Either one
  ends the session and clears the cookies, so the UI shows such a user as signed out on their
  next page load. Roles never change, so the role claim cannot go stale.
- Lifetimes are set with `ACCESS_TOKEN_TTL_MINUTES` and `REFRESH_TOKEN_TTL_DAYS`.

Cookies were chosen over a bearer token in a header for the web frontend: an `HttpOnly` cookie
cannot be read by injected script, whereas a bearer token must be held where script can reach it.
The web frontend never sends `X-Client: mobile`, so its responses never carry a token page script
could read. A bearer header is never sent automatically, so it needs no CSRF defence. The cost of
cookies is that they are sent automatically, so state-changing requests are protected against CSRF by `SameSite` and the Origin check below.

**Other protections**

- Passwords are hashed with bcrypt and never returned by the API.
- Every request body is validated with the zod schemas in `common`; unknown fields are dropped.
- State-changing requests that carry an `Origin` header must come from an allowed origin (CSRF
  defence in addition to `SameSite`).
- Rate limits per client IP: 5 code requests and 20 sign-in or registration attempts per 15 minutes.
  These counters are held in the memory of one server process, which suits a single long-running
  server. Behind several instances or on serverless functions they would need a shared store
  (or a limit at the gateway); the per-address code cooldown and attempt limit are stored in
  MongoDB and hold in any deployment.
- API responses are sent with `Cache-Control: no-store`.

**In the frontend**, the token cookies are invisible: they are `HttpOnly`, and they are not sent
with page requests. So the frontend keeps its own hint: on sign-in it writes a cookie,
`signed_in`, whose value is the account type (`owner` or `reviewer`), and removes it on sign-out
or when a session turns out to have ended. The API never sets or reads this cookie. It holds no
secret and grants nothing: if it is stale or edited, the worst outcome is an empty page shell that
the API refuses to fill, or one refresh request that comes back `SESSION_ENDED`.

The hint is used in two places:

- `src/proxy.ts` redirects before a page renders: guests away from pages that need a session,
  reviewers away from the owner pages (`/owner/...`), and signed-in users away from the sign-in
  and register pages.
- On load, the app only tries to resume a session when the hint is present, so guests make no
  refresh request.

Because a hint can be wrong, pages also guard themselves once the real session is known:
`RequireAuth` wraps pages that need a session, `GuestOnly` wraps the sign-in and register pages,
and the layout at `app/owner/layout.tsx` admits only owners to everything under `/owner`. Because
it is a layout, a new owner page is protected without doing anything, and nothing of the owner
area (not even a page heading) renders for anyone else. After signing in, the user returns to the
page they asked for; the `next` parameter is only honoured for same-site paths.

All of this is for navigation only. The API is what enforces access, on every request.

## Backend architecture

The backend follows a hexagonal (ports and adapters) layout:

```
backend/src/
  domain/         what the business is: entities and rules. Imports only @restaurant-reviews/common.
  application/    what the system does: one use-case class per action, plus the ports
                  (interfaces) those use cases need from the outside world.
  infrastructure/ everything that touches a framework, the network or the process.
    adapters/
      inbound/http/   Express app, routes, controllers and middleware that call use cases.
      outbound/       implementations of the ports: Mongoose repositories, email senders
                      (console, SMTP, SES), password hashing, tokens.
    database/         MongoDatabase: connect, disconnect, ping.
    config/           validated environment (@t3-oss/env-core + zod).
  types/          ambient type declarations (the Express request augmentation).
  container.ts    composition root: the one place that wires adapters into use cases.
  server.ts       process entry point.
backend/scripts/   one-off commands run with tsx, outside the app (for example storage setup).
```

Dependencies point inward only: infrastructure knows about the application layer, never the
reverse. Use cases can therefore be unit-tested with in-memory fakes, and the HTTP layer can be
tested without a database. ESLint enforces the direction: files in `domain/` and
`application/` may import only `@restaurant-reviews/common` and their own layers, so an import
of Express, Mongoose, the AWS SDK, a Node built-in or anything under `infrastructure/` fails
the lint. A use case that needs the outside world gets a port in `application/ports` instead.

The code is class-based with constructor injection. A use case is a class with a single `execute`
method that receives its ports through the constructor; adapters are classes that implement a port
interface; controllers are classes that receive use cases. One-shot setup steps that hold no state
(`buildContainer`, `createApp`, `loadEnv`) are plain functions. Nothing constructs its own
collaborators, so `container.ts` is the only file that names concrete adapters. Entities that are
plain data (`User`) are interfaces; an entity becomes a class when it carries rules of its own
(`EmailOtp` knows when it has expired and when it may be resent).

Every Mongoose repository extends `MongooseRepository` and makes its database calls through its
`run` method. That one place retries transient failures (network errors, failovers) with backoff
and converts MongoDB errors into the backend's own types: a unique-index violation becomes
`CONFLICT`, a schema or cast failure becomes `VALIDATION_FAILED`, and an unreachable database
becomes `SERVICE_UNAVAILABLE`. Operations that must not run twice, such as inserts, opt out of
the retry.

Each Mongoose record type is inferred from its schema (`InferSchemaType`), so the schema is the
only description of what is stored. Repositories map records to the domain entities through
typed `toEntity` functions, which fail to compile when an entity and its schema disagree.

Imports are written without file extensions. `common` is a library, so it is built with tsup,
which produces the bundle and its type declarations together. `backend` is an application, so it
is bundled with esbuild directly (see `backend/build.mjs`); in development it runs straight from
TypeScript with tsx.

## Frontend structure

```
frontend/src/
  app/             routes, layout and providers (Next.js App Router).
  components/      feature components.
  components/ui/   the app's UI kit, the only folder that imports Material UI.
  components/forms/ react-hook-form fields: FormTextField, FormSelectField, FormRadioField,
                   FormRatingField, ImageUploadField.
  hooks/           every custom React hook, e.g. useListPreferences (list navigation and
                   remembered filters), useHydrated (server output until hydration is done).
  lib/             framework-free helpers, e.g. listQuery (URL <-> filters), serverApi (fetches
                   for server components).
  store/           Redux store and the RTK Query API slice.
  proxy.ts         redirects before render, based on the sign-in hint cookie.
  theme.ts         Material UI theme.
```

Pages and feature components import from `@/components/ui`, never from `@mui/material`; an ESLint
rule enforces this. The kit re-exports the primitives used as-is (`Stack`, `Typography`, ...) and
adds components with app-specific behaviour (`PageContainer`, `LinkButton`, `StatusAlert`). The
component library is therefore a dependency of one folder, and shared defaults live in one place.

Forms are built from the fields in `components/forms`. Each takes the form's `control` and a field
`name`, and reads its own value and validation message, so a form names a field once:
`<FormTextField control={control} name="email" label="Email" />`. Every field is controlled: the
form holds the value and the widget shows it, so a value the form fills in itself (the restaurant
page address suggested from its title) displays exactly like a typed one. Typing re-renders only
the field being typed in, not the whole form.

The root layout provides what every page shares: the nav bar, the footer, the `main` landmark with
its spacing, and the page-width container. A page only renders its own content. On phones the nav
bar keeps the title and one control: "Sign in" for guests (the sign-in page links to
registration), or the account menu, opened from the user's initial.

Every page works from a 320 px phone up: no page scrolls sideways at 320, 375, 768 or 1280 px
wide, checked for guests, reviewers and owners. Heading sizes scale with the screen
(`responsiveFontSizes` in `theme.ts`), card grids go from one column to three, rows that can
wrap use a real gap so wrapped items stay aligned, and form actions stack full width on phones.

Public pages (`/` and `/restaurants/[slug]`) are server components that fetch from the API
directly (`lib/serverApi.ts`, never bundled for the browser) and hand the data to client
components. The list then fetches further pages with RTK Query, as the signed-in pages do. The
list's loading skeleton sits in the `(list)` route group so that it does not wrap the restaurant page: a loading boundary there
would start the response before the page can call `notFound()`, and the 404 would be sent with
status 200.

## Design decisions and trade-offs

- **One origin for the browser.** Next.js rewrites `/api/*` to Express, so the session cookies
  are first-party and no CORS configuration is required.
- **A store per request.** The Redux store is created by a factory inside a client provider, the
  recommended pattern for the App Router, so server renders never share state between requests.
- **Unexpected errors are opaque.** Anything that is not a known domain error is logged server-side
  and returned as a generic 500, so internal details never reach the client.
- **Server rendering for the first load only.** The list and restaurant pages are rendered on
  the server for first paint, shared links and crawlers; later changes are fetched in the browser
  and cached by RTK Query. The server fetches are not cached between requests (see below).
- **Email verification before the account exists.** No unverified accounts are ever stored, at
  the cost of a two-step registration form.
- **Trusted access-token claims.** Protected requests do not query the database to authenticate.
  The price is that a removed account keeps working for at most one access-token lifetime
  (15 minutes), and the session check on page load signs it out of the UI sooner.
- **Recalculated ratings without transactions.** See Reviews and ratings: correct after the next
  write even if one update is lost, and a revision counter keeps simultaneous writes from leaving
  an old average. The cost is one extra small write per review write.
- **Orphaned reviews are swept up, not prevented.** Deleting a restaurant and its reviews is two
  writes without a transaction; rather than a soft-delete flag checked everywhere, a scheduled job
  removes the rare reviews left behind (see Cleaning up orphaned reviews).
- **Reviews are not edited, only deleted and rewritten.** It keeps one code path for rating
  changes; editing would be a small addition.

### Known limitations and next steps

- Rate limits live in one process's memory: fine for a single server, but several instances or
  serverless functions would need a shared store (Redis) or limits at the gateway.
- No idempotency keys on `POST` requests. A retried create after a lost response can create a
  second restaurant; reviews are already protected by their unique index. An `Idempotency-Key`
  header stored with the response for a day would close this.
- Server-side caching is not used yet. The next step would be the Next.js data cache with tags
  for the list and restaurant pages, expired on demand by a secret-protected route that Express
  calls after restaurant and review writes.
- Remembered filters are stored in `localStorage`, so a returning visitor briefly sees the
  default list before their filters apply. Keeping them in a cookie read by `proxy.ts` would
  redirect before the page renders.
- Uploads are checked by their first bytes, not decoded. That proves a file starts like a JPEG,
  PNG or WebP, not that it is only one: data can be appended after the image (a "polyglot"),
  and photos keep their metadata, including any GPS position. Decoding and re-encoding each
  upload with an image library such as `sharp` would prove it is a real image, drop anything
  appended and strip the metadata, at the cost of a native dependency and some CPU per upload.
  Until then the separate image origin and the CDN's `nosniff` and sandbox headers contain a
  file that slips through.
- Images are uploaded as chosen, up to 5 MB. Shrinking and re-compressing them in the browser
  before uploading (for example to at most 1600 px wide, as JPEG or WebP, with a canvas) would
  turn a typical 4 MB phone photo into a few hundred KB: faster uploads on mobile connections,
  and less wasted when an owner swaps images before saving. Uploads start as soon as an image is
  chosen, so that saving is quick and a bad file is reported at once; this would make each of
  those uploads cheaper. It is about size, not safety: server-side re-encoding (above) would
  still be needed to trust the content.
- Express trusts forwarding headers only from the local Next.js proxy (`trust proxy` is
  `'loopback'`). Behind CloudFront or a load balancer it would need configuring for that proxy
  (for example through an environment variable), or every visitor would appear to share one
  address and one rate-limit counter.
- Deleted images can stay in the CDN cache until it expires (nothing links to them any more).
- LocalStack does not enforce presigned-POST signatures or bucket policies; AWS does.
- No end-to-end test suite runs in CI; each phase was checked in a browser with Playwright.
