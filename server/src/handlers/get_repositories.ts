import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { type Repository } from '../schema';
import { desc } from 'drizzle-orm';

export async function getRepositories(): Promise<Repository[]> {
  try {
    // Fetch all repositories ordered by creation date (newest first)
    const results = await db.select()
      .from(repositoriesTable)
      .orderBy(desc(repositoriesTable.created_at))
      .execute();

    // Convert the database results to the expected schema format
    return results.map(repo => ({
      id: repo.id,
      github_url: repo.github_url,
      name: repo.name,
      description: repo.description,
      owner: repo.owner,
      default_branch: repo.default_branch,
      last_analyzed: repo.last_analyzed,
      created_at: repo.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    throw error;
  }
}