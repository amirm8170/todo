# Todo frontend

React + TypeScript + Vite client for the Todo API.

It is a small UI for register, login, and managing your own todos. There is no large UI framework.

## Design

The look is inspired by this CollectUI todo-list reference (direction only, not a pixel copy):

[Todo list UI on CollectUI](https://collectui.com/designs/todo-list-ui-design-inspiration/28d55381-1890-49ae-95f0-4a7014c656cd)

Visual direction:

- Minimal mobile todo app, not a desktop dashboard
- White app surface, grayscale page, almost no color
- Simple list rows with circular checkboxes
- Date header with previous/next arrows (`Today` when the selected day is today)
- A **Today** pill under the date jumps back to today from any other day (disabled while already on today)
- The list only shows todos for the selected date. Adding a todo sends that date as `taskDate`
- Floating `+` button opens an add sheet (title, optional description, Cancel, Add)
- Every row has a visible `···` button on the right. It opens a menu with **Edit** and **Delete**
- On phones the `···` button is always visible. On desktop it stays visible and darkens on hover
- Edit opens the same sheet, pre-filled. Delete asks for confirmation first
- Checking a todo plays a falling-letter animation, then the row leaves the active list
- Fallen letters stay in a pile at the bottom of the phone. Each completed todo also gets a restore chip with its title (`↻ Buy milk`)
- Restoring a chip sends the letters/chip back up and returns the todo to the active list
- `prefers-reduced-motion` skips the falling letters and other motion

Responsive layout:

- **320px–767px:** the app is full screen. No phone frame, no side margins that shrink the list.
- **768px and up:** the app sits in a centered phone-like panel (rounded corners, light shadow) on a soft gray background.
- **1024px and desktop:** same phone panel, a bit taller/wider gray canvas around it.

Subtle motion lives in CSS plus a little JavaScript that splits title/description into characters for the completion animation. `prefers-reduced-motion` turns animations off.

Main CSS lives in `src/index.css`. Components:

- `src/phone.tsx` — full-screen on mobile, phone panel on larger screens, overlay layer for letters
- `src/components/AuthForm.tsx` — login and register
- `src/components/TodoItem.tsx` — one list row, including the `···` action menu
- `src/components/TodoSheet.tsx` — add/edit bottom sheet
- `src/components/FallingLetters.tsx` — completion letter-fall overlay
- `src/components/RestoreDock.tsx` — restore buttons for completed todos


The backend lives in `../server`. Full project setup is in the [root README](../README.md).

## Folder structure

```text
client/
  src/
    pages/
      LoginPage.tsx
      RegisterPage.tsx
      TodosPage.tsx
    auth/
      AuthContext.tsx      # current user + login/register/logout
      ProtectedRoute.tsx   # guests go to /login
      PublicRoute.tsx      # logged-in users go to /
    components/
      phone.tsx             # mobile full screen / desktop phone panel
      TodoSheet.tsx        # add or edit a todo
      TodoItem.tsx         # one list row + action menu
      FallingLetters.tsx   # completion animation overlay
      RestoreDock.tsx      # restore buttons for completed todos
      AuthForm.tsx         # shared login/register form
    api.ts                 # fetch helper
    types.ts
    App.tsx                # routes
    main.tsx
    index.css
  .env.example
  Dockerfile
```

## Main pages

| Page | Route | Who can see it |
| --- | --- | --- |
| Register | `/register` | Guests only |
| Login | `/login` | Guests only |
| Todos | `/` | Logged-in users |

Guests who open `/` are sent to `/login`. Logged-in users who open `/login` or `/register` are sent to `/`.

## Auth flow

1. **Register / login**  
   The form posts to `/auth/register` or `/auth/login`. The API returns `{ accessToken, user }` and sets an HttpOnly `refresh_token` cookie.

2. **Storing the access token**  
   The access token is kept in memory (`api.ts` + React auth context). It is not stored in `localStorage`.

3. **Authorization header**  
   Todo requests send `Authorization: Bearer <accessToken>`.

4. **Refresh**  
   Every request uses `credentials: 'include'` so the cookie is sent. If a call returns `401`, the client posts `/auth/refresh` once, stores the new access token, and retries. On page load, the app also calls refresh to restore the session.

5. **Logout**  
   Posts `/auth/logout` (cookie). The client then clears the access token and user.

## Auth page design

Login (`/login`) and register (`/register`) use the same phone-like shell as the todo list (`PhoneFrame`).

- Desktop (768px+): a centered white panel on gray, same width, radius, and shadow as todos
- Mobile: full-screen white surface, with padding so fields stay inside the viewport
- Inputs are gray rounded fields with a visible border (not full-width across the browser)
- The black checkmark logo pops in, then the title, fields, button, and footer fade/slide in with a short stagger
- The sign-in / create-account button scales slightly on hover and tap
- A failed submit shakes the form and shows a readable error
- After a successful login or register, the panel fades out briefly before opening todos
- `prefers-reduced-motion` skips these motions

There is no confirm-password field; the API only accepts email and password.

## Todo flow

All todo calls go through `src/api.ts`.

The screen keeps a `selectedDate` (`YYYY-MM-DD`). Left/right arrows move it by one day. The **Today** pill sets it back to today. After the date changes, the client refetches `GET /todos?date=YYYY-MM-DD` and splits that day's todos:

- **Active** (`completed === false`) — shown in the main list
- **Completed** (`completed === true`) — hidden from the list. Letters stay in a pile at the bottom of that date, and each completed todo has its own restore chip (`↻` + title)

| Action | What happens |
| --- | --- |
| Create | The floating `+` opens a bottom sheet with title, optional description, Cancel, and Add. `POST /todos` sends the current `selectedDate` as `taskDate` and prepends the new item. |
| Read | `GET /todos?date=YYYY-MM-DD` whenever `selectedDate` changes. The API returns the current user's non-deleted todos for that date, including completed ones. |
| Edit | Each row has a `···` button. **Edit** opens the same sheet, pre-filled. **Save** calls `PATCH /todos/:id` without changing `taskDate`. The list item is merged with the response so title and description stay visible. |
| Complete | The circular checkbox calls `PATCH /todos/:id` with `{ completed: true }`, merged with the existing todo so title and description stay. Letters fall to the bottom and **stay there**. The row then leaves the active list. The todo is not deleted. A restore chip for that todo id appears near the pile, showing `↻` and the title. |
| Restore | Each completed todo has its own chip, keyed by todo id. Clicking it calls `PATCH /todos/:id` with `{ completed: false }`. The chip and fallen letters rise back up, then the row slides into the active list. |
| Delete | `···` → **Delete** → confirm. `DELETE /todos/:id` soft-deletes on the server. The row fades out of the visible list. |
| Logout | **Log out** under the date header posts `/auth/logout` and returns to login. |

`description: null` is not rendered. Empty titles cannot be created.

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | Backend URL the **browser** calls, usually `http://localhost:3000` |

Vite only exposes variables that start with `VITE_`.

## How to run locally

The API must be running (see the root README).

```bash
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

## How to run with Docker Compose

From the **project root** (not this folder):

```bash
cp .env.example .env
docker compose up --build
```

Then open [http://localhost:5173](http://localhost:5173).

`VITE_API_URL` should stay `http://localhost:3000` even inside Docker, because the browser talks to the API on the host.

## Common frontend problems and fixes

**Login works, but every todo request fails**  
Confirm `VITE_API_URL` is `http://localhost:3000` with no trailing slash. Restart Vite after changing `.env`.

**You are logged out after a refresh**  
The refresh cookie is not reaching the API. `CORS_ORIGIN` on the server must be exactly `http://localhost:5173`, and all `fetch` calls must use `credentials: 'include'`.

**Register/login shows a CORS error**  
The server is not running, or `CORS_ORIGIN` does not match the page origin.

**Completed todos lose their title**  
The client merges PATCH responses with the existing todo. Restart both apps if you are on an old build.

**Delete seems to do nothing after a reload**  
Delete is a soft delete. The item should vanish from the list immediately. If it comes back, the API is not filtering `deletedAt`.
