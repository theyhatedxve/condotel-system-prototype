import { useEffect, useRef, useState } from "react";
import { apiError } from "./useResource";

export function WorkflowForm({
  fields,
  initial = {},
  onSubmit,
  onCancel,
  submitLabel = "Save",
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (failure) {
      setError(apiError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="workflow-form" onSubmit={submit}>
      {fields.map((field) => (
        <label key={field.name}>
          <span>{field.label}</span>
          {field.type === "textarea" ? (
            <textarea
              maxLength={field.maxLength ?? 5000}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues({ ...values, [field.name]: e.target.value })
              }
            />
          ) : field.options ? (
            <select
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues({ ...values, [field.name]: e.target.value })
              }
            >
              <option value="">{field.placeholder || "Select…"}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || "text"}
              required={field.required}
              min={field.min}
              max={field.max}
              minLength={field.minLength}
              maxLength={field.maxLength}
              autoComplete={field.autoComplete || "off"}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues({ ...values, [field.name]: e.target.value })
              }
            />
          )}
          {field.help && <small>{field.help}</small>}
        </label>
      ))}
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      <div className="workflow-actions">
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button disabled={busy} type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
export function WorkflowDialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="workflow-dialog" onCancel={onClose}>
      <div className="workflow-dialog-heading">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
