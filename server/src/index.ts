import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createRepositoryInputSchema,
  searchCodeInputSchema,
  naturalLanguageQueryInputSchema,
  createCodeFileInputSchema
} from './schema';

// Import handlers
import { createRepository } from './handlers/create_repository';
import { getRepositories } from './handlers/get_repositories';
import { getRepositoryFiles } from './handlers/get_repository_files';
import { analyzeCodeFile } from './handlers/analyze_code_file';
import { searchCode } from './handlers/search_code';
import { naturalLanguageQuery } from './handlers/natural_language_query';
import { getDependencyVisualization } from './handlers/get_dependency_visualization';
import { getCodeIssues } from './handlers/get_code_issues';
import { getFileFunctions } from './handlers/get_file_functions';
import { createCodeFile } from './handlers/create_code_file';
import { analyzeRepository } from './handlers/analyze_repository';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Repository management
  createRepository: publicProcedure
    .input(createRepositoryInputSchema)
    .mutation(({ input }) => createRepository(input)),

  getRepositories: publicProcedure
    .query(() => getRepositories()),

  analyzeRepository: publicProcedure
    .input(z.object({ repositoryId: z.number() }))
    .mutation(({ input }) => analyzeRepository(input.repositoryId)),

  // File management and analysis
  getRepositoryFiles: publicProcedure
    .input(z.object({ repositoryId: z.number() }))
    .query(({ input }) => getRepositoryFiles(input.repositoryId)),

  createCodeFile: publicProcedure
    .input(createCodeFileInputSchema)
    .mutation(({ input }) => createCodeFile(input)),

  analyzeCodeFile: publicProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(({ input }) => analyzeCodeFile(input.fileId)),

  getFileFunctions: publicProcedure
    .input(z.object({ fileId: z.number() }))
    .query(({ input }) => getFileFunctions(input.fileId)),

  // Search and exploration
  searchCode: publicProcedure
    .input(searchCodeInputSchema)
    .query(({ input }) => searchCode(input)),

  naturalLanguageQuery: publicProcedure
    .input(naturalLanguageQueryInputSchema)
    .query(({ input }) => naturalLanguageQuery(input)),

  // Visualization and insights
  getDependencyVisualization: publicProcedure
    .input(z.object({ repositoryId: z.number() }))
    .query(({ input }) => getDependencyVisualization(input.repositoryId)),

  getCodeIssues: publicProcedure
    .input(z.object({ repositoryId: z.number() }))
    .query(({ input }) => getCodeIssues(input.repositoryId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();