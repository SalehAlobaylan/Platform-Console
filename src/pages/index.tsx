import { useState } from 'react';
import SearchBar from '../components/SearchBar';

interface Podcast {
  id: number;
  collection_id: number;
  collection_name: string;
  artist_name: string;
  artwork_url: string;
  genre: string;
  track_count: number;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
      });

      const result = await response.json();
      setPodcasts(result.success ? result.data || [] : []);
    } catch (error) {
      setPodcasts([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen page-container">
      <div className="max-w-4xl mx-auto">
        
        {/* Title */}
        <h1 className="text-4xl font-bold text-center text-primary-dark mb-8">
          iTunes Podcast Browser
        </h1>

        {/* Search Form */}
        <SearchBar 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSearch={handleSearch}
          loading={loading}
        />

        {/* Results */}
        {podcasts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 bg-primary-light rounded-t-lg">
              <h2 className="text-2xl font-bold text-primary-dark">
                Found {podcasts.length} podcasts
              </h2>
            </div>
            
            {/* Results grid */}
            <div className="results-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {podcasts.map((podcast) => (
                <div
                  key={podcast.id}
                  className="flex gap-4 podcast-card bg-white rounded-xl shadow-sm hover:shadow-md transition"
                >
                  <img
                    src={podcast.artwork_url}
                    alt={podcast.collection_name}
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                  <div className="flex-1 text-content">
                    <h3 className="text-xl font-bold text-gray-800 line-clamp-2 mb-2">
                      {podcast.collection_name}
                    </h3>
                    <p className="text-lg text-purple-600 font-semibold mb-2">
                      {podcast.artist_name}
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span className="genre-tag">
                        {podcast.genre}
                      </span>
                      <span className="text-gray-600">
                        {podcast.track_count} episodes
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}