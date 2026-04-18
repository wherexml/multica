"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceStore } from "@multica/core/workspace";
import { api } from "@multica/core/api";
import { setLoggedInCookie } from "@/features/auth/auth-cookie";
import { localizeAuthError } from "@/features/auth/auth-error";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@multica/ui/components/ui/card";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Label } from "@multica/ui/components/ui/label";
import Link from "next/link";

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

export function validateCliCallback(cliCallback: string): boolean {
  try {
    const cbUrl = new URL(cliCallback);
    const hostname = cbUrl.hostname.toLowerCase();
    if (cbUrl.protocol !== "http:") return false;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      isPrivateIPv4(hostname)
    );
  } catch {
    return false;
  }
}

function redirectToCliCallback(url: string, token: string, state: string) {
  const separator = url.includes("?") ? "&" : "?";
  window.location.assign(
    `${url}${separator}token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`,
  );
}

function LoginPageContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const hydrateWorkspace = useWorkspaceStore((s) => s.hydrateWorkspace);
  const searchParams = useSearchParams();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const lastWorkspaceId =
    typeof window !== "undefined"
      ? localStorage.getItem("multica_workspace_id")
      : null;
  const cliCallbackUrl = searchParams.get("cli_callback");
  const cliState = searchParams.get("cli_state") ?? "";
  const hasCliCallback =
    cliCallbackUrl !== null && validateCliCallback(cliCallbackUrl);

  // Already authenticated — redirect to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      const token = localStorage.getItem("multica_token");
      if (hasCliCallback && cliCallbackUrl && token) {
        redirectToCliCallback(cliCallbackUrl, token, cliState);
        return;
      }
      router.replace(searchParams.get("next") || "/issues");
    }
  }, [isLoading, user, router, searchParams, hasCliCallback, cliCallbackUrl, cliState]);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    if (!email) {
      setError("请输入邮箱");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const { token, user } = await api.login(email, password);
      localStorage.setItem("multica_token", token);
      api.setToken(token);
      setUser(user);
      setLoggedInCookie();
      if (hasCliCallback && cliCallbackUrl) {
        redirectToCliCallback(cliCallbackUrl, token, cliState);
        return;
      }
      const wsList = await api.listWorkspaces();
      hydrateWorkspace(wsList, lastWorkspaceId);
      router.push(searchParams.get("next") || "/issues");
    } catch (err) {
      setError(localizeAuthError(err, "登录失败，请稍后重试"));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">OptiONE Platform</CardTitle>
          <CardDescription>请输入邮箱和密码以继续</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">邮箱</Label>
              <Input
                ref={emailRef}
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="请输入邮箱"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">密码</Label>
              <Input
                ref={passwordRef}
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-primary underline-offset-4 hover:underline"
            >
              注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
