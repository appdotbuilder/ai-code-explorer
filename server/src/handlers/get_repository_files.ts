import { db } from '../db';
import { codeFilesTable } from '../db/schema';
import { type CodeFile } from '../schema';
import { eq } from 'drizzle-orm';

export const getRepositoryFiles = async (repositoryId: number): Promise<CodeFile[]> => {
  try {
    // Query all code files for the specified repository
    const results = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.repository_id, repositoryId))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(file => ({
      ...file,
      complexity_score: file.complexity_score ? parseFloat(file.complexity_score) : null
    }));
  } catch (error) {
    console.error('Failed to fetch repository files:', error);
    throw error;
  }
};