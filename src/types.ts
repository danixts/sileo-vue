import type { CSSProperties, VNodeChild } from "vue";

export type SileoState =
  "success" | "loading" | "error" | "warning" | "info" | "action";

export interface SileoStyles {
  title?: string;
  description?: string;
  badge?: string;
  button?: string;
}

export interface SileoButton {
  title: string;
  onClick: () => void;
}

export const SILEO_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type SileoPosition = (typeof SILEO_POSITIONS)[number];
export type SileoTheme = "light" | "dark" | "system";
export type SileoVariant = "neutral" | "colored" | "gradient";
export type SileoTextAlign = "left" | "center" | "right";

export interface SileoGradient {
  from?: string;
  to?: string;
}
export type SileoOffsetValue = number | string;
export type SileoOffsetConfig = Partial<
  Record<"top" | "right" | "bottom" | "left", SileoOffsetValue>
>;

export interface SileoOptions {
  id?: string;
  title?: string;
  description?: VNodeChild;
  type?: SileoState;
  position?: SileoPosition;
  duration?: number | null;
  icon?: VNodeChild;
  styles?: SileoStyles;
  fill?: string;
  variant?: SileoVariant;
  gradient?: SileoGradient;
  roundness?: number;
  autopilot?: boolean | { expand?: number; collapse?: number };
  button?: SileoButton;
  descriptionAlign?: SileoTextAlign;
  closable?: boolean;
}

/** Layout data a toast needs to place itself inside its position stack. */
export interface SileoStackProps {
  stackIndex: number;
  stackSize: number;
  frontHeight: number;
  stackExpanded: boolean;
  stackVisible: boolean;
}

export interface SileoPromiseOptions<T = unknown> {
  loading: SileoOptions;
  success: SileoOptions | ((data: T) => SileoOptions);
  error: SileoOptions | ((error: unknown) => SileoOptions);
  action?: SileoOptions | ((data: T) => SileoOptions);
  position?: SileoPosition;
}

export interface SileoToasterProps {
  position?: SileoPosition;
  offset?: SileoOffsetValue | SileoOffsetConfig;
  /** Stacking level for the toast viewport. Defaults above common dialogs/modals. */
  zIndex?: number;
  /** Default lifetime in milliseconds for every toast rendered by this viewport. */
  duration?: number | null;
  options?: Partial<SileoOptions>;
  theme?: SileoTheme;
  /** Toasts rendered per position before the rest collapse behind the stack. */
  maxVisibleToasts?: number;
  /** Target for the viewport teleport. `false` renders in place. */
  teleport?: boolean | string;
}

export type SileoViewportStyle = CSSProperties;
