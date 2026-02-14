"use client";

import { useEffect, useRef, useState } from "react";
import Wheel from "@uiw/react-color-wheel";

type TeamColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  placeholder?: string;
  invalid?: boolean;
};

function isValidHexForPicker(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function TeamColorPicker({
  value,
  onChange,
  placeholder = "#22c55e",
  invalid = false,
}: TeamColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayColor = isValidHexForPicker(value) ? value : "#888888";

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
  }

  function handleWheelChange(color: { hex: string }) {
    setInputValue(color.hex);
    onChange(color.hex);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-9 w-9 shrink-0 rounded-full border-2 border-zinc-600 shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          style={{ backgroundColor: displayColor }}
          title="Open color picker"
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <Wheel
            color={displayColor}
            onChange={handleWheelChange}
            width={150}
            height={150}
          />
        </div>
      )}

      {invalid && (
        <span className="text-[11px] text-amber-300">
          Enter a valid hex code like #22c55e or 22c55e.
        </span>
      )}
    </div>
  );
}
