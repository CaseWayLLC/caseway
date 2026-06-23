import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { US_STATES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StateComboboxProps {
  /** Selected state full name (e.g. "Connecticut"), or "" when none. */
  value: string;
  onChange: (stateName: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable picker for the 50 US states + DC. Type to filter, then pick — the
 * client search requires a state before a town can be chosen.
 */
export function StateCombobox({
  value,
  onChange,
  className,
  disabled,
}: StateComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a state"
          disabled={disabled}
          className={cn(
            "h-10 justify-start gap-2 rounded-xl px-3 font-medium text-sm hover-elevate",
            !value && "text-muted-foreground/70",
            className,
          )}
        >
          <MapPin className="w-4 h-4 shrink-0 text-gold" />
          <span className="flex-1 truncate text-left">
            {value || "Select state"}
          </span>
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search state..." />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup>
              {US_STATES.map((s) => (
                <CommandItem
                  key={s.abbr}
                  value={s.name}
                  onSelect={() => {
                    onChange(s.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
