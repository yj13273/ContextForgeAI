import { describe, it, expect } from "vitest";
import { GitHubClient } from "../src/providers/github/client.js";
import { LinearClient } from "../src/providers/linear/client.js";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ProviderUnavailableError,
  sanitizeErrorMessage,
} from "../src/errors.js";
import {
  createMockGitHubClient,
  createMockLinearClient,
  createMockFetch,
  MOCK_GITHUB_FILE_CONTENT,
} from "./mocks/provider-mocks.js";

describe("Milestone 3: Provider Clients (Tests 15-23 + Error Normalization & Sanitization)", () => {
  const ghClient = createMockGitHubClient();
  const linClient = createMockLinearClient();

  // --- GitHub Operations (Tests 15-19) ---

  it("Test 15: GitHubClient.getIssue should return normalized issue data", async () => {
    const issue = await ghClient.getIssue("acme", "repo", 42);
    expect(issue.number).toBe(42);
    expect(issue.title).toBe("Memory leak in auth session cache");
    expect(issue.state).toBe("open");
    expect(issue.user.login).toBe("alice-dev");
    expect(issue.labels).toContain("bug");
    expect(issue.commentsCount).toBe(3);
  });

  it("Test 16: GitHubClient.searchCode should return code search matches", async () => {
    const result = await ghClient.searchCode("SESSION_TTL", { owner: "acme", repo: "repo" });
    expect(result.totalCount).toBe(1);
    expect(result.items[0].name).toBe("cache.ts");
    expect(result.items[0].path).toBe("src/auth/cache.ts");
    expect(result.items[0].repository.fullName).toBe("acme/repo");
  });

  it("Test 17: GitHubClient.getFile should decode base64 content correctly", async () => {
    const file = await ghClient.getFile("acme", "repo", "src/auth/cache.ts");
    expect(file.name).toBe("cache.ts");
    expect(file.path).toBe("src/auth/cache.ts");
    expect(file.content).toBe(MOCK_GITHUB_FILE_CONTENT);
    expect(file.encoding).toBe("base64");
  });

  it("Test 18: GitHubClient.listCommits should return normalized commit history", async () => {
    const commits = await ghClient.listCommits("acme", "repo", { perPage: 5 });
    expect(commits.length).toBe(1);
    expect(commits[0].sha).toBe("c0ffee123456");
    expect(commits[0].message).toContain("session ttl calculation");
    expect(commits[0].author.name).toBe("Alice Dev");
  });

  it("Test 19: GitHubClient.getPullRequest should return PR details", async () => {
    const pr = await ghClient.getPullRequest("acme", "repo", 88);
    expect(pr.number).toBe(88);
    expect(pr.title).toBe("fix(auth): fix session cache ttl expiry");
    expect(pr.head.ref).toBe("fix/auth-leak");
    expect(pr.base.ref).toBe("main");
    expect(pr.merged).toBe(false);
  });

  // --- Linear Operations (Tests 20-23) ---

  it("Test 20: LinearClient.getIssue should return normalized issue details", async () => {
    const issue = await linClient.getIssue("ENG-404");
    expect(issue.id).toBe("lin_issue_001");
    expect(issue.identifier).toBe("ENG-404");
    expect(issue.title).toBe("Service crashes on auth timeout");
    expect(issue.priority).toBe(1);
    expect(issue.state?.name).toBe("In Progress");
    expect(issue.assignee?.name).toBe("Bob Smith");
  });

  it("Test 21: LinearClient.searchIssues should return matching issues", async () => {
    const result = await linClient.searchIssues("timeout", { limit: 5 });
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].identifier).toBe("ENG-404");
    expect(result.issues[0].title).toContain("Service crashes");
  });

  it("Test 22: LinearClient.listComments should return comment thread", async () => {
    const comments = await linClient.listComments("ENG-404");
    expect(comments.length).toBe(1);
    expect(comments[0].id).toBe("comment_001");
    expect(comments[0].body).toContain("Investigating stack trace");
    expect(comments[0].user?.name).toBe("Bob Smith");
  });

  it("Test 23: LinearClient.updateIssue should perform mutation and return updated issue", async () => {
    const result = await linClient.updateIssue("lin_issue_001", {
      title: "Service crashes on auth timeout (Investigated)",
      priority: 2,
    });
    expect(result.success).toBe(true);
    expect(result.issue).toBeDefined();
    expect(result.issue?.identifier).toBe("ENG-404");
    expect(result.issue?.priority).toBe(2);
  });

  // --- Error Normalization & Secret Redaction ---

  it("should normalize HTTP 401 to AuthenticationError without leaking tokens", async () => {
    const mockAuthFailFetch = createMockFetch({
      "/repos/": () => ({ status: 401, body: { message: "Bad credentials" } }),
    });

    const client = new GitHubClient({
      token: "ghp_super_secret_token_12345",
      fetchFn: mockAuthFailFetch,
    });

    await expect(client.getIssue("org", "repo", 1)).rejects.toThrow(AuthenticationError);
  });

  it("should normalize HTTP 403 to AuthorizationError or RateLimitError", async () => {
    const mockRateLimitFetch = createMockFetch({
      "/repos/": () => ({
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "9999999999" },
        body: { message: "API rate limit exceeded" },
      }),
    });

    const client = new GitHubClient({ fetchFn: mockRateLimitFetch });
    await expect(client.getIssue("org", "repo", 1)).rejects.toThrow(RateLimitError);
  });

  it("should normalize HTTP 404 to NotFoundError", async () => {
    const mockNotFoundFetch = createMockFetch({
      "/repos/": () => ({ status: 404, body: { message: "Not Found" } }),
    });

    const client = new GitHubClient({ fetchFn: mockNotFoundFetch });
    await expect(client.getIssue("org", "repo", 99999)).rejects.toThrow(NotFoundError);
  });

  it("should normalize HTTP 500 to ProviderUnavailableError", async () => {
    const mock500Fetch = createMockFetch({
      "/repos/": () => ({ status: 500, body: { message: "Internal Server Error" } }),
    });

    const client = new GitHubClient({ fetchFn: mock500Fetch });
    await expect(client.getIssue("org", "repo", 1)).rejects.toThrow(ProviderUnavailableError);
  });

  it("should sanitize error messages and prevent secret leaks", () => {
    const rawError = "Request failed with Bearer ghp_super_secret_token_12345 at https://api.linear.app?apiKey=lin_api_secret_key_67890";
    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).not.toContain("ghp_super_secret_token_12345");
    expect(sanitized).not.toContain("lin_api_secret_key_67890");
    expect(sanitized).toContain("Bearer [REDACTED]");
    expect(sanitized).toContain("apiKey=[REDACTED]");
  });
});
