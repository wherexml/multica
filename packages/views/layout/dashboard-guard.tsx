"use client";

import type { ReactNode } from "react";
import { WorkspaceIdProvider } from "@multica/core/hooks";
import { useDashboardGuard } from "./use-dashboard-guard";

interface DashboardGuardProps {
  children: ReactNode;
  /** Path to redirect to when user is not authenticated */
  loginPath?: string;
  /** Rendered when auth or workspace is loading */
  loadingFallback?: ReactNode;
}

/**
 * Shared guard + provider wrapper for dashboard layouts.
 *
 * Handles: auth check → workspace check → WorkspaceIdProvider.
 * Both web and desktop layouts compose their own UI structure inside this.
 */
export function DashboardGuard({
  children,
  loginPath = "/",
  loadingFallback = null,
}: DashboardGuardProps) {
  const { user, isLoading, workspace } = useDashboardGuard(loginPath);

  // Show loading state while auth or workspace is being initialized
  if (isLoading || !workspace) return <>{loadingFallback}</>;
  
  // This should never happen due to the check above, but added for type safety
  if (!user) return null;

  // Only render children when workspace is confirmed to exist
  return (
    <WorkspaceIdProvider wsId={workspace.id}>
      {children}
    </WorkspaceIdProvider>
  );
}
