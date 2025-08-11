import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { type Repository } from '../schema';
import { eq } from 'drizzle-orm';

export const analyzeRepository = async (repositoryId: number): Promise<Repository> => {
  try {
    // Check if repository exists first
    const existingRepo = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, repositoryId))
      .execute();

    if (existingRepo.length === 0) {
      throw new Error(`Repository with id ${repositoryId} not found`);
    }

    // Update the repository's last_analyzed timestamp
    const result = await db.update(repositoriesTable)
      .set({
        last_analyzed: new Date()
      })
      .where(eq(repositoriesTable.id, repositoryId))
      .returning()
      .execute();

    const repository = result[0];

    // Convert numeric fields if any (none in this table, but following the pattern)
    return {
      ...repository,
      // No numeric fields to convert in repositories table
    };
  } catch (error) {
    console.error('Repository analysis failed:', error);
    throw error;
  }
};