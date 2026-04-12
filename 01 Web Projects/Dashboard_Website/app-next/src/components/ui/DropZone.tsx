'use client';

// docs/04-css-design-system.md §Drop Zone
// docs/03-frontend-components.md §DropZone (ExpenseTracker file upload shell)

import { useRef, useState } from 'react';

interface DropZoneProps {
  accept?: string;
  onChange?: (file: File) => void;
  label?: string;
}

export default function DropZone({ accept = '.xlsx', onChange, label }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    onChange?.(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className={[
        'rounded-card p-8 text-center cursor-pointer transition-all duration-200',
        'border-2 border-dashed',
        isDragOver
          ? 'border-dashboard-accent bg-[rgba(56,189,248,0.06)]'
          : 'border-dashboard-border bg-dashboard-surface',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <p className="text-4xl mb-3 opacity-50 text-dashboard-muted">📁</p>
      {fileName ? (
        <p className="text-sm text-dashboard-text">
          <strong className="text-dashboard-accent">{fileName}</strong> — click to replace
        </p>
      ) : (
        <p className="text-sm text-dashboard-muted">
          {label ?? (
            <>
              Drag{' '}
              <strong className="text-dashboard-accent">.xlsx</strong> file here or{' '}
              <strong className="text-dashboard-accent">click to upload</strong>
            </>
          )}
        </p>
      )}
    </div>
  );
}
