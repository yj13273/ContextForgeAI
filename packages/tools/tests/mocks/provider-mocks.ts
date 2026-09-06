import type { GitHubClientOptions } from "../../src/providers/github/client.js";
import type { LinearClientOptions } from "../../src/providers/linear/client.js";
import { GitHubClient } from "../../src/providers/github/client.js";
import { LinearClient } from "../../src/providers/linear/client.js";

export const MOCK_GITHUB_ISSUE = {
  number: 42,
  title: "Memory leak in auth session cache",
  body: "Sessions are not cleaned up after expiry.",
  state: "open",
  user: { login: "alice-dev" },
  labels: [{ name: "bug" }, { name: "p1" }],
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
  comments: 3,
  html_url: "https://github.com/acme/repo/issues/42",
};

export const MOCK_GITHUB_CODE_SEARCH = {
  total_count: 1,
  items: [
    {
      name: "cache.ts",
      path: "src/auth/cache.ts",
      sha: "a1b2c3d4e5f6",
      html_url: "https://github.com/acme/repo/blob/main/src/auth/cache.ts",
      repository: { full_name: "acme/repo" },
    },
  ],
};

export const MOCK_GITHUB_FILE_CONTENT = "export const SESSION_TTL = 3600;\n";
export const MOCK_GITHUB_FILE_BASE64 = Buffer.from(MOCK_GITHUB_FILE_CONTENT).toString("base64");

export const MOCK_GITHUB_FILE = {
  name: "cache.ts",
  path: "src/auth/cache.ts",
  sha: "a1b2c3d4e5f6",
  size: MOCK_GITHUB_FILE_CONTENT.length,
  content: MOCK_GITHUB_FILE_BASE64,
  encoding: "base64",
  html_url: "https://github.com/acme/repo/blob/main/src/auth/cache.ts",
};

export const MOCK_GITHUB_COMMITS = [
  {
    sha: "c0ffee123456",
    commit: {
      message: "fix(auth): fix session ttl calculation",
      author: {
        name: "Alice Dev",
        email: "alice@acme.com",
        date: "2026-01-02T14:00:00Z",
      },
    },
    html_url: "https://github.com/acme/repo/commit/c0ffee123456",
  },
];

export const MOCK_GITHUB_PR = {
  number: 88,
  title: "fix(auth): fix session cache ttl expiry",
  body: "Resolves #42 by setting eviction timer.",
  state: "open",
  user: { login: "alice-dev" },
  head: { ref: "fix/auth-leak", sha: "c0ffee123456" },
  base: { ref: "main", sha: "abcdef987654" },
  merged: false,
  html_url: "https://github.com/acme/repo/pull/88",
  created_at: "2026-01-02T15:00:00Z",
  updated_at: "2026-01-02T16:00:00Z",
};

export const MOCK_LINEAR_ISSUE = {
  id: "lin_issue_001",
  identifier: "ENG-404",
  title: "Service crashes on auth timeout",
  description: "Unhandled promise rejection in session renewal.",
  priority: 1,
  state: { id: "state_started", name: "In Progress", type: "started" },
  assignee: { id: "user_bob", name: "Bob Smith", email: "bob@acme.com" },
  creator: { id: "user_alice", name: "Alice Dev", email: "alice@acme.com" },
  url: "https://linear.app/acme/issue/ENG-404",
  createdAt: "2026-01-01T08:00:00Z",
  updatedAt: "2026-01-01T09:30:00Z",
};

export const MOCK_LINEAR_SEARCH_ISSUES = {
  nodes: [
    {
      id: "lin_issue_001",
      identifier: "ENG-404",
      title: "Service crashes on auth timeout",
      description: "Unhandled promise rejection in session renewal.",
      priority: 1,
      state: { id: "state_started", name: "In Progress" },
      url: "https://linear.app/acme/issue/ENG-404",
      createdAt: "2026-01-01T08:00:00Z",
    },
  ],
};

export const MOCK_LINEAR_COMMENTS = {
  nodes: [
    {
      id: "comment_001",
      body: "Investigating stack trace from production logs.",
      createdAt: "2026-01-01T11:00:00Z",
      user: { id: "user_bob", name: "Bob Smith", email: "bob@acme.com" },
    },
  ],
};

export const MOCK_LINEAR_UPDATE_ISSUE = {
  success: true,
  issue: {
    id: "lin_issue_001",
    identifier: "ENG-404",
    title: "Service crashes on auth timeout (Investigated)",
    description: "Root cause found: redis session eviction.",
    priority: 2,
    state: { name: "In Review" },
    updatedAt: "2026-01-02T10:00:00Z",
  },
};

export function createMockFetch(handlers: Record<string, (reqUrl: string, init?: RequestInit) => any>): typeof fetch {
  return (async (input: any, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();

    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern) || (pattern.startsWith("^") && new RegExp(pattern).test(url))) {
        const result = handler(url, init);
        if (result instanceof Response) return result;
        if (result && typeof result === "object" && typeof result.status === "number") {
          return new Response(JSON.stringify(result.body ?? {}), {
            status: result.status,
            headers: {
              "Content-Type": "application/json",
              ...(result.headers || {}),
            },
          });
        }
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ message: "Mock endpoint not handled", url }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

export function createMockGitHubClient(overrides?: Partial<GitHubClientOptions>): GitHubClient {
  const fetchFn = createMockFetch({
    "/issues/42": () => MOCK_GITHUB_ISSUE,
    "/search/code": () => MOCK_GITHUB_CODE_SEARCH,
    "/contents/src/auth/cache.ts": () => MOCK_GITHUB_FILE,
    "/commits": () => MOCK_GITHUB_COMMITS,
    "/pulls/88": () => MOCK_GITHUB_PR,
  });

  return new GitHubClient({
    token: "mock-gh-token",
    baseUrl: "https://api.github.com",
    fetchFn,
    ...overrides,
  });
}

export function createMockLinearClient(overrides?: Partial<LinearClientOptions>): LinearClient {
  const fetchFn = createMockFetch({
    "api.linear.app": (_url, init) => {
      const body = JSON.parse((init?.body as string) || "{}");
      const query = (body.query as string) || "";

      if (query.includes("query GetIssue")) {
        return { data: { issue: MOCK_LINEAR_ISSUE } };
      }
      if (query.includes("query SearchIssues")) {
        return { data: { issueSearch: MOCK_LINEAR_SEARCH_ISSUES } };
      }
      if (query.includes("query ListComments")) {
        return { data: { issue: { comments: MOCK_LINEAR_COMMENTS } } };
      }
      if (query.includes("mutation UpdateIssue")) {
        return { data: { issueUpdate: MOCK_LINEAR_UPDATE_ISSUE } };
      }

      return { data: null };
    },
  });

  return new LinearClient({
    apiKey: "lin_api_mock_key_123",
    apiUrl: "https://api.linear.app/graphql",
    fetchFn,
    ...overrides,
  });
}
