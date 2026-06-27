import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "./icons";

const KEY = {
  ARROW_DOWN: "ArrowDown",
  ARROW_UP: "ArrowUp",
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  HOME: "Home",
  END: "End",
} as const;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  buttonClassName = "",
  disabled = false,
}: SelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => getSelectedIndex(options, value));
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  const close = () => setOpen(false);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    setActiveIndex(getSelectedIndex(options, value));
    setMenuPosition(getMenuPosition(buttonRef.current));
    setOpen(true);
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
    buttonRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    setActiveIndex((current) => getNextEnabledIndex(options, current, direction));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const handlers: Partial<Record<string, () => void>> = {
      [KEY.ARROW_DOWN]: () => (open ? moveActive(1) : openMenu()),
      [KEY.ARROW_UP]: () => (open ? moveActive(-1) : openMenu()),
      [KEY.ENTER]: () => (open ? selectOption(activeIndex) : openMenu()),
      [KEY.SPACE]: () => (open ? selectOption(activeIndex) : openMenu()),
      [KEY.ESCAPE]: close,
      [KEY.HOME]: () => setActiveIndex(getBoundaryIndex(options, 1)),
      [KEY.END]: () => setActiveIndex(getBoundaryIndex(options, -1)),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      const menu = document.getElementById(listboxId);
      if (!rootRef.current?.contains(target) && !menu?.contains(target)) setOpen(false);
    };
    const handleViewportChange = () => setOpen(false);
    const handleScroll = (event: Event) => {
      const target = event.target as globalThis.Node;
      const menu = document.getElementById(listboxId);
      if (menu?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [listboxId, open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-soc-borderSubtle bg-soc-panel2 px-3 py-2 text-left text-sm text-white outline-none transition-all hover:border-soc-border focus:border-soc-brand focus:ring-2 focus:ring-soc-brand/20 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-soc-muted transition-transform duration-200 ${open ? "rotate-180 text-soc-brand" : ""}`}
        />
      </button>

      {open && menuPosition
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="fixed z-[100] max-h-64 overscroll-contain overflow-y-auto rounded-xl border border-soc-border bg-soc-elevated/95 p-1.5 shadow-2xl backdrop-blur-md animate-fade-in"
              style={menuPosition}
            >
              {options.map((option, index) => {
                const selected = option.value === value;
                const active = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(index)}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${getOptionClassName(selected, active)}`}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function getOptionClassName(selected: boolean, active: boolean) {
  if (selected) return "bg-soc-brand/15 text-soc-brand";
  if (active) return "bg-white/5 text-white";
  return "text-soc-muted hover:bg-white/5 hover:text-white";
}
function getSelectedIndex(options: SelectOption[], value: string) {
  const index = options.findIndex((option) => option.value === value && !option.disabled);
  return index >= 0 ? index : getBoundaryIndex(options, 1);
}

function getBoundaryIndex(options: SelectOption[], direction: 1 | -1) {
  const indexes = direction === 1 ? options.keys() : [...options.keys()].reverse();
  for (const index of indexes) {
    if (!options[index]?.disabled) return index;
  }
  return 0;
}

function getNextEnabledIndex(options: SelectOption[], current: number, direction: 1 | -1) {
  if (options.length === 0) return 0;
  let next = current;
  for (let count = 0; count < options.length; count += 1) {
    next = (next + direction + options.length) % options.length;
    if (!options[next]?.disabled) return next;
  }
  return current;
}

function getMenuPosition(button: HTMLButtonElement | null): MenuPosition | null {
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return {
    top: rect.bottom + 6,
    left: rect.left,
    width: rect.width,
  };
}
