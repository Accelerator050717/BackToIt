import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useText } from './i18n';

export function Mark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'reconnect-mark large' : 'reconnect-mark'}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path d="M9 12h11c7 0 11 4 11 11v4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M39 36H28c-7 0-11-4-11-11v-4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="m12 25 5-5 5 5M26 23l5 5 5-5"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, []);
  const { t } = useText();
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label={t('关闭', 'Close')} onClick={onClose} disabled={busy}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  description,
  label,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  description: string;
  label: string;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useText();
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p className="muted">{description}</p>
      <div className="actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          {t('取消', 'Cancel')}
        </button>
        <button className="danger" onClick={onConfirm} disabled={busy}>
          {busy ? t('处理中…', 'Working…') : label}
        </button>
      </div>
    </Modal>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function ContinueIcon() {
  return <ArrowRight size={18} aria-hidden="true" />;
}
export function download(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
