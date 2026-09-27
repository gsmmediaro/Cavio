import type { ComponentProps, ReactNode } from "react";

export type ComposerFrameProps = {
  children: ReactNode;
  nudge?: ReactNode;
  connectedTop?: boolean;
  className?: string;
};

export type ComposerNudgeProps = {
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
};

export type ComposerChipProps = {
  icon?: ReactNode;
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
  onSteer?: () => void;
  steerLabel?: string;
  onClick?: () => void;
  pending?: boolean;
  className?: string;
  labelClassName?: string;
};

export type ComposerToolbarProps = {
  children: ReactNode;
  className?: string;
};

export type ComposerSendProps = {
  children?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** When true, apply Notra CTA primary gradient + inner glow */
  active?: boolean;
  tooltip?: string;
  label: string;
  onClick?: () => void;
};

export type ComposerToolbarButtonProps = ComponentProps<"button">;
