import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Matter from 'matter-js';

export const TODO_ANIMATION_DURATION = 1000;
export const TODO_RESTORE_MERGE_MS = 220;
export const MAX_FALL_LETTERS = 100;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export type LetterSpawn = {
  id: string;
  todoId: string;
  date: string;
  ch: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  delay: number;
};

export type RestoreFlight = {
  todoId: string;
  targets: Array<{ id: string; x: number; y: number }>;
  fallback: { x: number; y: number };
};

type SimLetter = LetterSpawn & {
  body: Matter.Body | null;
  restoring: boolean;
};

export function collectLetterSpawns(
  row: HTMLElement,
  phone: HTMLElement,
  todoId: string,
  date: string,
): LetterSpawn[] {
  const phoneRect = phone.getBoundingClientRect();
  const nodes = row.querySelectorAll<HTMLElement>('[data-fall]');
  const letters: LetterSpawn[] = [];

  nodes.forEach((node, index) => {
    if (letters.length >= MAX_FALL_LETTERS) return;
    const ch = node.textContent ?? '';
    if (!ch.trim()) return;
    const rect = node.getBoundingClientRect();
    const width = Math.max(9, rect.width);
    const height = Math.max(13, rect.height);
    const style = window.getComputedStyle(node);
    letters.push({
      id: `${todoId}-${index}-${Math.round(rect.left)}-${Math.round(rect.top)}`,
      todoId,
      date,
      ch,
      x: rect.left - phoneRect.left + width / 2,
      y: rect.top - phoneRect.top + height / 2,
      width,
      height,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      delay: index * 20,
    });
  });

  return letters;
}

export function collectRestoreTargets(
  row: HTMLElement,
  phone: HTMLElement,
): Array<{ id: string; x: number; y: number }> {
  const phoneRect = phone.getBoundingClientRect();
  const nodes = row.querySelectorAll<HTMLElement>('[data-fall]');
  const targets: Array<{ id: string; x: number; y: number }> = [];

  nodes.forEach((node, index) => {
    const ch = node.textContent ?? '';
    if (!ch.trim()) return;
    const rect = node.getBoundingClientRect();
    const width = Math.max(9, rect.width);
    const height = Math.max(13, rect.height);
    targets.push({
      id: `${index}`,
      x: rect.left - phoneRect.left + width / 2,
      y: rect.top - phoneRect.top + height / 2,
    });
  });

  if (targets.length === 0) {
    const copy = row.querySelector<HTMLElement>('.todo-copy') ?? row;
    const rect = copy.getBoundingClientRect();
    targets.push({
      id: 'copy',
      x: rect.left - phoneRect.left + Math.min(48, rect.width / 2),
      y: rect.top - phoneRect.top + Math.min(18, rect.height / 2),
    });
  }

  return targets;
}

export function collectFloorSpawns(
  text: string,
  phone: HTMLElement,
  todoId: string,
  date: string,
  pileIndex = 0,
): LetterSpawn[] {
  const width = phone.clientWidth;
  const height = phone.clientHeight;
  const left = 20 + (pileIndex % 3) * 40;
  const right = Math.max(left + 80, width - 128);
  const chars = Array.from(text).filter((ch) => ch.trim());
  const letters: LetterSpawn[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    if (letters.length >= MAX_FALL_LETTERS) break;
    const w = 11;
    const h = 16;
    letters.push({
      id: `${todoId}-seed-${index}`,
      todoId,
      date,
      ch: chars[index],
      x: randBetween(left, right),
      y: height - randBetween(48, 110),
      width: w,
      height: h,
      fontSize: index < 32 ? '1rem' : '0.86rem',
      fontWeight: index < 32 ? '500' : '400',
      delay: index * 6,
    });
  }

  return letters;
}

export function measureRowTops(list: HTMLElement | null) {
  const map = new Map<string, number>();
  if (!list) return map;
  list.querySelectorAll<HTMLElement>('.todo-row[data-todo-id]').forEach((row) => {
    const id = row.dataset.todoId;
    if (id) map.set(id, row.getBoundingClientRect().top);
  });
  return map;
}

export function animateFlip(
  list: HTMLElement | null,
  previous: Map<string, number>,
) {
  if (!list || previous.size === 0) return;
  list.querySelectorAll<HTMLElement>('.todo-row[data-todo-id]').forEach((row) => {
    const id = row.dataset.todoId;
    if (!id) return;
    const from = previous.get(id);
    if (from == null) return;
    const dy = from - row.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    row.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0px)' }],
      { duration: TODO_ANIMATION_DURATION, easing: EASING },
    );
  });
}

function paintLetter(node: HTMLElement, letter: SimLetter) {
  const body = letter.body;
  if (!body) {
    node.style.transform = `translate3d(${letter.x - letter.width / 2}px, ${letter.y - letter.height / 2}px, 0)`;
    return;
  }
  node.style.transform = `translate3d(${body.position.x - letter.width / 2}px, ${body.position.y - letter.height / 2}px, 0) rotate(${body.angle}rad)`;
}

function buildWalls(width: number, height: number, phone: HTMLElement) {
  const thick = 96;
  const floor = Matter.Bodies.rectangle(
    width / 2,
    height - 4 + thick / 2,
    width + 240,
    thick,
    { isStatic: true, friction: 1, restitution: 0.08, label: 'floor' },
  );
  const left = Matter.Bodies.rectangle(-thick / 2 + 2, height / 2, thick, height * 4, {
    isStatic: true,
    friction: 0.9,
    label: 'left-wall',
  });
  const right = Matter.Bodies.rectangle(width + thick / 2 - 2, height / 2, thick, height * 4, {
    isStatic: true,
    friction: 0.9,
    label: 'right-wall',
  });
  const walls: Matter.Body[] = [floor, left, right];
  const fab = phone.querySelector<HTMLElement>('.fab');
  if (fab) {
    const phoneRect = phone.getBoundingClientRect();
    const fabRect = fab.getBoundingClientRect();
    walls.push(
      Matter.Bodies.rectangle(
        fabRect.left - phoneRect.left + fabRect.width / 2,
        fabRect.top - phoneRect.top + fabRect.height / 2,
        fabRect.width + 20,
        fabRect.height + 20,
        { isStatic: true, friction: 0.95, restitution: 0.05, label: 'fab-guard' },
      ),
    );
  }
  return walls;
}

export function FallingLettersPhysics({
  phone,
  spawns,
  visibleDate,
  restore,
}: {
  phone: HTMLElement | null;
  spawns: LetterSpawn[];
  visibleDate: string;
  restore: RestoreFlight | null;
}) {
  const engineRef = useRef<Matter.Engine | null>(null);
  const wallsRef = useRef<Matter.Body[]>([]);
  const simRef = useRef(new Map<string, SimLetter>());
  const nodesRef = useRef(new Map<string, HTMLSpanElement>());
  const timeoutsRef = useRef<number[]>([]);
  const visibleDateRef = useRef(visibleDate);
  const restoreRef = useRef(restore);
  const spawnsRef = useRef(spawns);
  visibleDateRef.current = visibleDate;
  restoreRef.current = restore;
  spawnsRef.current = spawns;
  const spawnKey = spawns.map((spawn) => spawn.id).join('|');
  const [ids, setIds] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (!phone) return undefined;
    const engine = Matter.Engine.create();
    engine.enableSleeping = true;
    engine.gravity.x = 0;
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0017;
    engine.positionIterations = 12;
    engine.velocityIterations = 10;
    engineRef.current = engine;

    const sizeWorld = () => {
      const width = phone.clientWidth;
      const height = phone.clientHeight;
      if (wallsRef.current.length > 0) {
        Matter.Composite.remove(engine.world, wallsRef.current);
      }
      wallsRef.current = buildWalls(width, height, phone);
      Matter.Composite.add(engine.world, wallsRef.current);
    };

    sizeWorld();
    const observer = new ResizeObserver(sizeWorld);
    observer.observe(phone);

    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;
      Matter.Engine.update(engine, dt);
      const date = visibleDateRef.current;
      simRef.current.forEach((letter) => {
        const node = nodesRef.current.get(letter.id);
        if (!node) return;
        node.style.display = letter.date === date ? '' : 'none';
        if (letter.restoring) return;
        paintLetter(node, letter);
      });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      wallsRef.current = [];
      simRef.current.clear();
    };
  }, [phone]);

  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const nextSpawns = spawnsRef.current;
    const incoming = new Set(nextSpawns.map((spawn) => spawn.id));
    const sim = simRef.current;

    sim.forEach((letter, id) => {
      if (incoming.has(id)) return;
      if (letter.body) Matter.Composite.remove(engine.world, letter.body);
      sim.delete(id);
    });

    nextSpawns.forEach((spawn) => {
      if (sim.has(spawn.id)) return;
      const item: SimLetter = { ...spawn, body: null, restoring: false };
      sim.set(spawn.id, item);
      const timeout = window.setTimeout(() => {
        const current = sim.get(spawn.id);
        if (!current || current.body || !engineRef.current) return;
        const body = Matter.Bodies.rectangle(
          spawn.x,
          spawn.y,
          spawn.width,
          spawn.height,
          {
            restitution: 0.34,
            friction: 0.42,
            frictionAir: 0.01,
            density: 0.002,
            slop: 0.04,
            label: spawn.todoId,
          },
        );
        Matter.Body.setVelocity(body, {
          x: randBetween(-2.2, 2.2),
          y: randBetween(0.4, 2.2),
        });
        Matter.Body.setAngularVelocity(body, randBetween(-0.14, 0.14));
        Matter.Composite.add(engineRef.current.world, body);
        current.body = body;
      }, spawn.delay);
      timeoutsRef.current.push(timeout);
    });

    setIds(nextSpawns.map((spawn) => spawn.id));
  }, [spawnKey]);

  useLayoutEffect(() => {
    if (!restore) {
      const stillSpawned = new Set(spawnsRef.current.map((spawn) => spawn.id));
      simRef.current.forEach((letter) => {
        if (!letter.restoring) return;
        if (!stillSpawned.has(letter.id)) return;
        letter.restoring = false;
        const node = nodesRef.current.get(letter.id);
        if (node) node.style.opacity = '1';
        if (letter.body) {
          Matter.Body.setStatic(letter.body, false);
          Matter.Sleeping.set(letter.body, false);
        }
      });
      return undefined;
    }

    const letters = [...simRef.current.values()].filter(
      (letter) => letter.todoId === restore.todoId,
    );
    if (letters.length === 0) return undefined;

    let cancelled = false;
    const start = performance.now();
    const mergeStart = 1 - TODO_RESTORE_MERGE_MS / TODO_ANIMATION_DURATION;
    letters.forEach((letter, index) => {
      letter.restoring = true;
      if (letter.body) {
        Matter.Body.setStatic(letter.body, true);
        Matter.Sleeping.set(letter.body, true);
      }
      const fromX = letter.body?.position.x ?? letter.x;
      const fromY = letter.body?.position.y ?? letter.y;
      const fromAngle = letter.body?.angle ?? 0;
      const target =
        restore.targets.find((item) => item.id === letter.id) ??
        restore.targets[index];
      const toX =
        target?.x ?? restore.fallback.x + (index % 10) * 7 - 24;
      const toY =
        target?.y ?? restore.fallback.y + Math.floor(index / 14) * 9;
      const node = nodesRef.current.get(letter.id);
      if (!node) return;
      const step = (now: number) => {
        if (cancelled) return;
        const p = Math.min(1, (now - start) / TODO_ANIMATION_DURATION);
        const eased = 1 - (1 - p) ** 3;
        const x = fromX + (toX - fromX) * eased;
        const y = fromY + (toY - fromY) * eased;
        const angle = fromAngle * (1 - eased);
        node.style.transform = `translate3d(${x - letter.width / 2}px, ${y - letter.height / 2}px, 0) rotate(${angle}rad)`;
        node.style.opacity =
          p > mergeStart ? String(1 - (p - mergeStart) / (1 - mergeStart)) : '1';
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    });

    return () => {
      cancelled = true;
    };
  }, [restore]);

  if (ids.length === 0) return null;

  return (
    <div className="fall-layer" aria-hidden="true">
      {ids.map((id) => {
        const letter = simRef.current.get(id);
        if (!letter) return null;
        return (
          <span
            key={id}
            className="fall-letter"
            ref={(node) => {
              if (node) nodesRef.current.set(id, node);
              else nodesRef.current.delete(id);
            }}
            style={
              {
                width: letter.width,
                height: letter.height,
                fontSize: letter.fontSize,
                fontWeight: letter.fontWeight,
                transform: `translate3d(${letter.x - letter.width / 2}px, ${letter.y - letter.height / 2}px, 0)`,
              } as CSSProperties
            }
          >
            {letter.ch}
          </span>
        );
      })}
    </div>
  );
}
