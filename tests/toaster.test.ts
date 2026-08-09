import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import Toaster from "../src/components/Toaster.vue";
import { sileo } from "../src/core/api";

describe("Toaster", () => {
  it("renders toast content in its configured viewport", async () => {
    const wrapper = mount(Toaster, {
      props: { position: "bottom-left", offset: 24, theme: "dark" },
    });

    sileo.success({ title: "Profile saved", description: "Ready to continue" });
    await nextTick();

    const viewport = wrapper.get("[data-sileo-viewport]");
    expect(viewport.attributes("data-position")).toBe("bottom-left");
    expect(viewport.attributes("data-theme")).toBe("dark");
    expect(viewport.attributes("style")).toContain("bottom: 24px");
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
        props: { theme: "light", options: { variant } },
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
    const wrapper = mount(Toaster, { props: { theme: "dark" } });
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
    const wrapper = mount(Toaster, { props: { theme: "light" } });
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

    const wrapper = mount(Toaster, { props: { theme: "system" } });
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
    const wrapper = mount(Toaster);
    sileo.action({
      title: "New version",
      description: "Refresh to update",
      button: { title: "Refresh", onClick },
    });
    await nextTick();

    await wrapper.get("[data-sileo-button]").trigger("click");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("pauses and restarts dismissal timers while hovered", async () => {
    vi.useFakeTimers();
    const wrapper = mount(Toaster);
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
