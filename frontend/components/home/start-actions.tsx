"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

export function StartCaseButton({
  children = "说说我的情况",
  className,
  variant = "default",
  size = "lg",
  showArrow = true,
}: {
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "accent";
  size?: "default" | "sm" | "lg";
  showArrow?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  return (
    <span className={cn("inline-flex flex-col items-start gap-2", className)}>
      <Button
        variant={variant}
        size={size}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const result = await api.createCase();
            router.push(`/case/${result.case.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "暂时无法创建案件，请稍后再试。");
            setLoading(false);
          }
        }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
        {!loading && showArrow ? <ArrowRight className="h-4 w-4" /> : null}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function DemoCaseButton({
  className,
  label = "打开虚构演示案件",
  variant = "outline",
  size = "default",
}: {
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "accent";
  size?: "default" | "sm" | "lg";
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  return (
    <span className={cn("inline-flex flex-col items-start gap-2", className)}>
      <Button
        variant={variant}
        size={size}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const result = await api.createDemo();
            router.push(`/case/${result.case.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "暂时无法打开演示案件，请确认后端已启动。");
            setLoading(false);
          }
        }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        {label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
