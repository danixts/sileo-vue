import type {
  SileoOptions,
  SileoPosition,
  SileoPromiseOptions,
} from "../types";
import {
  createToast,
  dismissToast,
  store,
  updateStore,
  updateToast,
} from "./store";

/** Public surface of the toast API. Keeps generated types free of internals. */
export interface SileoApi {
  show: (options: SileoOptions) => string;
  success: (options: SileoOptions) => string;
  error: (options: SileoOptions) => string;
  warning: (options: SileoOptions) => string;
  info: (options: SileoOptions) => string;
  action: (options: SileoOptions) => string;
  promise: <T>(
    promiseOrFactory: Promise<T> | (() => Promise<T>),
    options: SileoPromiseOptions<T>,
  ) => Promise<T>;
  dismiss: (id: string) => void;
  clear: (position?: SileoPosition) => void;
}

export const sileo: SileoApi = {
  show: (options: SileoOptions): string =>
    createToast({ ...options, state: options.type }).id,
  success: (options: SileoOptions): string =>
    createToast({ ...options, state: "success" }).id,
  error: (options: SileoOptions): string =>
    createToast({ ...options, state: "error" }).id,
  warning: (options: SileoOptions): string =>
    createToast({ ...options, state: "warning" }).id,
  info: (options: SileoOptions): string =>
    createToast({ ...options, state: "info" }).id,
  action: (options: SileoOptions): string =>
    createToast({ ...options, state: "action" }).id,
  promise: <T>(
    promiseOrFactory: Promise<T> | (() => Promise<T>),
    options: SileoPromiseOptions<T>,
  ): Promise<T> => {
    const loadingToast = createToast({
      ...options.loading,
      state: "loading",
      duration: null,
      position: options.position,
    });
    const promise =
      typeof promiseOrFactory === "function"
        ? promiseOrFactory()
        : promiseOrFactory;

    void promise
      .then((data) => {
        const nextOptions = options.action
          ? typeof options.action === "function"
            ? options.action(data)
            : options.action
          : typeof options.success === "function"
            ? options.success(data)
            : options.success;
        updateToast(loadingToast.id, {
          ...nextOptions,
          state: options.action ? "action" : "success",
          id: loadingToast.id,
        });
      })
      .catch((error: unknown) => {
        const errorOptions =
          typeof options.error === "function"
            ? options.error(error)
            : options.error;
        updateToast(loadingToast.id, {
          ...errorOptions,
          state: "error",
          id: loadingToast.id,
        });
      });

    return promise;
  },
  dismiss: dismissToast,
  clear: (position?: SileoPosition): void => {
    updateStore((toasts) =>
      position ? toasts.filter((toast) => toast.position !== position) : [],
    );
  },
};

export function configureSileo(
  position: SileoPosition,
  options?: Partial<SileoOptions>,
): void {
  store.position = position;
  store.options = options;
}
