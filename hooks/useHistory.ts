import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState;

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState;

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const set = useCallback((newPresent: T) => {
    setState((currentState) => {
      if (currentState.present === newPresent) return currentState;

      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: [], // Clear future on new change
      };
    });
  }, []);
  
  const reset = useCallback((newPresent: T) => {
      setState({
          past: [],
          present: newPresent,
          future: []
      })
  }, []);

  // Clears the history stack but keeps the current value (used after initial upload)
  const clearHistory = useCallback(() => {
    setState(curr => ({
      past: [],
      present: curr.present,
      future: []
    }));
  }, []);

  // Clears the future stack (used when deleting/modifying history non-linearly)
  const clearFuture = useCallback(() => {
    setState(curr => ({
      ...curr,
      future: []
    }));
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
    clearFuture
  };
}