import type { Todo } from '../types';

type RestoreDockProps = {
  todos: Todo[];
  restoringId: string | null;
  risingId: string | null;
  onRestore: (todo: Todo) => void;
};

export function RestoreDock({
  todos,
  restoringId,
  risingId,
  onRestore,
}: RestoreDockProps) {
  if (todos.length === 0) return null;

  return (
    <div className="restore-dock" aria-label="Completed todos">
      {todos.map((todo) => {
        const label = todo.title.trim() || 'Untitled';
        const rising = risingId === todo.id;
        return (
          <button
            key={todo.id}
            className={`restore-chip${rising ? ' is-rising' : ''}`}
            type="button"
            disabled={Boolean(restoringId) || rising}
            title={`Restore “${label}”`}
            aria-label={`Restore “${label}”`}
            data-todo-id={todo.id}
            onClick={() => onRestore(todo)}
          >
            <RefreshIcon />
            <span className="restore-chip-title">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 4.5v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
