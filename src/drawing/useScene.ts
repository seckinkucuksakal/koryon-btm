import { useCallback, useRef, useState } from "react";
import type { SceneJSON, SceneObject } from "./types";

const HISTORY_LIMIT = 80;

export function useScene(initial: SceneJSON) {
  const [scene, setSceneInternal] = useState<SceneJSON>(initial);
  const past = useRef<SceneJSON[]>([]);
  const future = useRef<SceneJSON[]>([]);

  const commit = useCallback(
    (
      updater: SceneJSON | ((prev: SceneJSON) => SceneJSON),
      options: { history?: boolean } = {},
    ) => {
      setSceneInternal((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: SceneJSON) => SceneJSON)(prev)
            : updater;
        if (options.history !== false && next !== prev) {
          past.current.push(prev);
          if (past.current.length > HISTORY_LIMIT) past.current.shift();
          future.current = [];
        }
        return next;
      });
    },
    [],
  );

  /** Mevcut sahneyi history'e iter — sürükleme başlamadan çağır. */
  const pushHistory = useCallback(() => {
    setSceneInternal((cur) => {
      past.current.push(cur);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      return cur;
    });
  }, []);

  const undo = useCallback(() => {
    setSceneInternal((cur) => {
      const prev = past.current.pop();
      if (!prev) return cur;
      future.current.push(cur);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setSceneInternal((cur) => {
      const next = future.current.pop();
      if (!next) return cur;
      past.current.push(cur);
      return next;
    });
  }, []);

  // Yardımcılar
  const addObject = useCallback(
    (obj: SceneObject) => {
      commit((s) => ({ ...s, objects: [...s.objects, obj] }));
    },
    [commit],
  );

  const updateObject = useCallback(
    (id: string, patch: Partial<SceneObject>, history = true) => {
      commit(
        (s) => ({
          ...s,
          objects: s.objects.map((o) =>
            o.id === id ? ({ ...o, ...patch } as SceneObject) : o,
          ),
        }),
        { history },
      );
    },
    [commit],
  );

  const deleteObject = useCallback(
    (id: string) => {
      commit((s) => ({
        ...s,
        objects: s.objects.filter(
          (o) =>
            o.id !== id &&
            // İlgili kabloları da temizle
            !(o.type === "wire" && (o.fromId === id || o.toId === id)),
        ),
      }));
    },
    [commit],
  );

  return {
    scene,
    setScene: commit,
    pushHistory,
    addObject,
    updateObject,
    deleteObject,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
