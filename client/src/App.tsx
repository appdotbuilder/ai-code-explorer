import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RepositoryManager } from '@/components/RepositoryManager';
import { CodeExplorer } from '@/components/CodeExplorer';
import { AIAssistant } from '@/components/AIAssistant';
import { DependencyVisualization } from '@/components/DependencyVisualization';
import { SearchInterface } from '@/components/SearchInterface';
import type { Repository } from '../../server/src/schema';

function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepositories = useCallback(async () => {
    try {
      setError(null);
      const result = await trpc.getRepositories.query();
      setRepositories(result);
      // Auto-select first repository if none selected
      if (!selectedRepository && result.length > 0) {
        setSelectedRepository(result[0]);
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
      setError('Failed to load repositories');
    }
  }, [selectedRepository]);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  const handleRepositoryCreated = (repository: Repository) => {
    setRepositories((prev: Repository[]) => [...prev, repository]);
    setSelectedRepository(repository);
  };

  const handleRepositorySelect = (repository: Repository) => {
    setSelectedRepository(repository);
  };

  const handleAnalyzeRepository = async () => {
    if (!selectedRepository) return;
    
    setIsLoading(true);
    try {
      setError(null);
      await trpc.analyzeRepository.mutate({ repositoryId: selectedRepository.id });
      // Refresh repositories to get updated analysis timestamps
      await loadRepositories();
    } catch (error) {
      console.error('Failed to analyze repository:', error);
      setError('Failed to analyze repository');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🔍 AI Code Explorer
          </h1>
          <p className="text-slate-600 text-lg">
            Intelligent GitHub repository analysis and exploration powered by AI
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Repository Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📚 Repository Selection
              {selectedRepository && (
                <Badge variant="secondary" className="ml-auto">
                  {selectedRepository.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {repositories.map((repo: Repository) => (
                <Button
                  key={repo.id}
                  variant={selectedRepository?.id === repo.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRepositorySelect(repo)}
                  className="text-left"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{repo.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {repo.owner} • {repo.default_branch}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
            
            {selectedRepository && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <Button
                  onClick={handleAnalyzeRepository}
                  disabled={isLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? '🔄 Analyzing...' : '🤖 AI Analysis'}
                </Button>
                {selectedRepository.last_analyzed && (
                  <Badge variant="outline" className="text-green-600">
                    Last analyzed: {selectedRepository.last_analyzed.toLocaleDateString()}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        {selectedRepository ? (
          <Tabs defaultValue="explore" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
              <TabsTrigger value="explore" className="text-xs lg:text-sm">
                📁 Explore
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs lg:text-sm">
                🔍 Search
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs lg:text-sm">
                🤖 AI Assistant
              </TabsTrigger>
              <TabsTrigger value="dependencies" className="text-xs lg:text-sm">
                🕸️ Dependencies
              </TabsTrigger>
              <TabsTrigger value="manage" className="text-xs lg:text-sm">
                ⚙️ Manage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="explore" className="space-y-4">
              <CodeExplorer repository={selectedRepository} />
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <SearchInterface repository={selectedRepository} />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <AIAssistant repository={selectedRepository} />
            </TabsContent>

            <TabsContent value="dependencies" className="space-y-4">
              <DependencyVisualization repository={selectedRepository} />
            </TabsContent>

            <TabsContent value="manage" className="space-y-4">
              <RepositoryManager 
                repository={selectedRepository}
                onRepositoryCreated={handleRepositoryCreated}
                onRepositoriesRefresh={loadRepositories}
              />
            </TabsContent>
          </Tabs>
        ) : repositories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="space-y-4">
                <div className="text-6xl">🚀</div>
                <h3 className="text-xl font-semibold">Welcome to AI Code Explorer!</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Get started by adding your first GitHub repository. Our AI will analyze 
                  your code and help you understand it better.
                </p>
                <RepositoryManager 
                  onRepositoryCreated={handleRepositoryCreated}
                  onRepositoriesRefresh={loadRepositories}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <div className="space-y-4">
                <div className="text-4xl">👆</div>
                <h3 className="text-lg font-medium">Select a Repository</h3>
                <p className="text-slate-600">
                  Choose a repository from the list above to start exploring
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;