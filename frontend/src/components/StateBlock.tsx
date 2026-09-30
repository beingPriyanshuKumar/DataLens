import SparkleIcon from "./SparkleIcon";
import Button from "./Button";
import "./StateBlock.css";

interface CommonProps {
  message?: string;
  title?: string;
  description?: string;
  className?: string;
}

interface LoadingProps extends CommonProps {
  type: "loading";
}

interface EmptyProps extends CommonProps {
  type: "empty";
  actionLabel?: string;
  onAction?: () => void;
  action?: { label: string; onClick: () => void };
}

interface ErrorProps extends CommonProps {
  type: "error";
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
}

type StateBlockProps = LoadingProps | EmptyProps | ErrorProps;

export default function StateBlock(props: StateBlockProps) {
  const heading = props.title || props.message || (props.type === "loading" ? "LOADING…" : "");
  const desc = props.description;

  if (props.type === "loading") {
    return (
      <div className={`state-block state-block--loading ${props.className || ""}`.trim()}>
        <div className="state-block__sparkle">
          <SparkleIcon size={32} color="var(--color-ink)" />
        </div>
        <div className="state-block__text">{heading}</div>
        {desc && <div className="state-block__desc">{desc}</div>}
      </div>
    );
  }

  if (props.type === "empty") {
    const actionLabel = props.action?.label || props.actionLabel;
    const actionFn = props.action?.onClick || props.onAction;

    return (
      <div className={`state-block state-block--empty ${props.className || ""}`.trim()}>
        <div className="state-block__sparkle">
          <SparkleIcon size={32} color="var(--color-ink-muted)" />
        </div>
        <div className="state-block__message">{heading}</div>
        {desc && <div className="state-block__desc">{desc}</div>}
        {actionLabel && actionFn && (
          <div className="state-block__action">
            <Button variant="secondary" onClick={actionFn}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const actionLabel = props.action?.label || (props.onRetry ? "Retry" : undefined);
  const actionFn = props.action?.onClick || props.onRetry;

  return (
    <div className={`state-block state-block--error ${props.className || ""}`.trim()}>
      <div className="state-block__sparkle">
        <SparkleIcon size={32} color="var(--color-red)" />
      </div>
      <div className="state-block__message">{heading}</div>
      {desc && <div className="state-block__desc">{desc}</div>}
      {actionLabel && actionFn && (
        <div className="state-block__action">
          <Button variant="secondary" onClick={actionFn}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
