import { db } from '../db';
import { codeDependenciesTable, codeFilesTable } from '../db/schema';
import { type DependencyVisualization } from '../schema';
import { eq } from 'drizzle-orm';

export async function getDependencyVisualization(repositoryId: number): Promise<DependencyVisualization> {
  try {
    // Get all dependencies for the repository
    const dependencies = await db.select()
      .from(codeDependenciesTable)
      .where(eq(codeDependenciesTable.repository_id, repositoryId))
      .execute();

    // Get all files for the repository to determine file types
    const files = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.repository_id, repositoryId))
      .execute();

    // Create a map of file paths to their metadata
    const fileMap = new Map(files.map(file => [file.path, file]));

    // Collect all unique file paths from dependencies
    const allFiles = new Set<string>();
    dependencies.forEach(dep => {
      allFiles.add(dep.from_file);
      allFiles.add(dep.to_file);
    });

    // Create nodes - determine file type based on extension and usage patterns
    const nodes = Array.from(allFiles).map(filePath => {
      const fileData = fileMap.get(filePath);
      let type = 'file'; // default type

      // Determine type based on file extension and patterns
      const extension = filePath.split('.').pop()?.toLowerCase();
      const fileName = filePath.split('/').pop()?.toLowerCase() || '';

      // Check extension-based types first (more specific)
      if (extension === 'json' || extension === 'yaml' || extension === 'yml') {
        type = 'config';
      } else if (extension === 'md' || extension === 'txt' || extension === 'rst') {
        type = 'documentation';
      } else if (fileName.includes('test') || fileName.includes('spec')) {
        type = 'test';
      } else if (fileName.includes('config') || fileName.includes('setting')) {
        type = 'config';
      } else if (fileName.includes('util') || fileName.includes('helper') || fileName.includes('lib')) {
        type = 'utility';
      } else if (fileName.includes('main') || fileName.includes('index') || fileName.includes('app')) {
        type = 'entry';
      } else if (fileData?.language) {
        // Use detected language as type if available
        type = fileData.language.toLowerCase();
      }

      return {
        id: filePath,
        label: filePath.split('/').pop() || filePath, // Show just filename as label
        type: type
      };
    });

    // Create edges from dependencies
    const edges = dependencies.map(dep => ({
      from: dep.from_file,
      to: dep.to_file,
      type: dep.dependency_type
    }));

    return {
      nodes,
      edges
    };
  } catch (error) {
    console.error('Failed to generate dependency visualization:', error);
    throw error;
  }
}