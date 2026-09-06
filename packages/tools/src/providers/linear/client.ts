import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ProviderValidationError,
  ProviderUnavailableError,
} from "../../errors.js";

export interface LinearClientOptions {
  readonly apiKey?: string;
  readonly apiUrl?: string;
  readonly fetchFn?: typeof fetch;
}

export interface LinearIssue {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
  readonly priority: number;
  readonly state: { readonly id: string; readonly name: string; readonly type?: string } | null;
  readonly assignee: { readonly id: string; readonly name: string; readonly email: string } | null;
  readonly creator: { readonly id: string; readonly name: string; readonly email: string } | null;
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LinearComment {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly user: { readonly id: string; readonly name: string; readonly email: string } | null;
}

export interface LinearUpdateIssueInput {
  readonly title?: string;
  readonly description?: string;
  readonly stateId?: string;
  readonly priority?: number;
}

export interface LinearUpdateIssueResult {
  readonly success: boolean;
  readonly issue?: {
    readonly id: string;
    readonly identifier: string;
    readonly title: string;
    readonly description: string;
    readonly priority: number;
    readonly state?: string;
    readonly updatedAt: string;
  };
}

export class LinearClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: LinearClientOptions = {}) {
    this.apiKey = options.apiKey ?? "";
    this.apiUrl = options.apiUrl ?? "https://api.linear.app/graphql";
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = this.apiKey.startsWith("Bearer ")
        ? this.apiKey
        : this.apiKey;
    }

    let response: Response;
    try {
      response = await this.fetchFn(this.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderUnavailableError(`Linear network request failed: ${message}`);
    }

    if (response.status === 401) {
      throw new AuthenticationError("Linear authentication failed: invalid or expired LINEAR_API_KEY.");
    }

    if (response.status === 403) {
      throw new AuthorizationError("Linear authorization failed: insufficient permissions.");
    }

    if (response.status === 404) {
      throw new NotFoundError(this.apiUrl);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new RateLimitError("Linear API rate limit exceeded.", retryAfter);
    }

    if (response.status >= 500) {
      throw new ProviderUnavailableError(`Linear server returned status ${response.status}.`);
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new ProviderUnavailableError("Invalid JSON response from Linear.");
    }

    if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
      const firstError = json.errors[0];
      const errorMsg: string = firstError.message || "Unknown Linear GraphQL error";
      const lower = errorMsg.toLowerCase();

      if (lower.includes("authentication") || lower.includes("not authenticated") || lower.includes("invalid api key")) {
        throw new AuthenticationError("Linear authentication failed.");
      }
      if (lower.includes("forbidden") || lower.includes("permission") || lower.includes("not authorized")) {
        throw new AuthorizationError(`Linear authorization failed: ${errorMsg}`);
      }
      if (lower.includes("not found") || lower.includes("entity not found")) {
        throw new NotFoundError(errorMsg);
      }
      if (lower.includes("rate limit")) {
        throw new RateLimitError(errorMsg);
      }

      throw new ProviderValidationError(`Linear GraphQL error: ${json.errors.map((e: any) => e.message).join("; ")}`);
    }

    return json.data as T;
  }

  async getIssue(issueId: string): Promise<LinearIssue> {
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          url
          createdAt
          updatedAt
          state {
            id
            name
            type
          }
          assignee {
            id
            name
            email
          }
          creator {
            id
            name
            email
          }
        }
      }
    `;

    const data = await this.request<{ issue: any }>(query, { id: issueId });
    if (!data || !data.issue) {
      throw new NotFoundError(`Linear issue '${issueId}' not found.`);
    }

    const issue = data.issue;
    return {
      id: issue.id,
      identifier: issue.identifier ?? "",
      title: issue.title ?? "",
      description: issue.description ?? "",
      priority: issue.priority ?? 0,
      state: issue.state
        ? { id: issue.state.id, name: issue.state.name, type: issue.state.type }
        : null,
      assignee: issue.assignee
        ? { id: issue.assignee.id, name: issue.assignee.name, email: issue.assignee.email }
        : null,
      creator: issue.creator
        ? { id: issue.creator.id, name: issue.creator.name, email: issue.creator.email }
        : null,
      url: issue.url ?? "",
      createdAt: issue.createdAt ?? "",
      updatedAt: issue.updatedAt ?? "",
    };
  }

  async searchIssues(
    queryText: string,
    options: { limit?: number } = {}
  ): Promise<{ issues: Array<{ id: string; identifier: string; title: string; description: string; priority: number; state: string; url: string; createdAt: string }> }> {
    const query = `
      query SearchIssues($term: String!, $first: Int) {
        issueSearch(query: $term, first: $first) {
          nodes {
            id
            identifier
            title
            description
            priority
            url
            createdAt
            state {
              id
              name
            }
          }
        }
      }
    `;

    const data = await this.request<{ issueSearch: { nodes: any[] } }>(query, {
      term: queryText,
      first: options.limit ?? 10,
    });

    const nodes = data?.issueSearch?.nodes ?? [];
    return {
      issues: nodes.map((n) => ({
        id: n.id,
        identifier: n.identifier ?? "",
        title: n.title ?? "",
        description: n.description ?? "",
        priority: n.priority ?? 0,
        state: n.state?.name ?? "unknown",
        url: n.url ?? "",
        createdAt: n.createdAt ?? "",
      })),
    };
  }

  async listComments(issueId: string): Promise<LinearComment[]> {
    const query = `
      query ListComments($id: String!) {
        issue(id: $id) {
          id
          comments {
            nodes {
              id
              body
              createdAt
              user {
                id
                name
                email
              }
            }
          }
        }
      }
    `;

    const data = await this.request<{ issue: { comments: { nodes: any[] } } }>(query, {
      id: issueId,
    });

    const nodes = data?.issue?.comments?.nodes ?? [];
    return nodes.map((c) => ({
      id: c.id,
      body: c.body ?? "",
      createdAt: c.createdAt ?? "",
      user: c.user
        ? { id: c.user.id, name: c.user.name, email: c.user.email }
        : null,
    }));
  }

  async updateIssue(
    issueId: string,
    input: LinearUpdateIssueInput
  ): Promise<LinearUpdateIssueResult> {
    const mutation = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            updatedAt
            state {
              id
              name
            }
          }
        }
      }
    `;

    const data = await this.request<{ issueUpdate: { success: boolean; issue: any } }>(mutation, {
      id: issueId,
      input,
    });

    return {
      success: Boolean(data?.issueUpdate?.success),
      issue: data?.issueUpdate?.issue
        ? {
            id: data.issueUpdate.issue.id,
            identifier: data.issueUpdate.issue.identifier ?? "",
            title: data.issueUpdate.issue.title ?? "",
            description: data.issueUpdate.issue.description ?? "",
            priority: data.issueUpdate.issue.priority ?? 0,
            state: data.issueUpdate.issue.state?.name,
            updatedAt: data.issueUpdate.issue.updatedAt ?? "",
          }
        : undefined,
    };
  }
}
