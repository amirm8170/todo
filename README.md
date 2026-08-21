# Todo App

A simple full-stack todo app. Each todo belongs to one calendar day.

- **Frontend:** React + TypeScript + Vite — see [`client/README.md`](client/README.md)
- **Backend:** NestJS + TypeORM + MySQL
- **Todos:** date-based (`taskDate`, MySQL `DATE`). The list is filtered with `GET /todos?date=YYYY-MM-DD`
- **Auth:** JWT access token in the response body, refresh token in an HttpOnly cookie
- **API docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **phpMyAdmin:** [http://localhost:8080](http://localhost:8080)

You can run it with Docker Compose or start the server and client separately.

## Project structure

```text
project-root/
  server/                 NestJS API
    src/
      auth/               Login, register, refresh, logout
        dto/
        guards/
        strategies/
      users/
        entities/         User TypeORM model
      todos/
        dto/
        entities/         Todo TypeORM model
      common/
        decorators/       Shared request helpers
        types/            Shared TypeScript types
      app.module.ts
      main.ts
    postman/              Collection and local environment
    package.json
    Dockerfile
    .env.example
  client/                 React app
    src/
      pages/              Login, register, todos
      auth/               Auth context and route guards
      components/         Todo form and todo item
      api.ts              HTTP helper
      App.tsx
    package.json
    Dockerfile
    .env.example
  docker-compose.yml
  README.md
  .env.example
```

## Backend architecture

Each request moves inward, one layer at a time:

1. **Controller layer**  
   Receives the HTTP request. It does not talk to MySQL directly.

2. **DTO layer**  
   Validates the request body with `class-validator`.

3. **Guard / Strategy layer**  
   Protected routes check the JWT first. Todo routes use the access token. Refresh and logout use the refresh cookie.

4. **Service layer**  
   Business logic: hash passwords, create tokens, make sure a todo belongs to the current user.

5. **Entity layer**  
   TypeORM models in `users/entities/` and `todos/entities/` for the `users` and `todos` tables.

6. **Database layer**  
   MySQL, reached through TypeORM.

```text
HTTP request
  -> Controller
    -> DTO validation
      -> Guard (if the route is protected)
        -> Service
          -> Entity / TypeORM
            -> MySQL
```

## Frontend architecture

- **Pages**  
  `LoginPage`, `RegisterPage`, and `TodosPage`. Routes send guests to `/login` and send logged-in users to `/`.

- **API client** (`src/api.ts`)  
  One `fetch` helper. It always sends `credentials: 'include'` so the refresh cookie is included. Protected calls add `Authorization: Bearer <accessToken>`. If a call returns `401`, it tries `/auth/refresh` once and retries.

- **Auth state** (`src/auth/AuthContext.tsx`)  
  Holds the current user. The access token stays in memory. On page load, the app calls refresh to restore the session from the cookie.

- **Todo components**  
  `TodoSheet` adds or edits a todo. `TodoItem` is one list row (complete, menu for edit/delete). `PhoneFrame` is the mobile full-screen / desktop phone panel.

## Auth flow

1. **Register** (`POST /auth/register`)  
   The API hashes the password with bcrypt, creates the user, returns an access token, and sets the refresh cookie.

2. **Login** (`POST /auth/login`)  
   Same token response after the password is verified.

3. **Access token**  
   Short-lived (default `15m`). Stored in React memory and sent as `Authorization: Bearer ...` on todo requests.

4. **Refresh token**  
   Longer-lived (default `7d`). Stored as an **HttpOnly cookie** (`refresh_token`, path `/auth`). The database stores only a bcrypt hash of it. `POST /auth/refresh` reads the cookie, checks the hash, rotates the token, and returns a new access token.

5. **Logout** (`POST /auth/logout`)  
   Uses the refresh cookie, deletes the stored hash, and clears the cookie. The frontend also forgets the access token and user.

`passwordHash` and `refreshTokenHash` are never returned in JSON.

## Swagger documentation

Interactive API docs are at [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

1. Call **Auth → Register** or **Login**. That sets the refresh cookie and returns an `accessToken`.
2. Click **Authorize** and paste the access token (Bearer).
3. Todo routes can be tried from the same page.
4. **Refresh** and **Logout** use the `refresh_token` cookie (same origin as the API).

Frontend notes live in [`client/README.md`](client/README.md).

## Todo flow

All todo routes require a valid access token. The server always filters by the logged-in user. Another user's todo looks like a `404`. Soft-deleted todos are omitted.

Each todo has a `taskDate` (calendar date only, stored as MySQL `DATE`). `GET /todos?date=YYYY-MM-DD` returns that day's todos, including completed items. If `date` is omitted, the API defaults to today.

The frontend splits that list: **active** todos (`completed === false`) show in the main list. **Completed** todos stay in the database and can be restored; they are not soft-deleted.

| Action | Method | Path |
| --- | --- | --- |
| Create | `POST` | `/todos` (body may include `taskDate`) |
| Read by date | `GET` | `/todos?date=YYYY-MM-DD` |
| Read one | `GET` | `/todos/:id` |
| Update | `PATCH` | `/todos/:id` (may include `taskDate`) |
| Delete | `DELETE` | `/todos/:id` (soft delete) |

## How to run without Docker

You need Node.js and a running MySQL instance.

### 1. Environment files

```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In `server/.env`, set `DB_HOST=localhost` when MySQL runs on your machine.

### 2. Server

```bash
cd server
npm install
npm run start:dev
```

API: [http://localhost:3000](http://localhost:3000)  
Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### 3. Client

```bash
cd client
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

Frontend details: [`client/README.md`](client/README.md)

## How to run with Docker

Use `DB_HOST=mysql` in the root `.env` (that is the Compose service name).

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3000](http://localhost:3000)
- Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- phpMyAdmin: [http://localhost:8080](http://localhost:8080)
- MySQL: `localhost:3306`

Useful commands:

```bash
docker compose logs -f server
docker compose logs -f client
docker compose down
```

Source folders are mounted as volumes, so the Nest watch mode and Vite dev server reload when you edit files.

`docker compose down` stops the containers. Add `-v` only if you also want to delete the MySQL data volume.

## Environment variables

Root `.env` is what Docker Compose reads. `server/.env` and `client/.env` are for running each app on your machine.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `PORT` | server | API port (`3000`) |
| `CLIENT_PORT` | Docker | Host port for Vite (`5173`) |
| `NODE_ENV` | server | `development` or `production` |
| `DB_HOST` | server | `mysql` in Docker, `localhost` on your machine |
| `DB_PORT` | server / MySQL | `3306` |
| `DB_USERNAME` | server / MySQL | Database user |
| `DB_PASSWORD` | server / MySQL | Database password |
| `DB_DATABASE` | server / MySQL | Database name |
| `MYSQL_ROOT_PASSWORD` | MySQL / phpMyAdmin | MySQL root password |
| `PHPMYADMIN_PORT` | Docker | Host port for phpMyAdmin (`8080`) |
| `JWT_ACCESS_SECRET` | server | Signs access tokens |
| `JWT_REFRESH_SECRET` | server | Signs refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | server | Example: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | server | Example: `7d` |
| `CORS_ORIGIN` | server | Must be the React origin, `http://localhost:5173` |
| `VITE_API_URL` | client | Browser URL for the API, `http://localhost:3000` |

Change the JWT secrets before using this outside local development.

## Common problems and fixes

**The frontend loads, but login/register fails**  
Check `VITE_API_URL=http://localhost:3000` and `CORS_ORIGIN=http://localhost:5173`. They must match what you type in the browser.

**`401` right after login, or you are bounced back to login on refresh**  
The refresh cookie is not being sent. CORS must have `credentials: true`, and the client `fetch` calls must use `credentials: 'include'`. `CORS_ORIGIN` must be exactly `http://localhost:5173` (no trailing slash).

**`ECONNREFUSED` from the server**  
Without Docker, set `DB_HOST=localhost` and start MySQL. With Docker, set `DB_HOST=mysql` and wait until MySQL is healthy: `docker compose logs -f mysql`.

**MySQL login fails after you changed `.env` passwords**  
Old data may still be in the volume. Reset it with `docker compose down -v && docker compose up --build`.

**Todo requests return `401`**  
The access token expired. The client should refresh automatically. If the refresh cookie is missing, sign in again.

**Code changes do not reload in Docker**  
Restart with `docker compose up --build`. The Compose file mounts `./server` and `./client` into the containers.

**Port already in use**  
Change `PORT`, `CLIENT_PORT`, or `PHPMYADMIN_PORT` in `.env`, or stop the other process.

## Commands

```bash
# local
cd server && npm install && npm run start:dev
cd client && npm install && npm run dev

# docker
docker compose up --build
docker compose down
docker compose logs -f server
docker compose logs -f client
```
