import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { Repository, SearchResult, SearchCodeInput } from '../../../server/src/schema';

interface SearchInterfaceProps {
  repository: Repository;
}

export function SearchInterface({ repository }: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search options
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(true);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  
  // Common file type filters
  const commonFileTypes = [
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rust', 'php'
  ];

  // Search history
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const handleSearch = useCallback(async (query: string = searchQuery) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    
    try {
      const searchInput: SearchCodeInput = {
        repository_id: repository.id,
        query: query.trim(),
        file_types: selectedFileTypes.length > 0 ? selectedFileTypes : undefined,
        include_ai_analysis: includeAiAnalysis
      };

      const results = await trpc.searchCode.query(searchInput);
      setSearchResults(results);
      
      // Add to search history (avoid duplicates)
      setSearchHistory((prev: string[]) => {
        const filtered = prev.filter((item: string) => item !== query.trim());
        return [query.trim(), ...filtered].slice(0, 10); // Keep last 10 searches
      });
    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, repository.id, selectedFileTypes, includeAiAnalysis]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleFileTypeToggle = (fileType: string) => {
    setSelectedFileTypes((prev: string[]) => 
      prev.includes(fileType)
        ? prev.filter((type: string) => type !== fileType)
        : [...prev, fileType]
    );
  };

  const clearFilters = () => {
    setSelectedFileTypes([]);
    setIncludeAiAnalysis(true);
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 0.4) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Code Search
          </CardTitle>
          <CardDescription>
            Search for code snippets, functions, and patterns within {repository.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search for code, functions, or patterns..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearching ? '🔄 Searching...' : '🔍 Search'}
              </Button>
            </div>

            {/* Search Options */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ai-analysis"
                  checked={includeAiAnalysis}
                  onCheckedChange={setIncludeAiAnalysis}
                />
                <Label htmlFor="ai-analysis" className="text-sm">
                  Include AI context and analysis
                </Label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Filter by file types:</Label>
                <div className="flex flex-wrap gap-2">
                  {commonFileTypes.map((fileType: string) => (
                    <Badge
                      key={fileType}
                      variant={selectedFileTypes.includes(fileType) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleFileTypeToggle(fileType)}
                    >
                      {fileType}
                    </Badge>
                  ))}
                </div>
                {selectedFileTypes.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </form>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Search History */}
      {searchHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📚 Recent Searches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((query: string, index: number) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => {
                    setSearchQuery(query);
                    handleSearch(query);
                  }}
                >
                  {query}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              📋 Search Results
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {searchResults.length} results
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {searchResults.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery ? (
                <>
                  <div className="text-4xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search query or filters
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">💡</div>
                  <h3 className="text-lg font-medium mb-2">Ready to Search</h3>
                  <p className="text-muted-foreground">
                    Enter a search query to find code snippets and patterns
                  </p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {searchResults.map((result: SearchResult, index: number) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    {/* Result Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          📄 {result.file_path}
                        </span>
                        <Badge variant="outline">
                          Line {result.line_number}
                        </Badge>
                      </div>
                      <Badge className={getRelevanceColor(result.relevance_score)}>
                        {(result.relevance_score * 100).toFixed(0)}% match
                      </Badge>
                    </div>

                    {/* Code Snippet */}
                    <div className="bg-muted rounded-lg p-3">
                      <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                        {result.content_snippet}
                      </pre>
                    </div>

                    {/* AI Context */}
                    {result.ai_context && (
                      <>
                        <Separator />
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <h4 className="text-sm font-medium text-blue-900 mb-1">
                            🤖 AI Context
                          </h4>
                          <p className="text-sm text-blue-800">
                            {result.ai_context}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Search Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💡 Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Code Patterns:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <code>function useState</code> - Find React hooks</li>
                <li>• <code>async/await</code> - Find async functions</li>
                <li>• <code>try catch</code> - Find error handling</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Specific Searches:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <code>"exact phrase"</code> - Exact matches</li>
                <li>• <code>class Component</code> - Class definitions</li>
                <li>• <code>import from</code> - Import statements</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}