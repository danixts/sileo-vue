import { defineComponent, h, type PropType, type VNode } from "vue";
import type { SileoState } from "../types";

const PATHS: Record<SileoState, () => VNode[]> = {
  success: () => [h("path", { d: "M20 6 9 17l-5-5" })],
  loading: () => [h("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" })],
  error: () => [h("path", { d: "M18 6 6 18" }), h("path", { d: "m6 6 12 12" })],
  warning: () => [
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("line", { x1: "12", x2: "12", y1: "8", y2: "12" }),
    h("line", { x1: "12", x2: "12.01", y1: "16", y2: "16" }),
  ],
  info: () => [
    h("circle", { cx: "12", cy: "12", r: "10" }),
    h("path", { d: "m4.93 4.93 4.24 4.24" }),
    h("path", { d: "m14.83 9.17 4.24-4.24" }),
    h("path", { d: "m14.83 14.83 4.24 4.24" }),
    h("path", { d: "m9.17 14.83-4.24 4.24" }),
    h("circle", { cx: "12", cy: "12", r: "4" }),
  ],
  action: () => [
    h("path", { d: "M5 12h14" }),
    h("path", { d: "m12 5 7 7-7 7" }),
  ],
};

export const SileoIcon = defineComponent({
  name: "SileoIcon",
  props: {
    state: {
      type: String as PropType<SileoState>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(
        "svg",
        {
          width: 16,
          height: 16,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "aria-hidden": "true",
          "data-sileo-icon": props.state === "loading" ? "spin" : undefined,
        },
        PATHS[props.state](),
      );
  },
});
