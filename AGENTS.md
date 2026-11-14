# Agent guide

Instructions for coding agents (and people) changing this repository. `README.md` explains what
the app does and why it is built the way it is; read the section for the area you are changing
before you change it. This file covers how to work in the code.

## The project

Restaurant Reviews: owners list restaurants, reviewers rate them, guests browse. A pnpm
workspace with three packages:

| Package    | Name                           | What it is                                                         |
| ---------- | ------------------------------ | ------------------------------------------------------------------ |
| `common`   | `@restaurant-reviews/common`   | zod schemas, DTO types and constants used by both apps; tsup build |
| `backend`  | `@restaurant-reviews/backend`  | Express 5 + Mongoose, hexagonal architecture, class-based          |
| `frontend` | `@restaurant-reviews/frontend` | Next.js 16 App Router + Material UI + Redux Toolkit / RTK Query    |

Node 24 (`.nvmrc`) and pnpm 10. MongoDB runs locally; LocalStack (S3) and an nginx CDN run in
Docker.

## Commands

Run from the repository root.

| Command                 | Use                                                                   |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm dev`              | Builds `common`, then runs all three packages in watch mode           |
| `pnpm infra:up`         | Starts LocalStack and the CDN, sets up the bucket                     |
| `pnpm seed [--reset]`   | Demo accounts (password `Password123`), restaurants and reviews       |
| `pnpm typecheck`        | Type-checks every package. Build `common` first if its source changed |
| `pnpm test:unit`        | Unit tests; need nothing running                                      |
| `pnpm test:integration` | Integration tests; need MongoDB (and LocalStack for storage tests)    |
| `pnpm test`             | Both                                                                  |
| `pnpm lint:fix`         | ESLint with fixes. Never undo an autofix to keep a diff small         |
| `pnpm format`           | Prettier                                                              |

Build `common` with `pnpm --filter @restaurant-reviews/common build`. The other packages import
its built output, so a change to `common` is invisible to them until it is rebuilt (`pnpm dev`
rebuilds it on save).

## Before you call a change done

1. `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check .` and `pnpm test` all pass.
2. A change to behaviour has tests, and the README section describing that behaviour is updated
   (API table, design notes, known limitations).
3. A UI change has been tried in a browser, at phone width (320 px) as well as desktop.

The Git hooks run lint-staged on commit and typecheck, lint, format check and unit tests on push.
Do not bypass them with `--no-verify`; fix what they report.

## Backend

Layers, enforced by ESLint (`eslint.config.js`):

- `domain/`: entities and errors. May import only `@restaurant-reviews/common` and itself.
- `application/`: use cases, ports (interfaces) and services. May import `common`, `domain/` and
  itself. Never Express, Mongoose, the AWS SDK or `infrastructure/`.
- `infrastructure/`: adapters that implement the ports (Mongoose, S3, email, crypto), the HTTP
  app (routes, controllers, middleware, presenters) and config.
- `container.ts` is the only place that chooses an implementation for each port.

Conventions:

- A use case is a class with one `execute` method and receives its collaborators through its
  constructor. Logic shared by several use cases is an application service (`EmailCodes`,
  `RestaurantImages`, `OwnedRestaurants`, `RestaurantRatings`).
- Use cases throw a `DomainError` subclass for a broken rule (`ValidationError`,
  `ConflictError`, ...); the error handler maps each code to a status. Give the error `details`
  with a `path` when the form should show it on a field. A repository returns `null` when "not
  found" is a normal answer.
- Every Mongoose repository extends `MongooseRepository` and calls the database through `run()`,
  which retries transient failures and translates MongoDB errors. Pass `retry: false` for an
  insert or anything else that must not run twice.
- Record types come from the schema with `InferSchemaType`. When you change a schema, update
  the entity, the mapper and the type-level test in `inferredRecords.test.ts`.
- Controllers use arrow-function properties. Request bodies are validated by `validateBody`
  with a schema from `common`; queries by `validateQuery`, which puts the result on
  `req.validatedQuery` (Express 5 makes `req.query` read-only).
- The owner of anything is taken from the access token (`req.auth`), never from the body.
- Responses never expose storage keys or password hashes: presenters in `presenters/` build the
  DTOs.
- Time is read with `new Date()`. Tests move it with `tests/support/time.ts`.
- Auth endpoints that take an email answer the same way, in about the same time, whether or not
  the address has an account (see "Accounts and security" in the README). Keep it that way.

## Frontend

- Only `src/components/ui/` imports Material UI (ESLint enforces it); everything else imports
  from `@/components/ui`.
- The root layout draws the page frame; pages render only their content.
- Forms use react-hook-form with the zod schema from `common`, through the fields in
  `components/forms/`, each taking `control` and `name`. Show API field errors with
  `applyFieldErrors`.
- API calls go through RTK Query in `src/store/apiSlice.ts`. Server components fetch with
  `src/lib/serverApi.ts` (server-only).
- Custom hooks live in `src/hooks/`; framework-free helpers in `src/lib/`.
- Public restaurant pages are addressed by slug (`/restaurants/<slug>`, `lib/restaurantPath.ts`);
  owner pages use the id.
- `src/proxy.ts` redirects using the `signed_in` hint cookie. It is a convenience, not security:
  the API authorises every request.
- `frontend/AGENTS.md` holds Next.js's own agent rules. This Next.js version differs from older
  ones; read the guide it points to before using an unfamiliar API.

## Common

Put something in `common` only if both apps use it. Validation rules belong in its zod schemas,
so the browser and the API apply the same ones.

## Tests

- Tests live in each package's `tests/`, mirroring `src/`. Shared fakes and fixtures are in
  `tests/support/`.
- `*.test.ts` is a unit test (in-memory fakes, no services); `*.int.test.ts` is an integration
  test. Backend integration tests use the `restaurant_reviews_test` database and run one file at
  a time.
- Use cases are tested through the fixtures in `tests/support/` (`createAuthFixture`,
  `createRestaurantFixture`); HTTP routes through the real app (`createTestApp`).
- Test names say what the behaviour is, not what the code does.

## Things that are easy to get wrong

- **Mongoose creates indexes but never drops them.** Changing or removing a unique index leaves
  the old one in existing databases, including the local test database. Drop it by hand.
- **No `loading.tsx` above `/restaurants/[slug]`.** A loading boundary starts streaming before
  the page can call `notFound()`, so a 404 would be sent as a 200. The list's skeleton lives in
  the `(list)` route group for this reason.
- **LocalStack is pinned to 4.4.0** (later images need an account token) and does not enforce
  presigned-POST signatures or bucket policies. Do not take a passing LocalStack test as proof
  that AWS will accept or refuse the same request.
- **Emails are printed, not sent,** with the default `EMAIL_PROVIDER=console`: verification and
  reset codes appear in the `api` output of `pnpm dev`.
- **`next dev` rewrites the managed block in `frontend/AGENTS.md`.** Commit the file rather than
  reverting its change.

## Writing

- Comments explain why, not what. Exported functions, classes and types get a JSDoc summary.
- Match the surrounding code's naming and comment density.
- Commit messages: a short summary line, then what changed and why.
