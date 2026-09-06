import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ProviderValidationError,
  ProviderUnavailableError,
} from "../../errors.js";

export interface GitHubClientOptions {
  readonly token?: string;
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
}

export interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly user: { readonly login: string };
  readonly labels: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly commentsCount: number;
  readonly htmlUrl: string;
}

export interface GitHubCodeSearchResult {
  readonly totalCount: number;
  readonly items: Array<{
    readonly name: string;
    readonly path: string;
    readonly sha: string;
    readonly htmlUrl: string;
    readonly repository: { readonly fullName: string };
  }>;
}

export interface GitHubFile {
  readonly name: string;
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly content: string;
  readonly encoding: string;
  readonly htmlUrl?: string;
}

export interface GitHubCommit {
  readonly sha: string;
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
    readonly date: string;
  };
  readonly htmlUrl: string;
}

export interface GitHubPullRequest {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly user: { readonly login: string };
  readonly head: { readonly ref: string; readonly sha: string };
  readonly base: { readonly ref: string; readonly sha: string };
  readonly merged: boolean;
  readonly htmlUrl: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token ?? "";
    this.baseUrl = (options.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderUnavailableError(`GitHub network request failed: ${message}`);
    }

    if (response.status === 401) {
      throw new AuthenticationError("GitHub authentication failed: invalid or expired GITHUB_TOKEN.");
    }

    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        const resetHeader = response.headers.get("x-ratelimit-reset");
        const retryAfter = resetHeader ? Math.max(0, parseInt(resetHeader, 10) - Math.floor(Date.now() / 1000)) : undefined;
        throw new RateLimitError("GitHub API rate limit exceeded.", retryAfter);
      }
      throw new AuthorizationError("GitHub authorization failed: insufficient permissions or scopes.");
    }

    if (response.status === 404) {
      throw new NotFoundError(endpoint);
    }

    if (response.status === 422) {
      let errDetail = "Validation failed";
      try {
        const body = (await response.json()) as any;
        errDetail = body.message || errDetail;
      } catch {
        // use default
      }
      throw new ProviderValidationError(`GitHub validation failed: ${errDetail}`);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new RateLimitError("GitHub API rate limit exceeded.", retryAfter);
    }

    if (response.status >= 500) {
      throw new ProviderUnavailableError(`GitHub server returned status ${response.status}.`);
    }

    if (!response.ok) {
      throw new ProviderUnavailableError(`GitHub returned unexpected status ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const data = await this.request<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`
    );

    return {
      number: data.number,
      title: data.title ?? "",
      body: data.body ?? "",
      state: data.state ?? "open",
      user: { login: data.user?.login ?? "unknown" },
      labels: (data.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name ?? "")),
      createdAt: data.created_at ?? "",
      updatedAt: data.updated_at ?? "",
      commentsCount: data.comments ?? 0,
      htmlUrl: data.html_url ?? "",
    };
  }

  async searchCode(
    q: string,
    options: { owner?: string; repo?: string; perPage?: number } = {}
  ): Promise<GitHubCodeSearchResult> {
    let query = q;
    if (options.owner && options.repo) {
      query += ` repo:${options.owner}/${options.repo}`;
    }
    const perPage = options.perPage ?? 10;
    const data = await this.request<any>(
      `/search/code?q=${encodeURIComponent(query)}&per_page=${perPage}`
    );

    return {
      totalCount: data.total_count ?? 0,
      items: (data.items ?? []).map((item: any) => ({
        name: item.name ?? "",
        path: item.path ?? "",
        sha: item.sha ?? "",
        htmlUrl: item.html_url ?? "",
        repository: {
          fullName: item.repository?.full_name ?? "",
        },
      })),
    };
  }

  async getFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubFile> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const cleanPath = path.replace(/^\//, "");
    const data = await this.request<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}${query}`
    );

    let content = data.content ?? "";
    if (data.encoding === "base64" && typeof data.content === "string") {
      content = Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf-8");
    }

    return {
      name: data.name ?? "",
      path: data.path ?? "",
      sha: data.sha ?? "",
      size: data.size ?? 0,
      content,
      encoding: data.encoding ?? "utf-8",
      htmlUrl: data.html_url,
    };
  }

  async listCommits(
    owner: string,
    repo: string,
    options: { sha?: string; path?: string; perPage?: number } = {}
  ): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    if (options.sha) params.set("sha", options.sha);
    if (options.path) params.set("path", options.path);
    params.set("per_page", String(options.perPage ?? 10));

    const data = await this.request<any[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`
    );

    return (data ?? []).map((c: any) => ({
      sha: c.sha ?? "",
      message: c.commit?.message ?? "",
      author: {
        name: c.commit?.author?.name ?? "unknown",
        email: c.commit?.author?.email ?? "",
        date: c.commit?.author?.date ?? "",
      },
      htmlUrl: c.html_url ?? "",
    }));
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubPullRequest> {
    const data = await this.request<any>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`
    );

    return {
      number: data.number,
      title: data.title ?? "",
      body: data.body ?? "",
      state: data.state ?? "open",
      user: { login: data.user?.login ?? "unknown" },
      head: {
        ref: data.head?.ref ?? "",
        sha: data.head?.sha ?? "",
      },
      base: {
        ref: data.base?.ref ?? "",
        sha: data.base?.sha ?? "",
      },
      merged: Boolean(data.merged),
      htmlUrl: data.html_url ?? "",
      createdAt: data.created_at ?? "",
      updatedAt: data.updated_at ?? "",
    };
  }
}
