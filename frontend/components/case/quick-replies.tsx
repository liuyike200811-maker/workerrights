"use client";

import * as React from "react";
import { Check, Send, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PressRipples, pressClass, usePressFeedback } from "@/components/ui/press-feedback";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/api";

export function QuickReplyBar({
  question,
  onSend,
  onEdit,
  disabled,
}: {
  question: Question;
  onSend: (text: string) => void;
  onEdit: () => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [lastKey, setLastKey] = React.useState(question.key);
  const skipPress = usePressFeedback();

  if (lastKey !== question.key) {
    setLastKey(question.key);
    setSelected([]);
  }

  const options = question.quick_replies || [];
  const multi = Boolean(question.multi_select);

  const sendSingle = (label: string, value?: string) => {
    if (label === "我要修改信息") {
      onEdit();
      return;
    }
    onSend(value || label);
  };

  const toggle = (label: string) => {
    if (label.includes("都没有")) {
      setSelected((current) => (current.includes(label) ? [] : [label]));
      return;
    }
    setSelected((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current.filter((item) => !item.includes("都没有")), label],
    );
  };

  if (!options.length && !question.optional) return null;

  return (
    <div className="border-t border-ink-100 bg-ink-50/70 px-3 py-2.5 sm:px-4">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="text-[10px] font-medium text-ink-400">
          {multi ? "可以多选，选好后发送" : "点击选项可以直接回答"}
        </p>
        {question.optional && (
          <button
            type="button"
            onClick={() => onSend("跳过")}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium text-ink-400 transition hover:text-ink-700 disabled:opacity-50",
              pressClass(skipPress),
            )}
            onPointerDown={skipPress.handlers.onPointerDown}
            onPointerUp={skipPress.handlers.onPointerUp}
            onPointerCancel={skipPress.handlers.onPointerCancel}
            onPointerLeave={skipPress.handlers.onPointerLeave}
            onAnimationEnd={skipPress.onAnimationEnd}
          >
            <PressRipples ripples={skipPress.ripples} onDone={skipPress.removeRipple} />
            <SkipForward className="h-3 w-3" />
            跳过这个问题
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.label);
          return (
            <QuickReplyChip
              key={option.label}
              label={option.label}
              active={active}
              multi={multi}
              disabled={disabled}
              onClick={() => (multi ? toggle(option.label) : sendSingle(option.label, option.value))}
            />
          );
        })}
      </div>
      {multi && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={disabled || selected.length === 0}
            onClick={() => onSend(selected.join("、"))}
          >
            <Send className="h-3.5 w-3.5" />
            发送所选{selected.length ? `（${selected.length}）` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

function QuickReplyChip({
  label,
  active,
  multi,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  multi: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const press = usePressFeedback();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-brand-700 bg-brand-800 text-white"
          : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-800",
        pressClass(press),
      )}
      onPointerDown={press.handlers.onPointerDown}
      onPointerUp={press.handlers.onPointerUp}
      onPointerCancel={press.handlers.onPointerCancel}
      onPointerLeave={press.handlers.onPointerLeave}
      onAnimationEnd={press.onAnimationEnd}
    >
      <PressRipples ripples={press.ripples} onDone={press.removeRipple} />
      {multi && active && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}
