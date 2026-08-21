import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Todo } from '../types';

type TodoItemProps = {
  todo: Todo;
  index: number;
  leaving: boolean;
  falling: boolean;
  incoming?: boolean;
  merging?: boolean;
  isNew?: boolean;
  onToggle: (todo: Todo, row: HTMLLIElement | null) => Promise<void>;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => Promise<void>;
  onLeft: (todo: Todo) => void;
};

function safeText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value : '';
}

function SplitText({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {Array.from(text).map((ch, index) => (
        <span
          key={`${index}-${ch}`}
          className="ch"
          data-fall={ch.trim() ? '1' : undefined}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </p>
  );
}

const MENU_WIDTH = 152;
const MENU_HEIGHT = 108;

function menuPosition(button: HTMLElement) {
  const buttonRect = button.getBoundingClientRect();
  const pad = 10;
  const viewH = window.innerHeight;
  const viewW = window.innerWidth;
  const spaceBelow = viewH - buttonRect.bottom;
  const spaceAbove = buttonRect.top;
  const openUp = spaceBelow < MENU_HEIGHT + 16 && spaceAbove > spaceBelow;

  let top = openUp ? buttonRect.top - MENU_HEIGHT - 6 : buttonRect.bottom + 6;
  let left = buttonRect.right - MENU_WIDTH;

  left = Math.max(pad, Math.min(left, viewW - MENU_WIDTH - pad));
  top = Math.max(pad, Math.min(top, viewH - MENU_HEIGHT - pad));

  return { top, left, openUp };
}

export function TodoItem({
  todo,
  index,
  leaving,
  falling,
  incoming = false,
  merging = false,
  isNew = false,
  onToggle,
  onEdit,
  onDelete,
  onLeft,
}: TodoItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = safeText(todo.title) || 'Untitled';
  const description = safeText(todo.description);

  function placeMenu() {
    const button = buttonRef.current;
    if (!button) return;
    setMenuPos(menuPosition(button));
  }

  useEffect(() => {
    if (falling) setMenuOpen(false);
  }, [falling]);

  useEffect(() => {
    if (!menuOpen) return;

    placeMenu();

    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    function onReposition() {
      placeMenu();
    }

    const list = rootRef.current?.closest('.todo-list');
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    list?.addEventListener('scroll', onReposition);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      list?.removeEventListener('scroll', onReposition);
    };
  }, [menuOpen]);

  const menu = menuOpen ? (
    <div
      ref={menuRef}
      className="menu"
      role="menu"
      style={{ top: menuPos.top, left: menuPos.left }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          onEdit(todo);
        }}
      >
        Edit
      </button>
      <button
        className="danger"
        type="button"
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          void onDelete(todo);
        }}
      >
        Delete
      </button>
    </div>
  ) : null;

  return (
    <li
      ref={rootRef}
      className={`todo-row ${todo.completed && !falling && !incoming ? 'is-done' : ''} ${leaving ? 'is-leaving' : ''} ${menuOpen ? 'is-open' : ''} ${falling ? 'is-falling' : ''} ${incoming ? 'is-incoming' : ''} ${merging ? 'is-merge' : ''} ${isNew ? 'is-new' : ''}`}
      data-todo-id={todo.id}
      style={isNew && !leaving && !incoming ? { animationDelay: `${index * 40}ms` } : undefined}
      onAnimationEnd={(event) => {
        if (leaving && event.animationName === 'row-out') onLeft(todo);
      }}
    >
      <label className="todo-check-wrap">
        <input
          className="todo-check"
          type="checkbox"
          checked={Boolean(todo.completed) && !incoming}
          disabled={falling || incoming}
          onChange={() => void onToggle(todo, rootRef.current)}
          aria-label={`Mark "${title}" complete`}
        />
      </label>

      <div className="todo-copy">
        <SplitText text={title} className="todo-title" />
        {description ? (
          <SplitText text={description} className="todo-note" />
        ) : null}
      </div>

      <div className="todo-menu">
        <button
          ref={buttonRef}
          className="icon-btn menu-btn"
          type="button"
          aria-label={`Actions for ${title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Edit or delete"
          disabled={incoming}
          onClick={() => {
            placeMenu();
            setMenuOpen((open) => !open);
          }}
        >
          <KebabIcon />
        </button>
      </div>

      {createPortal(menu, document.body)}
    </li>
  );
}

function KebabIcon() {
  return (
    <span className="kebab" aria-hidden="true">
      <span className="kebab-dot" data-fall="dot" />
      <span className="kebab-dot" data-fall="dot" />
      <span className="kebab-dot" data-fall="dot" />
    </span>
  );
}
