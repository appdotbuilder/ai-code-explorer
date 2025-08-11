import { db } from '../db';
import { codeFunctionsTable } from '../db/schema';
import { type CodeFunction } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getFileFunctions(fileId: number): Promise<CodeFunction[]> {
  try {
    // Query all functions for the specified file, ordered by line start
    const results = await db.select()
      .from(codeFunctionsTable)
      .where(eq(codeFunctionsTable.file_id, fileId))
      .orderBy(asc(codeFunctionsTable.line_start))
      .execute();

    // Convert numeric fields back to numbers for return
    return results.map(func => ({
      ...func,
      complexity_score: func.complexity_score ? parseFloat(func.complexity_score) : null
    }));
  } catch (error) {
    console.error('Failed to fetch file functions:', error);
    throw error;
  }
}