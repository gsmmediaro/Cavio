/**
 * Cavio Analyze composer — structure matches Notra Studio agent chat composer
 * (Composer.Frame → input area → Composer.Toolbar → Attach + controls + Send CTA).
 */
import { type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
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
  const canSend = Boolean(file) && !loading;
  const focusPatient = () => {
    document.getElementById(patientFieldId)?.focus();
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange?.(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange?.(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange?.(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileDrop(f);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (file) onAnalyze();
      else onPickFile();
    }
  };

  return (
    <div className={cn("w-full max-w-[680px]", className)}>
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
            dragOver ? "after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:bg-primary/5 after:ring-2 after:ring-inset after:ring-primary/30" : null,
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={focusPatient}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onFileInputChange(f);
              e.currentTarget.value = "";
            }}
          />

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

          {/* Input area — same relative host as Notra chat editor */}
          <div className="bg-background relative flex min-w-0 flex-col rounded-t-[13px]">
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

          {/* Toolbar — Attach + modality + Send (Notra Studio layout) */}
          <Composer.Toolbar>
            <Composer.ToolbarButton
              aria-label={file ? replaceLabel : attachLabel}
              className="size-7 justify-center px-0"
              onClick={(e) => {
                e.stopPropagation();
                onPickFile();
              }}
              type="button"
            >
              <Paperclip className="size-4" />
            </Composer.ToolbarButton>

            <Tabs
              value={modality}
              onValueChange={(v) => onModalityChange(v as "Panoramic" | "Bitewing")}
            >
              <TabsList variant="default" className="h-7">
                <TabsTrigger value="Panoramic" className="px-2.5 text-xs">
                  Panoramic
                </TabsTrigger>
                <TabsTrigger value="Bitewing" className="px-2.5 text-xs">
                  Bitewing
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Composer.Send
              active={canSend}
              busy={loading}
              disabled={!canSend}
              label={file ? sendLabel : getStartedLabel}
              tooltip={
                file
                  ? "Enter to analyze. Attach a scan first if empty."
                  : "Attach a panoramic or bitewing to analyze"
              }
              onClick={() => {
                if (file) onAnalyze();
              }}
            >
              <ArrowUp className="size-3.5" strokeWidth={2.25} />
            </Composer.Send>
          </Composer.Toolbar>
        </section>
      </Composer.Frame>
    </div>
  );
}
