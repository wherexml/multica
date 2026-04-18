const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "invalid request body": "请求内容无效",
  "name is required": "请输入姓名",
  "email is required": "请输入邮箱",
  "password is required": "请输入密码",
  "email and password are required": "请输入邮箱和密码",
  "password must be at least 8 characters": "密码至少需要 8 位",
  "email already registered": "该邮箱已注册",
  "failed to process password": "密码处理失败，请稍后重试",
  "failed to create user": "创建账号失败，请稍后重试",
  "failed to provision workspace": "初始化工作区失败，请稍后重试",
  "failed to generate token": "登录状态创建失败，请稍后重试",
  "invalid email or password": "邮箱或密码不正确",
};

export function localizeAuthError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();
  const localized = AUTH_ERROR_MESSAGES[message];
  if (localized) {
    return localized;
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror")
  ) {
    return "服务暂时不可用，请确认后端已启动";
  }

  return fallback;
}
