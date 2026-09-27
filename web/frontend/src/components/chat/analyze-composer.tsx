/**
 * Cavio Analyze composer — structure matches Notra Studio agent chat composer
 * (Composer.Frame → input area → Composer.Toolbar → Attach + controls + Send).
 */
import { type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect } from "react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Paperclip } from "lucide-react";
import { Composer } from "@/components/composer/composer-shell";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AnalyzeComposerProps = {
  patientName: string;
  onPatientNameChange: (value: string) => void;
  placeholder: string;
  modality: "Panoramic" | "Bitewing";
  onModalityChange: (value: "Panoramic" | "Bitewing") => void;
  file: File | null;
  preview: string | null;
  onClearFile: () => void;
  onPickFile: () => void;
  onFileDrop: (file: File) => void;
  onAnalyze: () => void;
  loading?: boolean;
  attachLabel: string;
  replaceLabel: string;
  sendLabel: string;
  getStartedLabel: string;
  accept: string;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFileInputChange: (file: File | null) => void;
  dragOver?: boolean;
  onDragOverChange?: (over: boolean) => void;
  focused?: boolean;
  onFocusedChange?: (focused: boolean) => void;
  nudge?: ReactNode;
  className?: string;
};

export function AnalyzeComposer({
  patientName,
  onPatientNameChange,
  placeholder,
  modality,
  onModalityChange,
  file,
  preview,
  onClearFile,
  onPickFile,
  onFileDrop,
  onAnalyze,
  loading = false,
  attachLabel,
  replaceLabel,
  sendLabel,
  getStartedLabel,
  accept,
  fileInputRef,
  onFileInputChange,
  dragOver = false,
  onDragOverChange,
  focused = false,
  onFocusedChange,
  nudge,
  className,
}: AnalyzeComposerProps) {
  const patientFieldId = "cavio-analyze-patient";
  const fileInputId = "cavio-analyze-file";
  const canSend = Boolean(file) && !loading;
  const focusPatient = () => {
    document.getElementById(patientFieldId)?.focus();
  };

  // Clear stuck drag overlay (Escape / dragend outside) so ::after never eats clicks.
  useEffect(() => {
    const clear = () => onDragOverChange?.(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDragOverChange]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange?.(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    onDragOverChange?.(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange?.(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileDrop(f);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (file) onAnalyze();
      else onPickFile();
    }
  };

  return (
    <div className={cn("w-full max-w-[680px]", className)}>
      {/* File input outside the click-to-focus section so attach stays reliable */}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFileInputChange(f);
          e.currentTarget.value = "";
        }}
      />

      <Composer.Frame
        nudge={nudge}
        className={cn(
          dragOver || focused ? "ring-0" : null,
        )}
      >
        <section
          aria-label="Analyze scan composer"
          className={cn(
            "relative",
            // after:pointer-events-none — decorative drag ring must NEVER block attach/tabs/send
            dragOver
              ? "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:bg-primary/5 after:ring-2 after:ring-inset after:ring-primary/30"
              : null,
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Attachment chips row (Notra nudge/chips pattern) */}
          {file && preview ? (
            <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-3 pb-2">
              <Composer.Chip
                icon={
                  <img
                    src={preview}
                    alt=""
                    className="size-4 rounded object-cover"
                  />
                }
                label={file.name}
                onRemove={onClearFile}
                removeLabel="Remove attachment"
                className="border-solid"
                labelClassName="max-w-[16rem]"
              />
              <span className="text-xs text-muted-foreground">
                {modality} · ready to analyze
              </span>
            </div>
          ) : null}

          {/* Input area — click focuses patient field */}
          <div
            className="bg-background relative flex min-w-0 flex-col rounded-t-[13px]"
            onClick={focusPatient}
          >
            <div className="flex w-full min-w-0 items-center rounded-t-[12px]">
              <div className="relative flex min-w-0 flex-1 cursor-text transition-colors">
                <Input
                  id={patientFieldId}
                  type="text"
                  placeholder={placeholder}
                  value={patientName}
                  onChange={(e) => onPatientNameChange(e.target.value)}
                  onFocus={() => onFocusedChange?.(true)}
                  onBlur={() => onFocusedChange?.(false)}
                  onKeyDown={handleKeyDown}
                  className="h-auto min-h-12 w-full rounded-none border-0 bg-transparent px-3 py-2 text-sm leading-6 shadow-none focus-visible:ring-0 md:text-sm"
                  aria-label={placeholder}
                />
              </div>
            </div>
          </div>

          {/* Toolbar above any decorative overlays */}
          <Composer.Toolbar className="relative z-20">
            <Composer.ToolbarButton
              aria-label={file ? replaceLabel : attachLabel}
              className="relative z-20 size-7 justify-center px-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPickFile();
              }}
              type="button"
            >
              <Paperclip className="pointer-events-none size-4" />
            </Composer.ToolbarButton>

            <Tabs
              value={modality}
              onValueChange={(v) => onModalityChange(v as "Panoramic" | "Bitewing")}
              className="relative z-20"
            >
              <TabsList
                variant="default"
                className="h-7"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <TabsTrigger value="Panoramic" className="px-2.5 text-xs">
                  Panoramic
                </TabsTrigger>
                <TabsTrigger value="Bitewing" className="px-2.5 text-xs">
                  Bitewing
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Composer.Send
              busy={loading}
              disabled={!canSend}
              label={file ? sendLabel : getStartedLabel}
              tooltip={
                file
                  ? "Enter to analyze. Attach a scan first if empty."
                  : "Attach a panoramic or bitewing to analyze"
              }
              onClick={(e) => {
                e?.stopPropagation?.();
                if (file) onAnalyze();
              }}
            >
              <HugeiconsIcon
                className="size-4"
                icon={ArrowUp02Icon}
                strokeWidth={2}
              />
            </Composer.Send>
          </Composer.Toolbar>
        </section>
      </Composer.Frame>
    </div>
  );
}
