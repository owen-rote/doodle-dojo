"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PRESETS = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  // Sync hex input when color changes externally
  useEffect(() => {
    setHex(color);
  }, [color]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        swatchRef.current &&
        !swatchRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleHexChange = useCallback(
    (value: string) => {
      setHex(value);
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        onChange(value);
      }
    },
    [onChange]
  );

  const handleHexBlur = useCallback(() => {
    // Reset to current color if invalid
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setHex(color);
    }
  }, [hex, color]);

  return (
    <div className="relative">
      {/* Swatch button */}
      <button
        ref={swatchRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
      >
        <div
          className="h-5 w-5 rounded-full border border-white/20 shadow-inner"
          style={{ backgroundColor: color }}
        />
        <span className="text-[12px] text-white/30">Color</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#1a1a2e] p-3 shadow-2xl"
        >
          {/* Native color input as the gradient picker */}
          <div className="mb-3 flex items-center gap-3">
            <div className="relative h-28 flex-1 overflow-hidden rounded-lg border border-white/10">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  onChange(e.target.value);
                  setHex(e.target.value);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer border-0"
                style={{ padding: 0, margin: 0 }}
              />
            </div>
          </div>

          {/* Hex input */}
          <div className="mb-3 flex items-center gap-2">
            <label className="text-[11px] font-medium text-white/40">HEX</label>
            <input
              type="text"
              value={hex}
              onChange={(e) => handleHexChange(e.target.value)}
              onBlur={handleHexBlur}
              maxLength={7}
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 placeholder:text-white/20 focus:border-purple-500/50 focus:outline-none"
              placeholder="#000000"
            />
          </div>

          {/* Preset swatches */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setHex(c);
                }}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === c
                    ? "border-purple-400 scale-110"
                    : "border-white/10 hover:border-white/30"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
