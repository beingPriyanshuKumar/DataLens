import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "circle";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  arrow?: boolean;
  size?: "small" | "medium";
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    arrow = false,
    size,
    className = "",
    children,
    ...props
  },
  ref
) {
  const showArrow =
    arrow || (variant === "primary" && typeof children === "string" && !children.includes("↗"));

  const sizeClass = size === "small" ? "button--small" : "";

  return (
    <button
      ref={ref}
      className={`button button--${variant} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
      {showArrow && (
        <span className="button__arrow" aria-hidden="true">
          ↗
        </span>
      )}
    </button>
  );
});

export default Button;
