"use client";

import * as React from "react";
import { Mic, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

const LINE = 23;
const MAX_ROWS = 5;
const MORPH_MS = 240;

const ARROW_UP = [12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11];
const SQUARE = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];

function pathAt(from: number[], to: number[], t: number) {
  let d = "";
  for (let i = 0; i < from.length; i += 2) {
    const x = from[i] + (to[i] - from[i]) * t;
    const y = from[i + 1] + (to[i + 1] - from[i + 1]) * t;
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

// 发送键在「箭头」和「停止方块」之间做一次挤压变形，形状、倾斜和缩放是连续的。
function SendGlyph({ busy }: { busy: boolean }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const pathRef = React.useRef<SVGPathElement | null>(null);
  const valueRef = React.useRef(busy ? 1 : 0);

  const paint = (value: number) => {
    pathRef.current?.setAttribute("d", pathAt(ARROW_UP, SQUARE, value));
    const goo = Math.sin(value * Math.PI);
    if (svgRef.current) {
      svgRef.current.style.transform = goo
        ? `rotate(${(8 * goo).toFixed(2)}deg) scale(${(1 - 0.12 * goo).toFixed(3)}, ${(1 + 0.12 * goo).toFixed(3)})`
        : "";
    }
  };

  React.useEffect(() => {
    paint(valueRef.current);
  }, []);

  React.useEffect(() => {
    const from = valueRef.current;
    const to = busy ? 1 : 0;
    if (from === to) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      valueRef.current = to;
      paint(to);
      return undefined;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / MORPH_MS);
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const value = from + (to - from) * eased;
      valueRef.current = value;
      paint(value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [busy]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 24 24"
      className="composer__glyph"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path ref={pathRef} d={pathAt(ARROW_UP, SQUARE, valueRef.current)} />
    </svg>
  );
}

export interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
  maxLength?: number;
  mic: {
    supported: boolean;
    listening: boolean;
    onToggle: () => void;
  };
  onEditInfo: () => void;
}

export function PromptComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  placeholder,
  maxLength = 2000,
  mic,
  onEditInfo,
}: PromptComposerProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const canSend = value.trim().length > 0;
  const armed = busy || canSend;

  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const max = LINE * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  React.useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });

  const submit = () => {
    if (!canSend || busy) return;
    onSend(value.trim());
  };

  return (
    <div ref={rootRef} className="composer" data-busy={busy ? "true" : "false"}>
      {menuOpen && (
        <div className="composer__menu" role="menu" aria-label="快捷操作">
          <button
            type="button"
            role="menuitem"
            className="composer__row"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setMenuOpen(false);
              mic.onToggle();
            }}
          >
            <span className="composer__row-icon">
              <Mic className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="composer__row-text">
              <span className="composer__row-name">{mic.listening ? "停止语音输入" : "语音输入"}</span>
              <span className="composer__row-desc">
                {mic.supported ? "用说话代替打字，音频不上传" : "当前浏览器不支持语音输入"}
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="composer__row"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setMenuOpen(false);
              onEditInfo();
            }}
          >
            <span className="composer__row-icon">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="composer__row-text">
              <span className="composer__row-name">修改案件信息</span>
              <span className="composer__row-desc">哪项说错了，直接改</span>
            </span>
          </button>
        </div>
      )}

      <div
        className="composer__field"
        onClick={(event) => {
          if (event.target === event.currentTarget) focusInput();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") setMenuOpen(false);
          }}
          placeholder={mic.listening ? "正在听你说…" : placeholder}
          aria-label="输入你的回答"
          className="composer__input"
        />

        <div className="composer__bar">
          <button
            type="button"
            className="composer__tool"
            aria-label="更多操作"
            aria-expanded={menuOpen}
            data-on={menuOpen ? "true" : "false"}
            onClick={() => {
              setMenuOpen((open) => !open);
              focusInput();
            }}
          >
            <span className="composer__plus" aria-hidden="true" />
          </button>

          <span className="composer__spacer" />

          <button
            type="button"
            className="composer__tool"
            aria-label={mic.listening ? "停止语音输入" : "语音输入"}
            aria-pressed={mic.listening}
            data-on={mic.listening ? "true" : "false"}
            title={mic.supported ? "语音输入（Chrome / Edge）" : "当前浏览器不支持语音输入"}
            onClick={mic.onToggle}
          >
            {mic.listening ? (
              <span className="composer__eq" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="composer__send"
            disabled={!armed}
            aria-label={busy ? "停止生成" : "发送"}
            data-armed={armed ? "true" : "false"}
            data-pressed={pressed ? "true" : "false"}
            onPointerDown={(event) => {
              if (event.button !== 0 || !armed) return;
              setPressed(true);
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onClick={() => {
              if (busy) onStop();
              else submit();
            }}
          >
            <SendGlyph busy={busy} />
          </button>
        </div>
      </div>
    </div>
  );
}
