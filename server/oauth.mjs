const PROVIDERS = {
  github: {
    id: "github",
    label: "GitHub",
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    clientId: () => process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET ?? "",
    scope: "read:user",
  },
  google: {
    id: "google",
    label: "Google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    clientId: () => process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET ?? "",
    scope: "openid email profile",
  },
};

export function oauthStatus() {
  return {
    github: Boolean(PROVIDERS.github.clientId() && PROVIDERS.github.clientSecret()),
    google: Boolean(PROVIDERS.google.clientId() && PROVIDERS.google.clientSecret()),
  };
}

export function isProvider(value) {
  return value === "github" || value === "google";
}

export function baseUrl(request) {
  const configured = process.env.PLATEN_BASE_URL ?? process.env.APP_URL ?? "";
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin.replace(/\/$/, "");
}

export function callbackUrl(request, provider) {
  return `${baseUrl(request)}/api/auth/${provider}/callback`;
}

export function authorizeUrl(request, provider, state) {
  const config = PROVIDERS[provider];
  const url = new URL(config.authorize);
  url.searchParams.set("client_id", config.clientId());
  url.searchParams.set("redirect_uri", callbackUrl(request, provider));
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
  }
  return url.toString();
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function exchangeCode(request, provider, code) {
  const config = PROVIDERS[provider];
  if (provider === "github") {
    const response = await fetch(config.token, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.clientId(),
        client_secret: config.clientSecret(),
        code,
        redirect_uri: callbackUrl(request, provider),
      }),
    });
    const data = await readJson(response);
    return data.access_token ? String(data.access_token) : null;
  }

  const body = new URLSearchParams({
    client_id: config.clientId(),
    client_secret: config.clientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(request, provider),
  });
  const response = await fetch(config.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await readJson(response);
  return data.access_token ? String(data.access_token) : null;
}

export async function fetchProfile(provider, accessToken) {
  if (provider === "github") {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "platen-arena",
      },
    });
    const data = await readJson(response);
    if (!data.id) return null;
    return {
      id: String(data.id),
      name: data.name || data.login || "github fighter",
      avatar: data.avatar_url ?? null,
    };
  }

  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(response);
  if (!data.sub) return null;
  return {
    id: String(data.sub),
    name: data.name || data.email?.split("@")[0] || "google fighter",
    avatar: data.picture ?? null,
  };
}
