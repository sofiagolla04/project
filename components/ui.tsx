"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (confirmDiscard()) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={() => {
            if (confirmDiscard()) onClose();
          }}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span>＋</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
  placeholder = "",
  step,
  min,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
      />
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export const num = (f: FormData, name: string) => Number(f.get(name));
export const text = (f: FormData, name: string) => String(f.get(name) ?? "");
export const cost = (f: FormData, name: string) =>
  text(f, name).trim() === "" ? null : Math.round(num(f, name) * 100);

// Submit without React's automatic uncontrolled-field reset: validation/network failures
// must leave user input in place. Forms are re-keyed or closed after successful saves.
export function Form({
  action,
  children,
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (data: FormData) => boolean | void | Promise<boolean | void>;
}) {
  const [error, setError] = useState("");
  return (
    <form
      {...props}
      onChange={(event) => {
        event.currentTarget.dataset.dirty = "true";
        props.onChange?.(event);
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setError("");
        try {
          const saved = await action(new FormData(form));
          // Handled validation/network failures may resolve without throwing.
          // Clear only on an explicit success; successful modal/re-keyed forms
          // otherwise unmount naturally, while failed input stays protected.
          if (saved === true) delete form.dataset.dirty;
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not save. Your input is retained.",
          );
        }
      }}
    >
      {children}
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
    </form>
  );
}
export function confirmDiscard() {
  return (
    !document.querySelector('form[data-dirty="true"]') ||
    window.confirm(
      "You have unsaved changes. Leave this form and discard them?",
    )
  );
}
