import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../utils";
import styles from "./Typography.module.css";

type HeadingSize = "display" | "h1" | "h2" | "h3";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** The document outline level — separate from how big it looks. */
  level: 1 | 2 | 3 | 4;
  size?: HeadingSize;
  children: ReactNode;
}

const DEFAULT_SIZE: Record<HeadingProps["level"], HeadingSize> = { 1: "h1", 2: "h2", 3: "h3", 4: "h3" };

export function Heading({ level, size, className, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const;
  return <Tag className={cx(styles.heading, `ds-text-${size ?? DEFAULT_SIZE[level]}`, className)} {...rest} />;
}

export type TextVariant = "body" | "body-small" | "label" | "caption" | "mono";
export type TextTone = "default" | "strong" | "muted" | "subtle" | "danger" | "success";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  children: ReactNode;
}

export function Text({ as: Tag = "p", variant = "body", tone = "default", className, ...rest }: TextProps) {
  return <Tag className={cx(`ds-text-${variant}`, styles[tone], className)} {...rest} />;
}
