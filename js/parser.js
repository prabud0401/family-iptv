const M3UParser = {
  parse(text) {
    const lines = text.split('\n');
    const channels = [];
    let current = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#EXTINF:')) {
        current = this._parseExtInf(trimmed);
      } else if (current && trimmed && !trimmed.startsWith('#')) {
        current.url = trimmed;
        channels.push(current);
        current = null;
      }
    }

    return channels;
  },

  _parseExtInf(line) {
    const attrs = {};
    const attrRegex = /([\w-]+)="([^"]*)"/g;
    let match;
    while ((match = attrRegex.exec(line)) !== null) {
      attrs[match[1]] = match[2];
    }

    const nameMatch = line.match(/,(.+)$/);
    const displayName = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

    const resMatch = displayName.match(/\((\d+p)\)/);
    const resolution = resMatch ? resMatch[1] : null;
    const cleanName = displayName
      .replace(/\s*\(\d+p\)\s*/g, '')
      .replace(/\s*\[.*?\]\s*/g, '')
      .trim();

    return {
      id: attrs['tvg-id'] || cleanName.replace(/\s+/g, '_'),
      name: attrs['tvg-name'] || cleanName,
      displayName: cleanName,
      logo: attrs['tvg-logo'] || '',
      group: attrs['group-title'] || '',
      resolution,
      url: ''
    };
  },

  async fetchPlaylist(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed: ${resp.status} ${url}`);
    return this.parse(await resp.text());
  },

  async fetchForProfile(profile, onProgress) {
    const all = [];
    const seen = new Set();
    let loaded = 0;

    const results = await Promise.allSettled(
      profile.playlists.map(p =>
        this.fetchPlaylist(p.url).then(channels => {
          loaded++;
          if (onProgress) onProgress(loaded, profile.playlists.length);
          return channels.map(ch => ({ ...ch, category: p.category }));
        })
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const ch of r.value) {
          if (!seen.has(ch.url)) {
            seen.add(ch.url);
            all.push(ch);
          }
        }
      }
    }

    return all;
  }
};
