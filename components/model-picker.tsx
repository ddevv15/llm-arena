"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CatalogModel } from "@/lib/model-catalog";
import {
  MAX_SELECTED_MODELS as MAX_SELECTED,
  type FreeModelId,
} from "@/lib/models";

function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (contextLength >= 1_000) {
    return `${Math.round(contextLength / 1_000)}K`;
  }
  return `${contextLength}`;
}

type ModelPickerProps = {
  catalog: CatalogModel[];
  selectedIds: FreeModelId[];
  onChange: (selectedIds: FreeModelId[]) => void;
};

export function ModelPicker({
  catalog,
  selectedIds,
  onChange,
}: ModelPickerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectedModels = selectedIds
    .map((id) => catalog.find((model) => model.id === id))
    .filter((model): model is CatalogModel => model !== undefined);
  const availableModels = catalog.filter(
    (model) => !selectedIds.includes(model.id),
  );
  const isFull = selectedIds.length >= MAX_SELECTED;

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Models are unavailable right now. Try again shortly.
      </p>
    );
  }

  const addModel = (id: FreeModelId) => {
    if (isFull) {
      return;
    }
    onChange([...selectedIds, id]);
    setPopoverOpen(false);
  };

  const removeModel = (id: FreeModelId) => {
    onChange(selectedIds.filter((selected) => selected !== id));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedModels.map((model) => (
        <span
          key={model.id}
          className="flex items-center gap-1 rounded-sm border border-border bg-secondary py-0.5 pr-0.5 pl-2 text-xs text-secondary-foreground"
        >
          {model.name}
          <button
            type="button"
            aria-label={`Remove ${model.name}`}
            onClick={() => removeModel(model.id)}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFull}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            {isFull ? `${MAX_SELECTED}/${MAX_SELECTED} selected` : "Add model"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1" align="start">
          {availableModels.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Every model is already in the arena.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {availableModels.map((model) => (
                <li key={model.id}>
                  <button
                    type="button"
                    onClick={() => addModel(model.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{model.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatContextLength(model.contextLength)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
