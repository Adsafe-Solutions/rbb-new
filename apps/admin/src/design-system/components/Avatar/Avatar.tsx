import { useState } from "react";
import { cx } from "../../utils";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  /** The person or organization. Its initials are the fallback. */
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  /** True when the name is written next to the avatar, so reading it
   * again would be noise. */
  decorative?: boolean;
  className?: string;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

export function Avatar({ name, src, size = "md", decorative = false, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const label = decorative ? undefined : name;
  return (
    <span className={cx(styles.avatar, styles[size], className)} role={decorative ? undefined : "img"} aria-label={label} aria-hidden={decorative || undefined}>
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span className={styles.initials}>{initialsOf(name)}</span>}
    </span>
  );
}
