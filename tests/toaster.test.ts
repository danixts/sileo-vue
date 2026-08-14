import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import Toaster from "../src/components/Toaster.vue";
import { sileo } from "../src/core/api";

async function pointer(
  element: Element,
  type: string,
  clientY: number,
): Promise<void> {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY }));
  await nextTick();
}

async function swipe(element: Element, [from, to]: [number, number]) {
  await pointer(element, "pointerdown", from);
  await pointer(element, "pointermove", to);
}

describe("Toaster", () => {
  it("renders toast content in its configured viewport", async () => {
    const wrapper = mount(Toaster, {
      props: {
        position: "bottom-left",
        offset: 24,
        theme: "dark",
        teleport: false,
      },
    });

    sileo.success({ title: "Profile saved", description: "Ready to continue" });
    await nextTick();

    const viewport = wrapper.get("[data-sileo-viewport]");
    expect(viewport.attributes("data-position")).toBe("bottom-left");
    expect(viewport.attributes("data-theme")).toBe("dark");
    expect(viewport.attributes("style")).toContain("bottom: 24px");
    expect(viewport.attributes("style")).toContain("z-index: 1000");
    expect(wrapper.get("[data-sileo-pill]").attributes("fill")).toBe(
      "var(--sileo-variant-surface, var(--sileo-surface, #ffffff))",
    );
    expect(wrapper.get("[data-sileo-title]").text()).toBe("Profile saved");
    expect(wrapper.get("[data-sileo-description]").text()).toContain(
      "Ready to continue",
    );
  });

  it.each(["neutral", "colored", "gradient"] as const)(
    "renders the %s surface variant",
    async (variant) => {
      const wrapper = mount(Toaster, {
        props: { theme: "light", options: { variant }, teleport: false },
      });

      sileo.error({ title: `${variant} toast` });
      await nextTick();

      const toast = wrapper.get("[data-sileo-toast]");
      expect(toast.attributes("data-variant")).toBe(variant);
      expect(toast.attributes("data-state")).toBe("error");

      if (variant === "gradient") {
        expect(wrapper.find("linearGradient").exists()).toBe(true);
        expect(wrapper.get("[data-sileo-pill]").attributes("fill")).toContain(
          "sileo-gradient-",
        );
      }
    },
  );

  it("uses custom gradient colors", async () => {
    const wrapper = mount(Toaster, {
      props: { theme: "dark", teleport: false },
    });
    sileo.success({
      title: "Custom gradient",
      variant: "gradient",
      gradient: { from: "#ff006e", to: "#3a86ff" },
    });
    await nextTick();

    const stops = wrapper.findAll("stop");
    const gradient = wrapper.get("linearGradient");
    expect(stops).toHaveLength(2);
    expect(gradient.attributes("gradientUnits")).toBe("userSpaceOnUse");
    expect(gradient.attributes("x2")).toBe("350");
    expect(stops[0]?.attributes("stop-color")).toBe("#ff006e");
    expect(stops[1]?.attributes("stop-color")).toBe("#3a86ff");
  });

  it("accepts rgba and Tailwind CSS color variables", async () => {
    const wrapper = mount(Toaster, {
      props: { theme: "light", teleport: false },
    });
    sileo.info({
      title: "CSS color gradient",
      variant: "gradient",
      gradient: {
        from: "rgba(14, 165, 233, 0.9)",
        to: "var(--color-violet-600)",
      },
    });
    await nextTick();

    const stops = wrapper.findAll("stop");
    expect(stops[0]?.attributes("stop-color")).toBe("rgba(14, 165, 233, 0.9)");
    expect(stops[1]?.attributes("stop-color")).toBe("var(--color-violet-600)");
  });

  it("tracks the system color scheme", async () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    let matches = false;
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return matches;
          },
          media: query,
          onchange: null,
          addEventListener: vi.fn((_event, listener) => {
            changeListener = listener as (event: MediaQueryListEvent) => void;
          }),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );

    const wrapper = mount(Toaster, {
      props: { theme: "system", teleport: false },
    });
    sileo.info({ title: "System theme" });
    await nextTick();
    expect(wrapper.get("[data-sileo-viewport]").attributes("data-theme")).toBe(
      "light",
    );

    matches = true;
    changeListener?.({ matches } as MediaQueryListEvent);
    await nextTick();
    expect(wrapper.get("[data-sileo-viewport]").attributes("data-theme")).toBe(
      "dark",
    );
  });

  it("invokes an action button", async () => {
    const onClick = vi.fn();
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.action({
      title: "New version",
      description: "Refresh to update",
      button: { title: "Refresh", onClick },
    });
    await nextTick();

    await wrapper.get("[data-sileo-button]").trigger("click");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses the direct duration prop as the global toast lifetime", async () => {
    vi.useFakeTimers();
    const wrapper = mount(Toaster, {
      props: { duration: 200, teleport: false },
    });
    sileo.info({ title: "Short lived" });
    await nextTick();

    await vi.advanceTimersByTimeAsync(201);
    await nextTick();
    expect(wrapper.get("[data-sileo-toast]").attributes("data-exiting")).toBe(
      "true",
    );
  });

  it("stacks toasts sharing a position", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "First" });
    sileo.info({ title: "Second" });
    sileo.info({ title: "Third" });
    await nextTick();

    const viewport = wrapper.get("[data-sileo-viewport]");
    expect(viewport.attributes("data-stacked")).toBe("");
    expect(viewport.attributes("data-stack-expanded")).toBeUndefined();

    const toasts = wrapper.findAll("[data-sileo-toast]");
    expect(toasts).toHaveLength(3);
    expect(toasts.map((toast) => toast.attributes("data-stack-index"))).toEqual(
      ["2", "1", "0"],
    );

    await viewport.trigger("mouseenter");
    expect(
      wrapper.get("[data-sileo-viewport]").attributes("data-stack-expanded"),
    ).toBe("");
  });

  it("hides toasts beyond maxVisibleToasts", async () => {
    const wrapper = mount(Toaster, {
      props: { maxVisibleToasts: 2, teleport: false },
    });
    sileo.info({ title: "First" });
    sileo.info({ title: "Second" });
    sileo.info({ title: "Third" });
    await nextTick();

    const hidden = wrapper
      .findAll("[data-sileo-toast]")
      .filter((toast) => toast.attributes("data-stack-hidden") !== undefined);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.attributes("data-stack-index")).toBe("2");
  });

  it("dismisses through the close button", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Closable" });
    await nextTick();

    await wrapper.get("[data-sileo-dismiss]").trigger("click");
    expect(wrapper.get("[data-sileo-toast]").attributes("data-exiting")).toBe(
      "true",
    );
  });

  it("omits the close button when closable is false", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Sticky", closable: false });
    await nextTick();

    expect(wrapper.find("[data-sileo-dismiss]").exists()).toBe(false);
  });

  it("aligns the description and flags errors as alerts", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.error({
      title: "Broken",
      description: "Try again",
      descriptionAlign: "center",
    });
    await nextTick();

    expect(
      wrapper.get("[data-sileo-description]").attributes("data-align"),
    ).toBe("center");
    const toast = wrapper.get("[data-sileo-toast]");
    expect(toast.attributes("role")).toBe("alert");
    expect(toast.attributes("aria-live")).toBe("assertive");
  });

  it("expands on focus and dismisses with Escape", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Keyboard", description: "Reachable" });
    await nextTick();

    const toast = wrapper.get("[data-sileo-toast]");
    await toast.trigger("focusin");
    expect(toast.attributes("data-expanded")).toBe("true");

    await toast.trigger("keydown", { key: "Escape" });
    expect(toast.attributes("data-exiting")).toBe("true");
  });

  it("marks the toast while it is being dragged", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Draggable" });
    await nextTick();

    const toast = wrapper.get("[data-sileo-toast]");
    expect(toast.attributes("data-dragging")).toBeUndefined();
    expect(wrapper.find("[data-sileo-grip]").exists()).toBe(true);

    await swipe(toast.element, [0, 12]);
    expect(toast.attributes("data-dragging")).toBe("");

    await pointer(toast.element, "pointerup", 12);
    expect(toast.attributes("data-dragging")).toBeUndefined();
  });

  it("dismisses when the swipe passes the threshold", async () => {
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Swipe me" });
    await nextTick();

    const toast = wrapper.get("[data-sileo-toast]");
    await swipe(toast.element, [0, 60]);
    await pointer(toast.element, "pointerup", 60);

    expect(toast.attributes("data-exiting")).toBe("true");
  });

  it("teleports the viewport to the document body by default", async () => {
    mount(Toaster);
    sileo.info({ title: "Teleported" });
    await nextTick();

    expect(
      document.body.querySelector(":scope > [data-sileo-viewport]"),
    ).not.toBeNull();
  });

  it("pauses and restarts dismissal timers while hovered", async () => {
    vi.useFakeTimers();
    const wrapper = mount(Toaster, { props: { teleport: false } });
    sileo.info({ title: "Timed", duration: 100 });
    await nextTick();

    const toast = wrapper.get("[data-sileo-toast]");
    await toast.trigger("mouseenter");
    await vi.advanceTimersByTimeAsync(150);
    expect(wrapper.find("[data-sileo-toast]").exists()).toBe(true);

    await toast.trigger("mouseleave");
    await vi.advanceTimersByTimeAsync(101);
    await nextTick();
    expect(wrapper.get("[data-sileo-toast]").attributes("data-exiting")).toBe(
      "true",
    );
  });
});
