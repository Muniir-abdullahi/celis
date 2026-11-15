"use client";

import { useMemo, useState } from "react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Combobox } from "~/components/ui/combobox";
import { cn } from "~/lib/utils";
import {
  isSingleSelectType,
  metadataOptionLabel,
  type MetadataField,
} from "~/lib/category-metadata";

interface MetadataFieldInputProps {
  field: MetadataField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

/**
 * Renders one "Category details" field for every type the category field
 * system can emit (`text`, `textarea`, `number`, `boolean`, `select`,
 * `single-select`, `multi-select`).
 */
export function MetadataFieldInput({ field, value, error, onChange }: MetadataFieldInputProps) {
  const id = `meta-${field.key}`;
  const options = useMemo(
    () =>
      (field.options ?? []).map((opt) => ({
        value: opt,
        label: metadataOptionLabel(field, opt),
      })),
    [field]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-celis-destructive"> *</span>}
      </Label>

      {field.type === "text" && (
        <Input
          id={id}
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          maxLength={field.maxLength ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          id={id}
          rows={3}
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          maxLength={field.maxLength ?? undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {field.type === "number" && (
        <NumberFieldInput id={id} value={value} onChange={onChange} invalid={!!error} />
      )}

      {field.type === "boolean" && (
        <ChoiceChips
          id={id}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          selected={value === true ? ["true"] : value === false ? ["false"] : []}
          onToggle={(v) => {
            const next = v === "true";
            onChange(value === next ? null : next);
          }}
        />
      )}

      {isSingleSelectType(field.type) &&
        (options.length > 0 ? (
          <Combobox
            value={typeof value === "string" ? value : undefined}
            onValueChange={(v) => onChange(v || null)}
            options={options}
            placeholder={`Select ${field.label.toLowerCase()}`}
            searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
            label={field.label}
          />
        ) : (
          <p className="text-sm text-celis-ink-secondary">No options configured.</p>
        ))}

      {field.type === "multi-select" &&
        (options.length > 0 ? (
          <ChoiceChips
            id={id}
            options={options}
            selected={Array.isArray(value) ? value.map(String) : []}
            onToggle={(v) => {
              const current = Array.isArray(value) ? value.map(String) : [];
              const next = current.includes(v)
                ? current.filter((x) => x !== v)
                : [...current, v];
              onChange(next.length > 0 ? next : null);
            }}
          />
        ) : (
          <p className="text-sm text-celis-ink-secondary">No options configured.</p>
        ))}

      {field.helpText && !error && (
        <p className="text-xs text-celis-ink-secondary">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-celis-destructive">{error}</p>}
    </div>
  );
}

/**
 * Number input that keeps the raw text while focused and shows the
 * normalized number on blur, so "012" displays as "12".
 */
function NumberFieldInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const committed = typeof value === "number" && !Number.isNaN(value) ? String(value) : "";

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={draft ?? committed}
      onFocus={() => setDraft(committed)}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^-?\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
        onChange(raw === "" || raw === "-" || raw === "." ? null : Number(raw));
      }}
      onBlur={() => setDraft(null)}
      aria-invalid={invalid}
    />
  );
}

function ChoiceChips({
  id,
  options,
  selected,
  onToggle,
}: {
  id: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div id={id} role="group" className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-celis-primary bg-celis-primary-subtle font-medium text-celis-primary"
                : "border-celis-border bg-celis-surface-base text-celis-ink hover:border-celis-primary/50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
