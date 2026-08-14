import { describe, expect, it, vi } from "vitest";
import { sileo } from "../src/core/api";
import { store } from "../src/core/store";

describe("sileo API", () => {
  it("stacks toasts created without an explicit id", () => {
    const first = sileo.success({ title: "Saved" });
    const second = sileo.error({ title: "Failed" });

    expect(first).not.toBe(second);
    expect(store.toasts).toHaveLength(2);
    expect(store.toasts[1]).toMatchObject({ state: "error", title: "Failed" });
  });

  it("replaces a toast reusing its id", () => {
    sileo.success({ id: "session", title: "Saved" });
    sileo.error({ id: "session", title: "Failed" });

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]).toMatchObject({
      id: "session",
      state: "error",
      title: "Failed",
    });
  });

  it("keeps the same uid across updates of one toast", () => {
    sileo.success({ id: "session", title: "Saved" });
    const uid = store.toasts[0]?.uid;
    sileo.error({ id: "session", title: "Failed" });

    expect(store.toasts[0]?.uid).toBe(uid);
  });

  it("keeps independently identified toasts", () => {
    sileo.info({ id: "first", title: "First" });
    sileo.warning({ id: "second", title: "Second" });

    expect(store.toasts.map((toast) => toast.id)).toEqual(["first", "second"]);
  });

  it("updates promise toasts after resolving", async () => {
    const request = Promise.resolve({ name: "Ada" });
    await sileo.promise(request, {
      loading: { title: "Loading" },
      success: (user) => ({ title: `Welcome ${user.name}` }),
      error: { title: "Failed" },
    });
    await vi.waitFor(() => {
      expect(store.toasts[0]).toMatchObject({
        state: "success",
        title: "Welcome Ada",
      });
    });
  });

  it("updates promise toasts after rejecting without swallowing the error", async () => {
    const failure = new Error("Network unavailable");
    const request = sileo.promise(Promise.reject(failure), {
      loading: { title: "Loading" },
      success: { title: "Saved" },
      error: (error) => ({ title: (error as Error).message }),
    });

    await expect(request).rejects.toBe(failure);
    await vi.waitFor(() => {
      expect(store.toasts[0]).toMatchObject({
        state: "error",
        title: "Network unavailable",
      });
    });
  });

  it("clears only the requested position", () => {
    sileo.info({ id: "top", position: "top-right" });
    sileo.info({ id: "bottom", position: "bottom-left" });
    sileo.clear("top-right");

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]?.id).toBe("bottom");
  });
});
