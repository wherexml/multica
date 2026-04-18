export function formatLastTested(lastTestedAt: string | null): string {
  if (!lastTestedAt) return "未测试";

  const diff = Date.now() - new Date(lastTestedAt).getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export const sourceStatusMeta: Record<string, { label: string; badgeClassName: string }> = {
  connected: {
    label: "已连接",
    badgeClassName: "border-success/20 bg-success/10 text-success",
  },
  needs_auth: {
    label: "待认证",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
  },
  failed: {
    label: "连接失败",
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  untested: {
    label: "未测试",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export function getSourceStatusMeta(status: string): { label: string; badgeClassName: string } {
  return sourceStatusMeta[status] ?? sourceStatusMeta.untested!;
}

export const transportLabelMap: Record<string, string> = {
  http: "HTTP",
  sse: "SSE",
  stdio: "stdio",
};

export const authTypeLabelMap: Record<string, string> = {
  none: "无需认证",
  bearer: "Bearer",
  oauth: "OAuth",
};
