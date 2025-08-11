import { z } from 'zod';

// Repository schema
export const repositorySchema = z.object({
  id: z.number(),
  github_url: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  owner: z.string(),
  default_branch: z.string(),
  last_analyzed: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Repository = z.infer<typeof repositorySchema>;

// Code file schema
export const codeFileSchema = z.object({
  id: z.number(),
  repository_id: z.number(),
  path: z.string(),
  content: z.string(),
  language: z.string().nullable(),
  size: z.number().int(),
  ai_summary: z.string().nullable(),
  complexity_score: z.number().nullable(),
  last_updated: z.coerce.date(),
  created_at: z.coerce.date()
});

export type CodeFile = z.infer<typeof codeFileSchema>;

// Code function schema for extracted functions/methods
export const codeFunctionSchema = z.object({
  id: z.number(),
  file_id: z.number(),
  name: z.string(),
  signature: z.string(),
  line_start: z.number().int(),
  line_end: z.number().int(),
  ai_explanation: z.string().nullable(),
  complexity_score: z.number().nullable(),
  created_at: z.coerce.date()
});

export type CodeFunction = z.infer<typeof codeFunctionSchema>;

// Code dependency schema
export const codeDependencySchema = z.object({
  id: z.number(),
  repository_id: z.number(),
  from_file: z.string(),
  to_file: z.string(),
  dependency_type: z.enum(['import', 'require', 'include', 'extend', 'inherit']),
  created_at: z.coerce.date()
});

export type CodeDependency = z.infer<typeof codeDependencySchema>;

// Code issue schema for AI-identified issues
export const codeIssueSchema = z.object({
  id: z.number(),
  file_id: z.number(),
  issue_type: z.enum(['bug', 'performance', 'security', 'style', 'maintainability']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  line_number: z.number().int().nullable(),
  suggestion: z.string().nullable(),
  created_at: z.coerce.date()
});

export type CodeIssue = z.infer<typeof codeIssueSchema>;

// Search query schema
export const searchQuerySchema = z.object({
  id: z.number(),
  repository_id: z.number(),
  query: z.string(),
  query_type: z.enum(['code', 'natural_language', 'function', 'file']),
  results_count: z.number().int(),
  created_at: z.coerce.date()
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Input schemas for creating entities
export const createRepositoryInputSchema = z.object({
  github_url: z.string().url(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner: z.string(),
  default_branch: z.string().default('main')
});

export type CreateRepositoryInput = z.infer<typeof createRepositoryInputSchema>;

export const createCodeFileInputSchema = z.object({
  repository_id: z.number(),
  path: z.string(),
  content: z.string(),
  language: z.string().nullable().optional(),
  size: z.number().int()
});

export type CreateCodeFileInput = z.infer<typeof createCodeFileInputSchema>;

export const createCodeFunctionInputSchema = z.object({
  file_id: z.number(),
  name: z.string(),
  signature: z.string(),
  line_start: z.number().int(),
  line_end: z.number().int()
});

export type CreateCodeFunctionInput = z.infer<typeof createCodeFunctionInputSchema>;

export const createCodeDependencyInputSchema = z.object({
  repository_id: z.number(),
  from_file: z.string(),
  to_file: z.string(),
  dependency_type: z.enum(['import', 'require', 'include', 'extend', 'inherit'])
});

export type CreateCodeDependencyInput = z.infer<typeof createCodeDependencyInputSchema>;

export const createCodeIssueInputSchema = z.object({
  file_id: z.number(),
  issue_type: z.enum(['bug', 'performance', 'security', 'style', 'maintainability']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  line_number: z.number().int().optional(),
  suggestion: z.string().optional()
});

export type CreateCodeIssueInput = z.infer<typeof createCodeIssueInputSchema>;

export const createSearchQueryInputSchema = z.object({
  repository_id: z.number(),
  query: z.string(),
  query_type: z.enum(['code', 'natural_language', 'function', 'file'])
});

export type CreateSearchQueryInput = z.infer<typeof createSearchQueryInputSchema>;

// Update schemas
export const updateRepositoryInputSchema = z.object({
  id: z.number(),
  description: z.string().nullable().optional(),
  default_branch: z.string().optional(),
  last_analyzed: z.coerce.date().optional()
});

export type UpdateRepositoryInput = z.infer<typeof updateRepositoryInputSchema>;

export const updateCodeFileInputSchema = z.object({
  id: z.number(),
  content: z.string().optional(),
  ai_summary: z.string().nullable().optional(),
  complexity_score: z.number().optional()
});

export type UpdateCodeFileInput = z.infer<typeof updateCodeFileInputSchema>;

// Search and query schemas
export const searchCodeInputSchema = z.object({
  repository_id: z.number(),
  query: z.string(),
  file_types: z.array(z.string()).optional(),
  include_ai_analysis: z.boolean().default(false)
});

export type SearchCodeInput = z.infer<typeof searchCodeInputSchema>;

export const naturalLanguageQueryInputSchema = z.object({
  repository_id: z.number(),
  question: z.string(),
  context_files: z.array(z.string()).optional()
});

export type NaturalLanguageQueryInput = z.infer<typeof naturalLanguageQueryInputSchema>;

// Response schemas
export const searchResultSchema = z.object({
  file_path: z.string(),
  line_number: z.number().int(),
  content_snippet: z.string(),
  relevance_score: z.number(),
  ai_context: z.string().nullable()
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const dependencyVisualizationSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string()
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string()
  }))
});

export type DependencyVisualization = z.infer<typeof dependencyVisualizationSchema>;

export const aiAnalysisResponseSchema = z.object({
  summary: z.string(),
  key_functions: z.array(z.string()),
  potential_issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  related_files: z.array(z.string())
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;