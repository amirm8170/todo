# Todo API

NestJS backend for the Todo app (JWT access token + HttpOnly refresh cookie, TypeORM + MySQL).

Each todo belongs to one calendar day (`taskDate`). The column is MySQL `DATE` (date only, no time). `GET /todos?date=YYYY-MM-DD` returns that day's todos for the logged-in user, **including completed ones**. If `date` is omitted, the API defaults to today. Soft-deleted todos are never returned. Completing a todo sets `completed: true`; it is not deleted. Create and update accept `taskDate`; existing rows default to today.

Full project setup is in the [root README](../README.md).

```bash
cp .env.example .env
npm install
npm run start:dev
```

API: [http://localhost:3000](http://localhost:3000)

## Postman

A collection and a local environment live in `postman/`:

- `server/postman/todo-api.postman_collection.json`
- `server/postman/todo-api.local.postman_environment.json`

### Import

1. Open Postman.
2. Import `server/postman/todo-api.postman_collection.json`.
3. Import `server/postman/todo-api.local.postman_environment.json`.
4. Select the **Todo API Local** environment (top-right).

`baseUrl` is `http://localhost:3000`. Todo requests send `Authorization: Bearer {{accessToken}}`.

### Cookies

The refresh token is **not** in the JSON body. Login and register set an HttpOnly `refresh_token` cookie (`path=/auth`).

Keep cookies enabled in Postman (this is the default in the desktop app). On Postman web, turn on the Interceptor. Refresh and logout need that cookie from a prior login or register in the same session.

Login (and register) scripts save `accessToken` from the response. If a `refreshToken` field is ever present in the body, they save that too. Create todo saves the new id as `todoId`.

### Request order

1. Register or Login
2. Create todo (`taskDate` in the body)
3. Get todos by date (`GET /todos?date=YYYY-MM-DD`)
4. Update todo
5. Complete/uncomplete todo
6. Soft delete todo

Get one todo also uses `{{todoId}}` after Create todo. `Get todos (default today)` calls `GET /todos` with no query and returns today's list.

## Swagger

Interactive API docs are still at [http://localhost:3000/api/docs](http://localhost:3000/api/docs).
