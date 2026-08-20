import { useCallback, useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import * as api from '../api';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  FallingLettersPhysics,
  TODO_ANIMATION_DURATION,
  TODO_RESTORE_MERGE_MS,
  animateFlip,
  collectFloorSpawns,
  collectLetterSpawns,
  collectRestoreTargets,
  measureRowTops,
  type LetterSpawn,
  type RestoreFlight,
} from '../components/FallingLettersPhysics';
import { PhoneFrame, usePhone } from '../phone';
import { RestoreDock } from '../components/RestoreDock';
import { TodoItem } from '../components/TodoItem';
import { TodoSheet } from '../components/TodoSheet';
import type { Todo } from '../types';

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateOnly() {
  return toDateOnly(new Date());
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(value: string, days: number) {
  const next = parseDateOnly(value);
  next.setDate(next.getDate() + days);
  return toDateOnly(next);
}

function headingFor(value: string) {
  if (value === todayDateOnly()) return 'Today';
  return parseDateOnly(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function compareTodos(left: Todo, right: Todo) {
  const byDate = String(right.createdAt).localeCompare(String(left.createdAt));
  if (byDate !== 0) return byDate;
  return left.id.localeCompare(right.id);
}

export function TodosPage() {
  return (
    <PhoneFrame>
      <TodosScreen />
    </PhoneFrame>
  );
}

function TodosScreen() {
  const { user, logout } = useAuth();
  const { phoneRef, overlayEl } = usePhone();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDateOnly);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'closed' | 'add' | Todo>('closed');
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  const [fallingTodoId, setFallingTodoId] = useState<string | null>(null);
  const [letterSpawns, setLetterSpawns] = useState<LetterSpawn[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [risingId, setRisingId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [restoreFlight, setRestoreFlight] = useState<RestoreFlight | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTodos() {
      setError('');
      setTodos([]);
      setLeavingIds([]);
      setFallingTodoId(null);
      setRestoringId(null);
      setRisingId(null);
      setMergingId(null);
      setEnteringIds([]);
      setRestoreFlight(null);
      setLoading(true);
      try {
        const data = await api.getTodos(selectedDate);
        if (cancelled) return;
        setTodos(data);
        const phone = phoneRef.current;
        if (phone && !prefersReducedMotion()) {
          const completed = data.filter((todo) => todo.completed);
          setLetterSpawns((current) => {
            const existingIds = new Set(
              current
                .filter((letter) => letter.date === selectedDate)
                .map((letter) => letter.todoId),
            );
            const extras: LetterSpawn[] = [];
            completed.forEach((todo, index) => {
              if (existingIds.has(todo.id)) return;
              const text = `${todo.title.trim() || 'Untitled'} ${todo.description ?? ''}`;
              extras.push(
                ...collectFloorSpawns(
                  text,
                  phone,
                  todo.id,
                  selectedDate,
                  existingIds.size + index,
                ),
              );
            });
            return extras.length > 0 ? [...current, ...extras] : current;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load todos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTodos();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleFallDone = useCallback((todoId: string) => {
    setFallingTodoId((current) => (current === todoId ? null : current));
  }, []);

  function removeLetters(todoId: string) {
    setLetterSpawns((current) => current.filter((letter) => letter.todoId !== todoId));
  }

  async function handleCreate(title: string, description: string) {
    setError('');
    try {
      const todo = await api.createTodo(title, description, selectedDate);
      if (todo.taskDate === selectedDate) {
        setTodos((current) => [todo, ...current]);
        setEnteringIds((current) =>
          current.includes(todo.id) ? current : [...current, todo.id],
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create todo');
      throw err;
    }
  }

  async function handleComplete(todo: Todo, row: HTMLLIElement | null) {
    if (todo.completed) return;
    setError('');

    const reduceMotion = prefersReducedMotion();
    const phone = phoneRef.current;
    const list = phone?.querySelector<HTMLElement>('.todo-list') ?? null;
    const previousRows = measureRowTops(list);

    const letters =
      row && phone && !reduceMotion
        ? collectLetterSpawns(row, phone, todo.id, selectedDate)
        : [];

    flushSync(() => {
      if (letters.length > 0) {
        setFallingTodoId(todo.id);
        setLetterSpawns((current) => [
          ...current.filter((letter) => letter.todoId !== todo.id),
          ...letters,
        ]);
      }
      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, completed: true } : item,
        ),
      );
    });
    animateFlip(list, previousRows);

    if (letters.length > 0) {
      const longest = letters.reduce(
        (max, letter) => Math.max(max, letter.delay + TODO_ANIMATION_DURATION),
        TODO_ANIMATION_DURATION,
      );
      window.setTimeout(() => handleFallDone(todo.id), longest);
    }

    try {
      const updated = await api.updateTodo(todo.id, { completed: true }, todo);
      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setFallingTodoId((current) => (current === todo.id ? null : current));
      removeLetters(todo.id);
      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? todo : item)),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update todo');
    }
  }

  async function handleRestore(todo: Todo) {
    if (!todo.completed || restoringId || risingId) return;
    setError('');
    const reduceMotion = prefersReducedMotion();

    if (reduceMotion) {
      setRestoringId(todo.id);
      try {
        const updated = await api.updateTodo(todo.id, { completed: false }, todo);
        setTodos((current) =>
          current.map((item) =>
            item.id === todo.id
              ? { ...item, ...updated, completed: false }
              : item,
          ),
        );
        removeLetters(todo.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not restore todo');
      } finally {
        setRestoringId(null);
      }
      return;
    }

    const phone = phoneRef.current;
    const list = phone?.querySelector<HTMLElement>('.todo-list') ?? null;
    const previousRows = measureRowTops(list);

    flushSync(() => {
      setRestoringId(todo.id);
      setRisingId(todo.id);
    });

    animateFlip(list, previousRows);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    const row = phone?.querySelector<HTMLElement>(
      `.todo-row[data-todo-id="${todo.id}"]`,
    );
    const phoneRect = phone?.getBoundingClientRect();
    const rowRect = row?.getBoundingClientRect();
    const targets =
      row && phone ? collectRestoreTargets(row, phone) : [];
    const fallback = {
      x: rowRect && phoneRect ? rowRect.left - phoneRect.left + 48 : 48,
      y: rowRect && phoneRect ? rowRect.top - phoneRect.top + 18 : 80,
    };

    flushSync(() => {
      setRestoreFlight({
        todoId: todo.id,
        targets,
        fallback,
      });
    });

    const mergeTimer = window.setTimeout(() => {
      setMergingId(todo.id);
    }, TODO_ANIMATION_DURATION - TODO_RESTORE_MERGE_MS);

    try {
      const [updated] = await Promise.all([
        api.updateTodo(todo.id, { completed: false }, todo),
        wait(TODO_ANIMATION_DURATION),
      ]);
      window.clearTimeout(mergeTimer);
      flushSync(() => {
        removeLetters(todo.id);
        setRestoreFlight(null);
        setRisingId((current) => (current === todo.id ? null : current));
      });
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      flushSync(() => {
        setTodos((current) =>
          current.map((item) =>
            item.id === todo.id
              ? { ...item, ...updated, completed: false }
              : item,
          ),
        );
        setMergingId((current) => (current === todo.id ? null : current));
        setRestoringId((current) => (current === todo.id ? null : current));
      });
    } catch (err) {
      window.clearTimeout(mergeTimer);
      const listNow = phoneRef.current?.querySelector<HTMLElement>('.todo-list') ?? null;
      const previousNow = measureRowTops(listNow);
      flushSync(() => {
        setRisingId((current) => (current === todo.id ? null : current));
        setRestoreFlight(null);
        setMergingId((current) => (current === todo.id ? null : current));
        setRestoringId((current) => (current === todo.id ? null : current));
      });
      animateFlip(listNow, previousNow);
      setError(err instanceof ApiError ? err.message : 'Could not restore todo');
    }
  }

  async function handleSave(todo: Todo, title: string, description: string) {
    setError('');
    try {
      const updated = await api.updateTodo(todo.id, { title, description }, todo);
      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update todo');
      throw err;
    }
  }

  async function handleDelete(todo: Todo) {
    const label = todo.title.trim() || 'this todo';
    if (!window.confirm(`Delete “${label}”?`)) return;

    setError('');
    try {
      await api.deleteTodo(todo.id);
      if (fallingTodoId === todo.id) setFallingTodoId(null);
      removeLetters(todo.id);
      if (prefersReducedMotion()) {
        setTodos((current) => current.filter((item) => item.id !== todo.id));
        return;
      }
      setLeavingIds((current) =>
        current.includes(todo.id) ? current : [...current, todo.id],
      );
      window.setTimeout(() => {
        setTodos((current) => current.filter((item) => item.id !== todo.id));
        setLeavingIds((current) => current.filter((id) => id !== todo.id));
      }, 280);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete todo');
    }
  }

  const editingTodo = typeof sheet === 'object' ? sheet : null;
  const isToday = selectedDate === todayDateOnly();
  const activeTodos = todos
    .filter((todo) => !todo.completed || todo.id === restoringId)
    .slice()
    .sort(compareTodos);
  const completedTodos = todos.filter((todo) => todo.completed);

  return (
    <div className="todo-app">
      <header className="day-header">
        <button
          className="icon-btn"
          type="button"
          aria-label="Previous day"
          onClick={() => setSelectedDate((current) => shiftDate(current, -1))}
        >
          <Chevron direction="left" />
        </button>
        <div className="day-copy">
          <h1>{headingFor(selectedDate)}</h1>
          <button
            className="today-pill"
            type="button"
            disabled={isToday}
            aria-label={isToday ? 'Already viewing today' : 'Jump to today'}
            onClick={() => setSelectedDate(todayDateOnly())}
          >
            Today
          </button>
          <p className="muted day-meta">
            <span className="day-email">{user?.email}</span>
            <button className="text-btn" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </p>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="Next day"
          onClick={() => setSelectedDate((current) => shiftDate(current, 1))}
        >
          <Chevron direction="right" />
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {loading ? <p className="page-message">Loading...</p> : null}

      {!loading && activeTodos.length === 0 && completedTodos.length === 0 ? (
        <p className="page-message">No todos for this day. Tap + to add one.</p>
      ) : null}

      <ul className="todo-list">
        {activeTodos.map((todo, index) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            index={index}
            leaving={leavingIds.includes(todo.id)}
            falling={fallingTodoId === todo.id}
            incoming={restoringId === todo.id}
            merging={mergingId === todo.id}
            isNew={enteringIds.includes(todo.id)}
            onToggle={handleComplete}
            onEdit={(item) => setSheet(item)}
            onDelete={handleDelete}
            onLeft={(item) => {
              setTodos((current) =>
                current.filter((row) => row.id !== item.id),
              );
              setLeavingIds((current) =>
                current.filter((id) => id !== item.id),
              );
            }}
          />
        ))}
      </ul>

      <RestoreDock
        todos={completedTodos}
        restoringId={restoringId}
        risingId={risingId}
        onRestore={(item) => void handleRestore(item)}
      />

      <button
        className="fab"
        type="button"
        aria-label="Add todo"
        onClick={() => setSheet('add')}
      >
        <span aria-hidden="true">+</span>
      </button>

      <TodoSheet
        open={sheet !== 'closed'}
        titleLabel={editingTodo ? 'Edit todo' : 'New todo'}
        submitLabel={editingTodo ? 'Save' : 'Add'}
        submittingLabel={editingTodo ? 'Saving...' : 'Adding...'}
        initialTitle={editingTodo?.title ?? ''}
        initialDescription={editingTodo?.description ?? ''}
        onClose={() => setSheet('closed')}
        onSubmit={(title, description) =>
          editingTodo
            ? handleSave(editingTodo, title, description)
            : handleCreate(title, description)
        }
      />

      {overlayEl
        ? createPortal(
            <FallingLettersPhysics
              phone={phoneRef.current}
              spawns={letterSpawns}
              visibleDate={selectedDate}
              restore={restoreFlight}
            />,
            overlayEl,
          )
        : null}
    </div>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
