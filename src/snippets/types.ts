export interface SnippetParameter {
  type: "string";
  required: boolean;
  default?: string;
}

export interface Snippet {
  name: string;
  namespace: string;
  version: string;
  description: string;
  parameters: Record<string, SnippetParameter>;
  script: string[];
}

export type RawSnippet = unknown;
