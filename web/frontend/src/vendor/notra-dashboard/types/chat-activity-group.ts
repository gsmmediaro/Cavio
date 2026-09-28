import type { ReactNode } from "react";

export interface ChatActivityStatusProps {
  children?: ReactNode;
  seconds: number;
  label?: string;
  active?: boolean;
}
