/**
 * Async data hooks with loading / error state for the mock service layer.
 *
 * Each hook wraps a contractService call and returns { data, loading, error, retry }.
 * Skeletons render while `loading`; error panels render on `error`.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  AppError,
  Clause,
  ContractDetail,
  Reviewer,
  TemplateCatalogEntry,
} from "../models";
import { contractService, type ClauseFilter } from "../services/contractService";
import { getTemplateCatalog } from "../services/documentService";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = []
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const run = useCallback(() => {
    setState({ data: null, loading: true, error: null });
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: AppError) =>
        setState({ data: null, loading: false, error })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, retry: run };
}

/**
 * Fetches the backend template catalog (wwwroot/Templates/templates.json) via
 * documentService. Cards on the Dashboard render from this hook; on error the
 * gallery shows an error panel with retry (no seed fallback — the catalog is
 * the source of truth).
 */
export function useTemplateCatalog() {
  return useAsync<TemplateCatalogEntry[]>(() => getTemplateCatalog(), []);
}

export function useContract(id: string) {
  return useAsync<ContractDetail>(() => contractService.getContract(id), [id]);
}

export function useClauses(filter?: ClauseFilter) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = JSON.stringify(filter ?? {});
  return useAsync<Clause[]>(() => contractService.getClauses(filter), [key]);
}

export function useReviewers() {
  return useAsync<Reviewer[]>(() => contractService.getReviewers());
}
