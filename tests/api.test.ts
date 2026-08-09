import { describe, expect, it, vi } from "vitest";
import { sileo } from "../src/core/api";
import { store } from "../src/core/store";

describe("sileo API", () => {
  it("creates and replaces the default toast", () => {
    expect(sileo.success({ title: "Saved" })).toBe("sileo-default");
    sileo.error({ title: "Failed" });

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0]).toMatchObject({
      id: "sileo-default",
      state: "error",
      title: "Failed",
    });
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
