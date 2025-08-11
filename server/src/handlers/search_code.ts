import { db } from '../db';
import { codeFilesTable, searchQueriesTable } from '../db/schema';
import { type SearchCodeInput, type SearchResult } from '../schema';
import { eq, and, ilike, or } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export async function searchCode(input: SearchCodeInput): Promise<SearchResult[]> {
  try {
    // Build the conditions array
    const conditions: SQL<unknown>[] = [];

    // Filter by repository_id
    conditions.push(eq(codeFilesTable.repository_id, input.repository_id));

    // Filter by file types if provided
    if (input.file_types && input.file_types.length > 0) {
      const languageConditions = input.file_types.map(fileType => 
        ilike(codeFilesTable.language, fileType)
      );
      if (languageConditions.length > 0) {
        conditions.push(or(...languageConditions)!);
      }
    }

    // Apply search conditions - search in both path and content
    const searchConditions = [
      ilike(codeFilesTable.path, `%${input.query}%`),
      ilike(codeFilesTable.content, `%${input.query}%`)
    ];
    conditions.push(or(...searchConditions)!);

    // Build and execute the query
    const files = await db.select()
      .from(codeFilesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .execute();

    // Process results and create SearchResult objects
    const results: SearchResult[] = [];

    for (const file of files) {
      // Find all matching lines in content
      const lines = file.content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        const lowerQuery = input.query.toLowerCase();

        if (lowerLine.includes(lowerQuery)) {
          // Calculate relevance score based on various factors
          let relevanceScore = 0.5; // Base score

          // Boost score for exact matches
          if (line.includes(input.query)) {
            relevanceScore += 0.3;
          }

          // Boost score for matches at the beginning of the line
          if (lowerLine.trimStart().startsWith(lowerQuery)) {
            relevanceScore += 0.2;
          }

          // Create content snippet (show some context around the match)
          const startLine = Math.max(0, i - 1);
          const endLine = Math.min(lines.length - 1, i + 1);
          const contextLines = lines.slice(startLine, endLine + 1);
          const contentSnippet = contextLines.join('\n');

          // Generate AI context if requested
          let aiContext: string | null = null;
          if (input.include_ai_analysis) {
            // Simple AI context generation based on file content and match
            if (file.ai_summary) {
              aiContext = `From file analysis: ${file.ai_summary}`;
            } else {
              aiContext = `Match found in ${file.language || 'unknown'} file at line ${i + 1}`;
            }
          }

          results.push({
            file_path: file.path,
            line_number: i + 1,
            content_snippet: contentSnippet,
            relevance_score: Math.min(1.0, relevanceScore),
            ai_context: aiContext
          });
        }
      }
    }

    // Log the search query for analytics
    await db.insert(searchQueriesTable)
      .values({
        repository_id: input.repository_id,
        query: input.query,
        query_type: 'code',
        results_count: results.length
      })
      .execute();

    // Sort by relevance score (highest first) and return top results
    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 50); // Limit to top 50 results

  } catch (error) {
    console.error('Code search failed:', error);
    throw error;
  }
}