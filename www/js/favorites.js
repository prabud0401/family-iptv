const Favorites = {
  _KEY: 'iptv_favorites',
  _LAST: 'iptv_last_watched',

  getAll() {
    try { return JSON.parse(localStorage.getItem(this._KEY)) || []; }
    catch { return []; }
  },

  _save(favs) {
    localStorage.setItem(this._KEY, JSON.stringify(favs));
  },

  add(channel) {
    const favs = this.getAll();
    if (favs.some(f => f.url === channel.url)) return;
    favs.push({
      id: channel.id,
      name: channel.name,
      displayName: channel.displayName,
      logo: channel.logo,
      url: channel.url,
      category: channel.category,
      group: channel.group
    });
    this._save(favs);
  },

  remove(url) {
    this._save(this.getAll().filter(f => f.url !== url));
  },

  isFavorite(url) {
    return this.getAll().some(f => f.url === url);
  },

  toggle(channel) {
    if (this.isFavorite(channel.url)) {
      this.remove(channel.url);
      return false;
    }
    this.add(channel);
    return true;
  },

  getLastWatched() {
    try { return JSON.parse(localStorage.getItem(this._LAST)); }
    catch { return null; }
  },

  setLastWatched(channel) {
    localStorage.setItem(this._LAST, JSON.stringify({
      id: channel.id,
      name: channel.name || channel.displayName,
      displayName: channel.displayName,
      logo: channel.logo,
      url: channel.url,
      category: channel.category
    }));
  }
};
