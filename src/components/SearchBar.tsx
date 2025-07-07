interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSearch: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function SearchBar({ searchTerm, setSearchTerm, onSearch, loading }: SearchBarProps) {
  return (
    <div className="bg-white form-container rounded-lg shadow-md mb-8">
      <form onSubmit={onSearch} className="flex gap-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search podcasts..."
          className="flex-1 search-input"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !searchTerm.trim()}
          className="btn-primary font-semibold"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  );
} 