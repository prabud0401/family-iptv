/* ── TMDB browsing ─────────────────────────── */
const Movies = {
  TMDB_BASE: 'https://api.themoviedb.org/3',
  TMDB_IMG: 'https://image.tmdb.org/t/p',
  _defaultKey: '5d116f0e36b55de919ab50981405c9f7',
  _cache: {},

  STREAM_SOURCES: {
    'cinemaos': (type, id, s, e) => type === 'tv' ? `https://cinemaos.tech/player/${id}/${s}/${e}` : `https://cinemaos.tech/player/${id}`,
  },

  getKey() { return localStorage.getItem('tmdb_api_key') || this._defaultKey; },
  setKey(key) { localStorage.setItem('tmdb_api_key', key.trim()); },
  getSource() { return localStorage.getItem('stream_source') || 'cinemaos'; },
  setSource(src) { localStorage.setItem('stream_source', src); },
  isConfigured() { return Boolean(this.getKey()); },

  posterUrl(path, size) {
    return path ? `${this.TMDB_IMG}/${size || 'w342'}${path}` : '';
  },
  backdropUrl(path) {
    return path ? `${this.TMDB_IMG}/w780${path}` : '';
  },

  async _api(endpoint, params) {
    const p = Object.assign({ api_key: this.getKey() }, params || {});
    const qs = new URLSearchParams(p).toString();
    const url = `${this.TMDB_BASE}${endpoint}?${qs}`;
    if (this._cache[url]) return this._cache[url];
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TMDB ${r.status}`);
    const data = await r.json();
    this._cache[url] = data;
    return data;
  },

  async validateKey(key) {
    try { const r = await fetch(`${this.TMDB_BASE}/configuration?api_key=${key}`); return r.ok; }
    catch (_) { return false; }
  },

  async getTrending(page) { return this._api('/trending/all/week', { page: page || 1 }); },
  async getPopularMovies(page) { return this._api('/movie/popular', { page: page || 1 }); },
  async getPopularTV(page) { return this._api('/tv/popular', { page: page || 1 }); },
  async getTopRatedMovies(page) { return this._api('/movie/top_rated', { page: page || 1 }); },
  async getTopRatedTV(page) { return this._api('/tv/top_rated', { page: page || 1 }); },

  async getBollywood(page) {
    return this._api('/discover/movie', { page: page || 1, with_original_language: 'hi', sort_by: 'popularity.desc' });
  },
  async getTamilMovies(page) {
    return this._api('/discover/movie', { page: page || 1, with_original_language: 'ta', sort_by: 'popularity.desc' });
  },
  async getTamilTV(page) {
    return this._api('/discover/tv', { page: page || 1, with_original_language: 'ta', sort_by: 'popularity.desc' });
  },
  async getAnime(page) {
    return this._api('/discover/tv', { page: page || 1, with_genres: '16', sort_by: 'popularity.desc' });
  },

  async getMovieDetails(id) { return this._api('/movie/' + id, { append_to_response: 'credits,videos,recommendations' }); },
  async getTVDetails(id) { return this._api('/tv/' + id, { append_to_response: 'credits,videos,recommendations' }); },
  async getTVSeason(tvId, seasonNum) { return this._api('/tv/' + tvId + '/season/' + seasonNum); },
  async search(query, page) { return this._api('/search/multi', { query: query, page: page || 1 }); },

  getStreamUrl(type, tmdbId, season, episode) {
    const src = this.getSource();
    const fn = this.STREAM_SOURCES[src] || this.STREAM_SOURCES['cinesrc'];
    return fn(type, tmdbId, season, episode);
  },

  clearCache() { this._cache = {}; }
};

