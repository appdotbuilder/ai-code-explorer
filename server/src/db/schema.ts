import { serial, text, pgTable, timestamp, integer, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const dependencyTypeEnum = pgEnum('dependency_type', ['import', 'require', 'include', 'extend', 'inherit']);
export const issueTypeEnum = pgEnum('issue_type', ['bug', 'performance', 'security', 'style', 'maintainability']);
export const severityEnum = pgEnum('severity', ['low', 'medium', 'high', 'critical']);
export const queryTypeEnum = pgEnum('query_type', ['code', 'natural_language', 'function', 'file']);

// Repositories table
export const repositoriesTable = pgTable('repositories', {
  id: serial('id').primaryKey(),
  github_url: text('github_url').notNull(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  owner: text('owner').notNull(),
  default_branch: text('default_branch').notNull(),
  last_analyzed: timestamp('last_analyzed'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Code files table
export const codeFilesTable = pgTable('code_files', {
  id: serial('id').primaryKey(),
  repository_id: integer('repository_id').notNull(),
  path: text('path').notNull(),
  content: text('content').notNull(),
  language: text('language'), // Nullable
  size: integer('size').notNull(),
  ai_summary: text('ai_summary'), // Nullable
  complexity_score: numeric('complexity_score', { precision: 5, scale: 2 }), // Nullable
  last_updated: timestamp('last_updated').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Code functions table
export const codeFunctionsTable = pgTable('code_functions', {
  id: serial('id').primaryKey(),
  file_id: integer('file_id').notNull(),
  name: text('name').notNull(),
  signature: text('signature').notNull(),
  line_start: integer('line_start').notNull(),
  line_end: integer('line_end').notNull(),
  ai_explanation: text('ai_explanation'), // Nullable
  complexity_score: numeric('complexity_score', { precision: 5, scale: 2 }), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Code dependencies table
export const codeDependenciesTable = pgTable('code_dependencies', {
  id: serial('id').primaryKey(),
  repository_id: integer('repository_id').notNull(),
  from_file: text('from_file').notNull(),
  to_file: text('to_file').notNull(),
  dependency_type: dependencyTypeEnum('dependency_type').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Code issues table
export const codeIssuesTable = pgTable('code_issues', {
  id: serial('id').primaryKey(),
  file_id: integer('file_id').notNull(),
  issue_type: issueTypeEnum('issue_type').notNull(),
  severity: severityEnum('severity').notNull(),
  description: text('description').notNull(),
  line_number: integer('line_number'), // Nullable
  suggestion: text('suggestion'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Search queries table
export const searchQueriesTable = pgTable('search_queries', {
  id: serial('id').primaryKey(),
  repository_id: integer('repository_id').notNull(),
  query: text('query').notNull(),
  query_type: queryTypeEnum('query_type').notNull(),
  results_count: integer('results_count').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const repositoriesRelations = relations(repositoriesTable, ({ many }) => ({
  codeFiles: many(codeFilesTable),
  codeDependencies: many(codeDependenciesTable),
  searchQueries: many(searchQueriesTable),
}));

export const codeFilesRelations = relations(codeFilesTable, ({ one, many }) => ({
  repository: one(repositoriesTable, {
    fields: [codeFilesTable.repository_id],
    references: [repositoriesTable.id],
  }),
  codeFunctions: many(codeFunctionsTable),
  codeIssues: many(codeIssuesTable),
}));

export const codeFunctionsRelations = relations(codeFunctionsTable, ({ one }) => ({
  codeFile: one(codeFilesTable, {
    fields: [codeFunctionsTable.file_id],
    references: [codeFilesTable.id],
  }),
}));

export const codeDependenciesRelations = relations(codeDependenciesTable, ({ one }) => ({
  repository: one(repositoriesTable, {
    fields: [codeDependenciesTable.repository_id],
    references: [repositoriesTable.id],
  }),
}));

export const codeIssuesRelations = relations(codeIssuesTable, ({ one }) => ({
  codeFile: one(codeFilesTable, {
    fields: [codeIssuesTable.file_id],
    references: [codeFilesTable.id],
  }),
}));

export const searchQueriesRelations = relations(searchQueriesTable, ({ one }) => ({
  repository: one(repositoriesTable, {
    fields: [searchQueriesTable.repository_id],
    references: [repositoriesTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Repository = typeof repositoriesTable.$inferSelect;
export type NewRepository = typeof repositoriesTable.$inferInsert;
export type CodeFile = typeof codeFilesTable.$inferSelect;
export type NewCodeFile = typeof codeFilesTable.$inferInsert;
export type CodeFunction = typeof codeFunctionsTable.$inferSelect;
export type NewCodeFunction = typeof codeFunctionsTable.$inferInsert;
export type CodeDependency = typeof codeDependenciesTable.$inferSelect;
export type NewCodeDependency = typeof codeDependenciesTable.$inferInsert;
export type CodeIssue = typeof codeIssuesTable.$inferSelect;
export type NewCodeIssue = typeof codeIssuesTable.$inferInsert;
export type SearchQuery = typeof searchQueriesTable.$inferSelect;
export type NewSearchQuery = typeof searchQueriesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  repositories: repositoriesTable,
  codeFiles: codeFilesTable,
  codeFunctions: codeFunctionsTable,
  codeDependencies: codeDependenciesTable,
  codeIssues: codeIssuesTable,
  searchQueries: searchQueriesTable,
};