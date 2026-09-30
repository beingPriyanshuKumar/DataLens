interface SparkleIconProps {
  size?: number;
  color?: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export default function SparkleIcon({
  size = 24,
  color = "var(--color-ink)",
  className = "",
  "aria-hidden": ariaHidden = true,
}: SparkleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M12 2 C12 7 7 12 2 12 C7 12 12 17 12 22 C12 17 17 12 22 12 C17 12 12 7 12 2 Z" />
    </svg>
  );
}
