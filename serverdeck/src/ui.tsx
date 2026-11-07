import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import X from "lucide-react/dist/esm/icons/x";

export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5 10 11-6 11 6-11 6-11-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m5 16 11 6 11-6M5 22l11 6 11-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyButton({
  value,
  label = "复制",
  load,
}: {
  value?: string;
  label?: string;
  load?: () => Promise<string>;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="icon-button copy-button"
      aria-label={state === "done" ? "已复制" : label}
      onClick={async () => {
        try {
          const text = load ? await load() : value || "";
          if (!text) throw new Error();
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("error");
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "done" ? <Check size={15} /> : <Copy size={15} />}
      {state !== "idle" ? (
        <span className="copy-feedback" role="status">
          {state === "done" ? "已复制" : "复制失败"}
        </span>
      ) : null}
    </button>
  );
}

export function Dialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Meter({
  label,
  value,
  detail,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  percent: number | null;
}) {
  const bounded = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const [amount, unit] = value.split(" ");
  return (
    <div className="meter">
      <div className="meter-heading">
        <span>{label}</span>
      </div>
      <strong className="meter-value numeric">
        {amount}
        {unit ? <span className="meter-unit">{unit}</span> : null}
      </strong>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent === null ? undefined : bounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          style={{ width: `${bounded}%` }}
          className={bounded > 85 ? "meter-high" : ""}
        />
      </div>
      <span className="meter-detail">{detail}</span>
    </div>
  );
}
