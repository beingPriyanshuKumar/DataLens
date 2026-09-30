import SparkleIcon from "./SparkleIcon";
import Button from "./Button";
import "./StateBlock.css";

interface LoadingProps {
  type: "loading";
  message?: string;
  className?: string;
}

interface EmptyProps {
  type: "empty";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

interface ErrorProps {
  type: "error";
  message: string;
  onRetry?: () => void;
  className?: string;
}

type StateBlockProps = LoadingProps | EmptyProps | ErrorProps;

export default function StateBlock(props: StateBlockProps) {
  if (props.type === "loading") {
    return (
      <div className={`state-block state-block--loading ${props.className || ""}`.trim()}>
        <div className="state-block__sparkle">
          <SparkleIcon size={32} color="var(--color-ink)" />
        </div>
        <div className="state-block__text">{props.message || "LOADING…"}</div>
      </div>
    );
  }

  if (props.type === "empty") {
    return (
      <div className={`state-block state-block--empty ${props.className || ""}`.trim()}>
        <div className="state-block__sparkle">
          <SparkleIcon size={32} color="var(--color-ink-muted)" />
        </div>
        <div className="state-block__message">{props.message}</div>
        {props.actionLabel && props.onAction && (
          <div className="state-block__action">
            <Button variant="secondary" onClick={props.onAction}>
              {props.actionLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`state-block state-block--error ${props.className || ""}`.trim()}>
      <div className="state-block__sparkle">
        <SparkleIcon size={32} color="var(--color-red)" />
      </div>
      <div className="state-block__message">{props.message}</div>
      {props.onRetry && (
        <div className="state-block__action">
          <Button variant="secondary" onClick={props.onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
