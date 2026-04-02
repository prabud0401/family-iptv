const App = {
  _allChannels: {},
  _playerSource: 'livetv',
  _currentCategory: '',
  _categoryChannels: [],
  channelIndex: -1,
  _overlayTimer: null,
  _searchTimer: null,
  _searchOpen: false,
  _moviesData: null,
  _currentDetail: null,
  _currentStreamArgs: null,
  _heroItem: null,

  init() {
    this._refs = {
      homeScreen:   document.getElementById('home-screen'),
      detailScreen: document.getElementById('detail-screen'),
      playerScreen: document.getElementById('player-screen'),
      video:        document.getElementById('video-player'),
      playerOverlay: document.getElementById('player-overlay'),
      playerName:   document.getElementById('player-channel-name'),
      playerCategory: document.getElementById('player-channel-category'),
      playerLogo:   document.getElementById('player-logo'),
      playerError:  document.getElementById('player-error'),
      favBtn:       document.getElementById('fav-btn'),
    };
    VideoPlayer.init(this._refs.video);
    this._bind();
    history.replaceState({ screen: 'home' }, '');
    this._showScreen('home');
    this._loadAll();
  },

  _showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this._refs[name + 'Screen'].classList.add('active');
    if (name !== 'home') {
      history.pushState({ screen: name }, '');
    }
    if (name === 'home') {
      requestAnimationFrame(() => {
        const first = document.querySelector('#content-sections .browse-card');
        if (first) first.focus();
      });
    }
  },

  /* ── Load everything ───────────────────────── */

  async _loadAll() {
    const container = document.getElementById('content-sections');
    const loading = document.getElementById('browse-loading');
    container.innerHTML = '';

    this._renderSkeletons(container);

    const liveTVPromises = LIVETV_SECTIONS.map(async (sec) => {
      try {
        const channels = await M3UParser.fetchPlaylist(sec.url);
        channels.forEach(ch => { ch.category = sec.category; });
        return { label: sec.label, category: sec.category, channels };
      } catch (_) {
        return { label: sec.label, category: sec.category, channels: [] };
      }
    });

    const moviesPromise = Movies.isConfigured() ? Promise.all([
      Movies.getTamilMovies(), Movies.getTamilTV(), Movies.getBollywood(),
      Movies.getTrending(), Movies.getPopularMovies(), Movies.getPopularTV(),
      Movies.getTopRatedMovies()
    ]).catch(() => null) : Promise.resolve(null);

    const [liveResults, moviesResults] = await Promise.all([
      Promise.all(liveTVPromises),
      moviesPromise,
    ]);

    loading.style.display = 'none';
    container.innerHTML = '';

    this._buildNavTabs(liveResults, moviesResults);

    liveResults.forEach(sec => {
      if (sec.channels.length > 0) {
        this._allChannels[sec.category] = sec.channels;
        this._renderChannelRow(container, sec.label, sec.category, sec.channels);
      }
    });

    if (moviesResults) {
      const [tamil, tamilTV, bollywood, trending, popMovies, popTV, topMovies] = moviesResults;
      this._moviesData = { tamil, tamilTV, bollywood, trending, popMovies, popTV, topMovies };
      this._renderMovieRows(container);
      this._setupHeroBanner(trending || popMovies);
    }

    requestAnimationFrame(() => {
      const first = container.querySelector('.browse-card');
      if (first) first.focus();
    });
  },

  _renderSkeletons(container) {
    for (let s = 0; s < 4; s++) {
      const section = document.createElement('div');
      section.className = 'browse-section';
      const h = document.createElement('div');
      h.style.cssText = 'height:24px;width:200px;border-radius:8px;background:#1c1c1e;margin-left:48px;';
      section.appendChild(h);
      const row = document.createElement('div');
      row.className = 'skeleton-row';
      const cls = s < 2 ? 'channel' : 'movie';
      for (let i = 0; i < 10; i++) {
        const card = document.createElement('div');
        card.className = `skeleton-card ${cls}`;
        row.appendChild(card);
      }
      section.appendChild(row);
      container.appendChild(section);
    }
  },

  _buildNavTabs(liveResults, moviesResults) {
    const tabs = document.getElementById('nav-tabs');
    tabs.innerHTML = '';
    const items = [{ label: 'Home', id: 'all' }];
    liveResults.forEach(sec => {
      if (sec.channels.length > 0) items.push({ label: sec.category, id: sec.category });
    });
    if (moviesResults) items.push({ label: 'Movies', id: 'movies' });

    items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.className = 'nav-tab' + (i === 0 ? ' active' : '');
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this._scrollToSection(item.id);
      });
      tabs.appendChild(btn);
    });
  },

  _scrollToSection(id) {
    if (id === 'all') {
      document.getElementById('content-sections').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (id === 'movies') {
      const divider = document.querySelector('.section-divider');
      if (divider) divider.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const row = document.querySelector(`.browse-row[data-category="${id}"]`);
    if (row) row.closest('.browse-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /* ── Hero Banner ──────────────────────────── */

  _setupHeroBanner(data) {
    if (!data || !data.results || data.results.length === 0) return;
    const featured = data.results.find(m => m.backdrop_path) || data.results[0];
    if (!featured || !featured.backdrop_path) return;

    this._heroItem = featured;
    const banner = document.getElementById('hero-banner');
    const backdrop = document.getElementById('hero-backdrop');
    const title = document.getElementById('hero-title');
    const meta = document.getElementById('hero-meta');
    const desc = document.getElementById('hero-desc');

    backdrop.src = Movies.backdropUrl(featured.backdrop_path);
    backdrop.alt = featured.title || featured.name || '';
    title.textContent = featured.title || featured.name || '';

    const year = (featured.release_date || featured.first_air_date || '').substring(0, 4);
    const rating = featured.vote_average ? featured.vote_average.toFixed(1) : '';
    const mediaType = featured.media_type || (featured.first_air_date ? 'tv' : 'movie');
    let metaHtml = '';
    if (year) metaHtml += `<span class="hero-tag">${year}</span>`;
    if (rating) metaHtml += `<span class="hero-tag gold">\u2605 ${rating}</span>`;
    metaHtml += `<span class="hero-tag">${mediaType === 'tv' ? 'TV Show' : 'Movie'}</span>`;
    meta.innerHTML = metaHtml;

    desc.textContent = featured.overview || '';

    banner.classList.add('visible');
  },

  /* ── Render Live TV row (flat — label + row into container) ── */

  _renderChannelRow(container, label, category, channels) {
    const lbl = document.createElement('div');
    lbl.className = 'row-label';
    lbl.innerHTML = `<span class="section-badge live-badge">LIVE</span> ${label} <span class="section-count">${channels.length}</span>`;
    container.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'browse-row';
    row.setAttribute('data-category', category);

    channels.slice(0, 50).forEach((ch, i) => {
      const card = document.createElement('button');
      card.className = 'browse-card channel-browse-card';
      card.setAttribute('data-ch-category', category);
      card.setAttribute('data-ch-index', i);

      const logoWrap = document.createElement('div');
      logoWrap.className = 'bc-logo-wrap';
      if (ch.logo) {
        const img = document.createElement('img');
        img.className = 'bc-logo';
        img.src = ch.logo;
        img.alt = ch.displayName || ch.name;
        img.loading = 'lazy';
        img.onerror = function() {
          this.replaceWith(Object.assign(document.createElement('span'), {
            className: 'bc-logo-ph', textContent: (ch.displayName || ch.name || '?')[0]
          }));
        };
        logoWrap.appendChild(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'bc-logo-ph';
        ph.textContent = (ch.displayName || ch.name || '?')[0];
        logoWrap.appendChild(ph);
      }
      card.appendChild(logoWrap);

      const name = document.createElement('span');
      name.className = 'bc-name';
      name.textContent = ch.displayName || ch.name;
      card.appendChild(name);

      row.appendChild(card);
    });

    container.appendChild(row);
  },

  /* ── Render Movies rows (flat — label + row into container) ── */

  _renderMovieRows(container) {
    const d = this._moviesData;
    if (!d) return;

    const divider = document.createElement('div');
    divider.className = 'section-divider';
    divider.innerHTML = '<span>Movies & Series</span>';
    container.appendChild(divider);

    const sections = [
      { title: 'Tamil Movies', data: d.tamil },
      { title: 'Tamil TV Shows', data: d.tamilTV },
      { title: 'Bollywood', data: d.bollywood },
      { title: 'Trending This Week', data: d.trending },
      { title: 'Popular Movies', data: d.popMovies },
      { title: 'Popular TV Shows', data: d.popTV },
      { title: 'Top Rated Movies', data: d.topMovies },
    ];

    sections.forEach(({ title, data }) => {
      if (!data || !data.results || data.results.length === 0) return;

      const lbl = document.createElement('div');
      lbl.className = 'row-label';
      lbl.textContent = title;
      container.appendChild(lbl);

      const row = document.createElement('div');
      row.className = 'browse-row';
      data.results.forEach(item => row.appendChild(this._createMovieCard(item)));
      container.appendChild(row);
    });
  },

  _createMovieCard(item) {
    const card = document.createElement('button');
    card.className = 'browse-card movie-browse-card';

    const title = item.title || item.name || '';
    const poster = Movies.posterUrl(item.poster_path);
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    card.setAttribute('data-movie-id', item.id);
    card.setAttribute('data-media-type', mediaType);
    card.setAttribute('data-movie-raw', JSON.stringify(item));

    if (poster) {
      const img = document.createElement('img');
      img.className = 'movie-poster';
      img.loading = 'lazy';
      img.alt = title;
      img.src = poster;
      img.onerror = function () {
        this.replaceWith(Object.assign(document.createElement('div'), {
          className: 'movie-poster-placeholder', textContent: '\uD83C\uDFAC'
        }));
      };
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'movie-poster-placeholder';
      ph.textContent = '\uD83C\uDFAC';
      card.appendChild(ph);
    }

    const info = document.createElement('div');
    info.className = 'movie-info';
    info.innerHTML = `<span class="movie-title">${title}</span>
      <span class="movie-meta">${year}${rating ? ' \u2605 ' + rating : ''}</span>`;
    card.appendChild(info);

    if (rating) {
      const badge = document.createElement('span');
      badge.className = 'movie-rating';
      badge.textContent = '\u2605 ' + rating;
      card.appendChild(badge);
    }
    if (mediaType === 'tv') {
      const tb = document.createElement('span');
      tb.className = 'movie-type-badge';
      tb.textContent = 'TV';
      card.appendChild(tb);
    }

    return card;
  },

  /* ── Channel playback ──────────────────────── */

  _playChannelFromBrowse(category, index) {
    const channels = this._allChannels[category];
    if (!channels || !channels[index]) return;

    this._playerSource = 'livetv';
    this._currentCategory = category;
    this._categoryChannels = channels;
    this.channelIndex = index;

    document.getElementById('prev-btn').style.display = '';
    document.getElementById('next-btn').style.display = '';
    document.getElementById('chlist-btn').style.display = '';
    document.getElementById('fav-btn').style.display = '';
    document.getElementById('play-pause-btn').style.display = '';
    document.getElementById('settings-btn').style.display = '';
    document.getElementById('pip-btn').style.display = '';

    this._refs.playerOverlay.classList.remove('iframe-mode');
    this._refs.playerError.style.display = 'none';

    const iframe = document.getElementById('stream-iframe');
    iframe.src = '';
    iframe.style.display = 'none';
    iframe.onload = null;
    this._refs.video.style.display = '';

    const loader = document.getElementById('stream-loader');
    if (loader) loader.style.display = 'none';

    this._closeSettings();
    this._closeSidebar();
    this._showScreen('player');
    this._playChannel(channels[index]);
    this._showOverlay();
  },

  _playChannel(channel) {
    this._refs.playerError.style.display = 'none';
    this._refs.playerName.textContent = channel.displayName || channel.name;
    this._refs.playerCategory.textContent = channel.category || channel.group || '';
    this._refs.playerLogo.src = channel.logo || '';
    this._refs.playerLogo.style.display = channel.logo ? '' : 'none';
    this._updateFavBtn(channel);
    this._updatePlayPauseBtn(false);
    VideoPlayer.play(channel);
    this._showBanner(channel);
    this._updateSidebarActive();
  },

  _updateFavBtn(channel) {
    const isFav = Favorites.isFavorite(channel.url);
    this._refs.favBtn.textContent = isFav ? '\u2764' : '\u2661';
    this._refs.favBtn.classList.toggle('is-fav', isFav);
  },

  _updatePlayPauseBtn(paused) {
    const btn = document.getElementById('play-pause-btn');
    btn.innerHTML = paused ? '&#9654;' : '&#9208;';
  },

  _playNext() {
    if (this._categoryChannels.length === 0) return;
    this.channelIndex = (this.channelIndex + 1) % this._categoryChannels.length;
    this._playChannel(this._categoryChannels[this.channelIndex]);
    this._showOverlay();
  },

  _playPrev() {
    if (this._categoryChannels.length === 0) return;
    this.channelIndex = (this.channelIndex - 1 + this._categoryChannels.length) % this._categoryChannels.length;
    this._playChannel(this._categoryChannels[this.channelIndex]);
    this._showOverlay();
  },

  /* ── Overlay / Banner / Sidebar ────────────── */

  _showOverlay() {
    if (this._settingsOpen) return;
    this._refs.playerOverlay.classList.add('visible');
    clearTimeout(this._overlayTimer);
    const isIframe = this._refs.playerOverlay.classList.contains('iframe-mode');
    this._overlayTimer = setTimeout(() => {
      this._refs.playerOverlay.classList.remove('visible');
    }, isIframe ? 3000 : 5000);
  },
  _hideOverlay() {
    this._refs.playerOverlay.classList.remove('visible');
    clearTimeout(this._overlayTimer);
  },

  _settingsOpen: false,
  _sidebarOpen: false,
  _sidebarHighlight: -1,
  _bannerTimer: null,

  _openSettings() {
    this._settingsOpen = true;
    document.getElementById('settings-panel').classList.add('open');
    this._refreshTrackOptions();
    clearTimeout(this._overlayTimer);
    this._refs.playerOverlay.classList.add('visible');
  },
  _closeSettings() {
    this._settingsOpen = false;
    document.getElementById('settings-panel').classList.remove('open');
  },

  _refreshTrackOptions() {
    const audioOpts = document.getElementById('audio-options');
    const qualityOpts = document.getElementById('quality-options');
    const subtitleOpts = document.getElementById('subtitle-options');

    const audioTracks = VideoPlayer.getAudioTracks();
    audioOpts.innerHTML = '';
    document.getElementById('audio-group').classList.toggle('hidden', audioTracks.length === 0);
    audioTracks.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn' + (t.active ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', () => VideoPlayer.setAudioTrack(t.index));
      audioOpts.appendChild(btn);
    });

    const qualityLevels = VideoPlayer.getQualityLevels();
    qualityOpts.innerHTML = '';
    document.getElementById('quality-group').classList.toggle('hidden', qualityLevels.length === 0);
    qualityLevels.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn' + (l.active ? ' active' : '');
      btn.textContent = l.label;
      btn.addEventListener('click', () => VideoPlayer.setQuality(l.index));
      qualityOpts.appendChild(btn);
    });

    const subtitleTracks = VideoPlayer.getSubtitleTracks();
    subtitleOpts.innerHTML = '';
    document.getElementById('subtitle-group').classList.toggle('hidden', subtitleTracks.length === 0);
    subtitleTracks.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn' + (t.active ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', () => VideoPlayer.setSubtitleTrack(t.index));
      subtitleOpts.appendChild(btn);
    });
  },

  _openSidebar() {
    this._sidebarOpen = true;
    this._sidebarHighlight = this.channelIndex;
    const sidebar = document.getElementById('channel-sidebar');
    sidebar.classList.add('open');
    const list = document.getElementById('sidebar-channels');
    list.innerHTML = '';
    this._categoryChannels.forEach((ch, i) => {
      const item = document.createElement('button');
      item.className = 'sb-item' + (i === this.channelIndex ? ' sb-active' : '') + (i === this._sidebarHighlight ? ' sb-highlight' : '');
      item.setAttribute('data-sb-index', i);
      const logo = ch.logo
        ? `<img class="sb-logo" src="${ch.logo}" alt="" onerror="this.className='sb-initial';this.textContent='${(ch.displayName||ch.name||'?')[0]}'">`
        : `<span class="sb-initial">${(ch.displayName||ch.name||'?')[0]}</span>`;
      const fav = Favorites.isFavorite(ch.url) ? '<span class="sb-fav">\u2764</span>' : '';
      item.innerHTML = `<span class="sb-num">${i + 1}</span>${logo}<div class="sb-info"><span class="sb-name">${ch.displayName||ch.name}</span><span class="sb-cat">${ch.category||ch.group||''}</span></div>${fav}`;
      list.appendChild(item);
    });
    this._scrollSidebarToHighlight();
    clearTimeout(this._overlayTimer);
    this._refs.playerOverlay.classList.add('visible');
  },
  _closeSidebar() {
    this._sidebarOpen = false;
    document.getElementById('channel-sidebar').classList.remove('open');
  },
  _updateSidebarHighlight(newIdx) {
    if (newIdx < 0 || newIdx >= this._categoryChannels.length) return;
    this._sidebarHighlight = newIdx;
    document.querySelectorAll('.sb-item').forEach((el, i) => {
      el.classList.toggle('sb-highlight', i === newIdx);
    });
    this._scrollSidebarToHighlight();
  },
  _scrollSidebarToHighlight() {
    const items = document.querySelectorAll('.sb-item');
    if (items[this._sidebarHighlight]) {
      items[this._sidebarHighlight].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },
  _sidebarSelect() {
    if (this._sidebarHighlight >= 0 && this._sidebarHighlight < this._categoryChannels.length) {
      this.channelIndex = this._sidebarHighlight;
      this._playChannel(this._categoryChannels[this.channelIndex]);
      this._closeSidebar();
    }
  },
  _updateSidebarActive() {
    document.querySelectorAll('.sb-item').forEach((el, i) => {
      el.classList.toggle('sb-active', i === this.channelIndex);
    });
  },

  _showBanner(channel) {
    const banner = document.getElementById('channel-banner');
    document.getElementById('banner-number').textContent = this.channelIndex + 1;
    document.getElementById('banner-name').textContent = channel.displayName || channel.name;
    document.getElementById('banner-cat').textContent = channel.category || channel.group || '';
    const logo = document.getElementById('banner-logo');
    logo.src = channel.logo || '';
    logo.style.display = channel.logo ? '' : 'none';
    banner.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
  },

  /* ── Movie detail & playback ───────────────── */

  async _openMovieDetail(item) {
    this._showScreen('detail');
    const content = document.getElementById('detail-content');
    const loading = document.getElementById('detail-loading');
    content.innerHTML = '';
    loading.style.display = 'flex';

    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const detailData = mediaType === 'tv' ? await Movies.getTVDetails(item.id) : await Movies.getMovieDetails(item.id);
    loading.style.display = 'none';

    this._currentDetail = detailData;
    document.getElementById('detail-title').textContent = detailData.title || detailData.name || 'Details';

    const poster = Movies.posterUrl(detailData.poster_path, 'w342');
    const desc = detailData.overview || '';
    const year = (detailData.release_date || detailData.first_air_date || '').substring(0, 4);
    const rating = detailData.vote_average ? detailData.vote_average.toFixed(1) : '';
    const genres = (detailData.genres || []).map(g => g.name).join(', ');

    let heroHtml = '<div class="detail-hero">';
    if (poster) {
      heroHtml += `<img class="detail-poster" src="${poster}" alt="${detailData.title||detailData.name}" onerror="this.className='detail-poster-placeholder';this.textContent='\\uD83C\\uDFAC';">`;
    } else {
      heroHtml += '<div class="detail-poster-placeholder">\uD83C\uDFAC</div>';
    }
    heroHtml += `<div class="detail-info">
      <h2>${detailData.title || detailData.name || ''}</h2>
      <div class="detail-meta-row">
        ${year ? `<span class="detail-tag">${year}</span>` : ''}
        ${rating ? `<span class="detail-tag">\u2605 ${rating}</span>` : ''}
        ${genres ? `<span class="detail-tag">${genres}</span>` : ''}
        <span class="detail-tag">${mediaType === 'tv' ? 'TV Show' : 'Movie'}</span>
      </div>
      ${desc ? `<p class="detail-desc">${desc}</p>` : ''}
      <button class="detail-play-btn" id="detail-play-btn">\u25B6 Play</button>
    </div></div>`;

    content.innerHTML = heroHtml;

    document.getElementById('detail-play-btn').addEventListener('click', () => {
      this._playMovieContent(mediaType, detailData.id, mediaType === 'tv' ? 1 : undefined, mediaType === 'tv' ? 1 : undefined);
    });

    if (mediaType === 'tv' && detailData.seasons && detailData.seasons.length > 0) {
      const epSection = document.createElement('div');
      epSection.className = 'episodes-section';
      epSection.innerHTML = '<h3>Episodes</h3>';

      const seasonTabs = document.createElement('div');
      seasonTabs.className = 'season-tabs';
      const epList = document.createElement('div');
      epList.className = 'episodes-list';

      detailData.seasons.filter(s => s.season_number > 0).forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'season-tab' + (i === 0 ? ' active' : '');
        btn.textContent = s.name || `Season ${s.season_number}`;
        btn.addEventListener('click', async () => {
          seasonTabs.querySelectorAll('.season-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          epList.innerHTML = '<div class="loading" style="display:flex;padding:20px"><div class="spinner"></div></div>';
          const seasonData = await Movies.getTVSeason(detailData.id, s.season_number);
          epList.innerHTML = '';
          if (seasonData && seasonData.episodes) {
            seasonData.episodes.forEach(ep => {
              const ebtn = document.createElement('button');
              ebtn.className = 'episode-btn';
              ebtn.innerHTML = `<span class="ep-num">${ep.episode_number}</span><div class="ep-info"><span class="ep-title">${ep.name || 'Episode ' + ep.episode_number}</span><span class="ep-meta">${ep.air_date || ''}</span></div><span class="ep-play">\u25B6</span>`;
              ebtn.addEventListener('click', () => {
                this._playMovieContent('tv', detailData.id, s.season_number, ep.episode_number);
              });
              epList.appendChild(ebtn);
            });
          }
        });
        seasonTabs.appendChild(btn);
      });

      epSection.appendChild(seasonTabs);
      epSection.appendChild(epList);
      content.appendChild(epSection);

      if (seasonTabs.querySelector('.season-tab')) {
        seasonTabs.querySelector('.season-tab').click();
      }
    }

    if (detailData.recommendations && detailData.recommendations.results && detailData.recommendations.results.length > 0) {
      const recSection = document.createElement('div');
      recSection.className = 'browse-section';
      recSection.innerHTML = '<h3 class="section-title">You Might Also Like</h3>';
      const row = document.createElement('div');
      row.className = 'browse-row';
      detailData.recommendations.results.slice(0, 15).forEach(r => {
        r.media_type = r.media_type || mediaType;
        row.appendChild(this._createMovieCard(r));
      });
      recSection.appendChild(row);
      content.appendChild(recSection);
    }

    requestAnimationFrame(() => {
      const first = document.getElementById('detail-play-btn');
      if (first) first.focus();
    });
  },

  _playMovieContent(type, tmdbId, season, episode) {
    this._playerSource = 'movies';
    this._currentStreamArgs = { type, tmdbId, season, episode };
    this._showScreen('player');

    const detail = this._currentDetail || {};
    let title = detail.title || detail.name || 'Movie';
    if (type === 'tv' && season && episode) title += ' S' + season + ' E' + episode;

    this._refs.playerName.textContent = title;
    this._refs.playerLogo.style.display = 'none';
    this._refs.playerError.style.display = 'none';

    document.getElementById('prev-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('chlist-btn').style.display = 'none';
    document.getElementById('fav-btn').style.display = 'none';
    document.getElementById('play-pause-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'none';
    document.getElementById('pip-btn').style.display = 'none';

    this._refs.playerOverlay.classList.add('iframe-mode');
    VideoPlayer.stop();
    this._refs.video.style.display = 'none';

    this._loadCinemaOS();
  },

  _loadCinemaOS() {
    const args = this._currentStreamArgs;
    const url = args.type === 'tv'
      ? `https://cinemaos.tech/player/${args.tmdbId}/${args.season}/${args.episode}`
      : `https://cinemaos.tech/player/${args.tmdbId}`;

    this._refs.playerCategory.textContent = 'CinemaOS';

    const iframe = document.getElementById('stream-iframe');
    iframe.onload = null;
    iframe.src = url;
    iframe.style.display = 'block';

    const loader = document.getElementById('stream-loader');
    if (loader) loader.style.display = 'none';
  },

  /* ── Search ────────────────────────────────── */

  _openSearch() {
    this._searchOpen = true;
    document.getElementById('search-sidebar').classList.add('open');
    setTimeout(() => document.getElementById('search-input').focus(), 150);
  },
  _closeSearch() {
    this._searchOpen = false;
    document.getElementById('search-sidebar').classList.remove('open');
    document.getElementById('search-input').blur();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    const first = document.querySelector('#content-sections .browse-card');
    if (first) first.focus();
  },

  _doSearch(query) {
    const results = document.getElementById('search-results');
    if (!query.trim()) { results.innerHTML = ''; return; }
    const q = query.toLowerCase();
    results.innerHTML = '';

    Object.entries(this._allChannels).forEach(([cat, channels]) => {
      channels.forEach((ch, i) => {
        if ((ch.displayName || ch.name || '').toLowerCase().includes(q)) {
          const btn = document.createElement('button');
          btn.className = 'search-result-item';
          btn.innerHTML = `<span class="sr-badge live-badge">LIVE</span><span class="sr-name">${ch.displayName || ch.name}</span><span class="sr-cat">${cat}</span>`;
          btn.addEventListener('click', () => {
            this._closeSearch();
            this._playChannelFromBrowse(cat, i);
          });
          results.appendChild(btn);
        }
      });
    });

    if (Movies.isConfigured()) {
      Movies.search(query).then(data => {
        if (!data || !data.results) return;
        data.results.slice(0, 10).forEach(item => {
          const mt = item.media_type || 'movie';
          if (mt !== 'movie' && mt !== 'tv') return;
          const btn = document.createElement('button');
          btn.className = 'search-result-item';
          btn.innerHTML = `<span class="sr-badge movie-badge">${mt === 'tv' ? 'TV' : 'MOVIE'}</span><span class="sr-name">${item.title || item.name}</span><span class="sr-cat">${(item.release_date || item.first_air_date || '').substring(0,4)}</span>`;
          btn.addEventListener('click', () => {
            this._closeSearch();
            this._openMovieDetail(item);
          });
          results.appendChild(btn);
        });
      }).catch(() => {});
    }
  },

  /* ── Player back navigation ───────────────── */

  _goBackFromPlayer() {
    VideoPlayer.stop();
    this._closeSidebar();
    this._closeSettings();

    this._refs.playerOverlay.classList.remove('iframe-mode');

    const iframe = document.getElementById('stream-iframe');
    iframe.src = '';
    iframe.style.display = 'none';
    iframe.onload = null;
    this._refs.video.style.display = '';

    const loader = document.getElementById('stream-loader');
    if (loader) loader.style.display = 'none';

    this._showScreen('home');
  },

  /* ── Event binding ─────────────────────────── */

  _bind() {
    document.getElementById('search-toggle-btn').addEventListener('click', () => this._openSearch());
    document.getElementById('search-close-btn').addEventListener('click', () => this._closeSearch());
    document.getElementById('search-input').addEventListener('input', e => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this._doSearch(e.target.value), 300);
    });

    document.getElementById('hero-play-btn').addEventListener('click', () => {
      if (this._heroItem) this._openMovieDetail(this._heroItem);
    });

    document.getElementById('content-sections').addEventListener('click', e => {
      const chCard = e.target.closest('.channel-browse-card');
      if (chCard) {
        const cat = chCard.dataset.chCategory;
        const idx = parseInt(chCard.dataset.chIndex, 10);
        this._playChannelFromBrowse(cat, idx);
        return;
      }
      const mvCard = e.target.closest('.movie-browse-card');
      if (mvCard) {
        try {
          const data = JSON.parse(mvCard.dataset.movieRaw);
          data.media_type = mvCard.dataset.mediaType || data.media_type;
          this._openMovieDetail(data);
        } catch (_) {}
      }
    });

    document.getElementById('detail-content').addEventListener('click', e => {
      const card = e.target.closest('.movie-browse-card');
      if (!card) return;
      try {
        const data = JSON.parse(card.dataset.movieRaw);
        data.media_type = card.dataset.mediaType || data.media_type;
        this._openMovieDetail(data);
      } catch (_) {}
    });

    document.getElementById('detail-back-btn').addEventListener('click', () => this._showScreen('home'));
    document.getElementById('player-back-btn').addEventListener('click', () => this._goBackFromPlayer());

    document.getElementById('prev-btn').addEventListener('click', () => this._playPrev());
    document.getElementById('next-btn').addEventListener('click', () => this._playNext());
    document.getElementById('play-pause-btn').addEventListener('click', () => {
      if (this._refs.video.paused) { this._refs.video.play().catch(() => {}); this._updatePlayPauseBtn(false); }
      else { this._refs.video.pause(); this._updatePlayPauseBtn(true); }
    });
    this._refs.video.addEventListener('play',  () => this._updatePlayPauseBtn(false));
    this._refs.video.addEventListener('pause', () => this._updatePlayPauseBtn(true));

    this._refs.favBtn.addEventListener('click', () => {
      const ch = this._categoryChannels[this.channelIndex];
      if (!ch) return;
      Favorites.toggle(ch);
      this._updateFavBtn(ch);
    });

    document.getElementById('fullscreen-btn').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else this._refs.playerScreen.requestFullscreen().catch(() => {});
    });

    const pipBtn = document.getElementById('pip-btn');
    if (!VideoPlayer.isPiPSupported()) pipBtn.style.display = 'none';
    pipBtn.addEventListener('click', () => VideoPlayer.togglePiP());

    document.getElementById('chlist-btn').addEventListener('click', () => {
      if (this._sidebarOpen) this._closeSidebar();
      else this._openSidebar();
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
      if (this._settingsOpen) this._closeSettings();
      else this._openSettings();
    });
    document.getElementById('settings-close-btn').addEventListener('click', () => this._closeSettings());

    document.getElementById('speed-options').addEventListener('click', e => {
      const btn = e.target.closest('[data-speed]');
      if (!btn) return;
      VideoPlayer.setSpeed(parseFloat(btn.dataset.speed));
      document.querySelectorAll('#speed-options .opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    document.getElementById('aspect-options').addEventListener('click', e => {
      const btn = e.target.closest('[data-aspect]');
      if (!btn) return;
      VideoPlayer.setAspectRatio(btn.dataset.aspect);
      document.querySelectorAll('#aspect-options .opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    document.getElementById('sleep-options').addEventListener('click', e => {
      const btn = e.target.closest('[data-sleep]');
      if (!btn) return;
      const mins = parseInt(btn.dataset.sleep, 10);
      if (mins > 0) VideoPlayer.setSleepTimer(mins);
      else VideoPlayer.clearSleepTimer();
      document.querySelectorAll('#sleep-options .opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    document.addEventListener('tracks-updated', () => {
      if (this._settingsOpen) this._refreshTrackOptions();
    });
    document.addEventListener('sleep-triggered', () => {
      this._closeSettings();
      this._goBackFromPlayer();
    });

    document.getElementById('sidebar-channels').addEventListener('click', e => {
      const item = e.target.closest('.sb-item');
      if (!item) return;
      const idx = parseInt(item.dataset.sbIndex, 10);
      this._sidebarHighlight = idx;
      this._sidebarSelect();
    });

    this._refs.playerScreen.addEventListener('click', e => {
      if (e.target.closest('iframe')) return;
      if (!e.target.closest('button') && !e.target.closest('.player-controls') &&
          !e.target.closest('.settings-panel') &&
          !e.target.closest('.channel-sidebar') && !e.target.closest('input')) {
        if (this._refs.playerOverlay.classList.contains('iframe-mode')) return;
        if (this._sidebarOpen) this._closeSidebar();
        else if (this._settingsOpen) this._closeSettings();
        else this._showOverlay();
      }
    });

    document.addEventListener('player-error', () => {
      this._refs.playerError.style.display = 'flex';
    });
    document.getElementById('error-next-btn').addEventListener('click', () => {
      if (this._playerSource === 'livetv') this._playNext();
      else this._goBackFromPlayer();
    });

    this._refs.video.addEventListener('dblclick', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else this._refs.playerScreen.requestFullscreen().catch(() => {});
    });

    document.addEventListener('keydown', e => this._onKey(e));

    document.addEventListener('focusin', e => {
      const card = e.target.closest('.browse-card');
      if (card) this._scrollCard(card);
    });

    document.addEventListener('backbutton', e => {
      e.preventDefault();
      this._handleBack();
    });

    window.addEventListener('popstate', (e) => {
      e.preventDefault();
      history.pushState({ screen: 'home' }, '');
      this._handleBack();
    });
  },

  _handleBack() {
    const active = document.querySelector('.screen.active');
    if (active === this._refs.playerScreen) {
      this._goBackFromPlayer();
    } else if (active === this._refs.detailScreen) {
      this._showScreen('home');
    } else if (this._searchOpen) {
      this._closeSearch();
    }
    // On home screen: do nothing — don't close the app
  },

  /* ── Keyboard / Remote ─────────────────────── */

  _onKey(e) {
    if (this._searchOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this._closeSearch();
      } else if (e.key === 'ArrowDown') {
        const items = [...document.querySelectorAll('.search-result-item')];
        const idx = items.indexOf(document.activeElement);
        if (idx < items.length - 1) { e.preventDefault(); items[idx + 1].focus(); }
        else if (document.activeElement === document.getElementById('search-input') && items.length > 0) {
          e.preventDefault(); items[0].focus();
        }
      } else if (e.key === 'ArrowUp') {
        const items = [...document.querySelectorAll('.search-result-item')];
        const idx = items.indexOf(document.activeElement);
        if (idx > 0) { e.preventDefault(); items[idx - 1].focus(); }
        else if (idx === 0) { e.preventDefault(); document.getElementById('search-input').focus(); }
      }
      return;
    }

    const active = document.querySelector('.screen.active');

    if (active === this._refs.playerScreen) {
      if (this._settingsOpen) {
        if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this._closeSettings(); }
        return;
      }
      if (this._sidebarOpen) {
        switch (e.key) {
          case 'ArrowUp': case 'ChannelUp':
            e.preventDefault(); this._updateSidebarHighlight(this._sidebarHighlight - 1); break;
          case 'ArrowDown': case 'ChannelDown':
            e.preventDefault(); this._updateSidebarHighlight(this._sidebarHighlight + 1); break;
          case 'Enter': case ' ':
            e.preventDefault(); this._sidebarSelect(); break;
          case 'Escape': case 'Backspace': case 'ArrowRight':
            e.preventDefault(); this._closeSidebar(); break;
        }
        return;
      }

      const overlayVisible = this._refs.playerOverlay.classList.contains('visible');
      const overlayFocused = this._refs.playerOverlay.contains(document.activeElement);
      if (overlayVisible && overlayFocused &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;

      switch (e.key) {
        case 'Escape': case 'Backspace':
          e.preventDefault(); this._goBackFromPlayer(); break;
        case 'ArrowUp': case 'ArrowDown':
          if (this._playerSource === 'livetv') { e.preventDefault(); this._openSidebar(); }
          break;
        case 'ChannelUp': case 'MediaTrackNext':
          e.preventDefault();
          if (this._playerSource === 'livetv') this._playNext();
          break;
        case 'ChannelDown': case 'MediaTrackPrevious':
          e.preventDefault();
          if (this._playerSource === 'livetv') this._playPrev();
          break;
        case 'ArrowLeft': case 'ArrowRight':
          if (!overlayVisible) {
            e.preventDefault(); this._showOverlay();
            const firstBtn = this._refs.playerOverlay.querySelector('.control-btn');
            if (firstBtn) firstBtn.focus();
          }
          break;
        case 'Enter': case ' ':
          if (overlayFocused) return;
          e.preventDefault();
          if (overlayVisible) this._hideOverlay();
          else this._showOverlay();
          break;
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else this._refs.playerScreen.requestFullscreen().catch(() => {}); break;
        case 'c': case 'g':
          e.preventDefault();
          if (this._playerSource === 'livetv') this._openSidebar(); break;
        case 'm': VideoPlayer.toggleMute(); break;
      }
    } else if (active === this._refs.homeScreen || active === this._refs.detailScreen) {
      if (active === this._refs.detailScreen && (e.key === 'Escape' || e.key === 'Backspace')) {
        e.preventDefault(); this._showScreen('home'); return;
      }
      if (active === this._refs.homeScreen && (e.key === 'Escape' || e.key === 'Backspace')) {
        e.preventDefault(); return;
      }
      if (e.key === 'ChannelDown' || e.key === 'ChannelUp') {
        e.preventDefault();
        this._rowNav(e.key === 'ChannelDown' ? 'down' : 'up');
        return;
      }
      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (isArrow) this._spatialNav(e);
    }
  },

  _rowNav(dir) {
    const screen = document.querySelector('.screen.active');
    if (!screen) return;
    const allRows = [...screen.querySelectorAll('.browse-row')];
    if (allRows.length === 0) return;
    const focused = document.activeElement;
    const curRow = focused ? focused.closest('.browse-row') : null;
    const ri = curRow ? allRows.indexOf(curRow) : -1;
    const nextIdx = dir === 'down' ? (ri + 1) : (ri - 1);
    const targetRow = allRows[Math.max(0, Math.min(nextIdx, allRows.length - 1))];
    if (targetRow) {
      const btn = targetRow.querySelector('button');
      if (btn) { btn.focus(); this._scrollCard(btn); }
    }
  },

  _spatialNav(e) {
    const focused = document.activeElement;
    const screen = focused ? focused.closest('.screen') : null;
    if (!screen) return;

    const allRows = [...screen.querySelectorAll('.browse-row, .episodes-list, .season-tabs')];
    if (allRows.length === 0) return;

    const curRow = focused ? focused.closest('.browse-row, .episodes-list, .season-tabs') : null;

    if (!curRow) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const btn = allRows[0] && allRows[0].querySelector('button');
        if (btn) { btn.focus(); this._scrollCard(btn); }
      }
      return;
    }

    const items = [...curRow.querySelectorAll(':scope > button, :scope > .browse-card')];
    const idx = items.indexOf(focused);
    const ri = allRows.indexOf(curRow);

    if (e.key === 'ArrowRight' && idx >= 0 && idx < items.length - 1) {
      e.preventDefault();
      items[idx + 1].focus();
      this._scrollCard(items[idx + 1]);
      return;
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      items[idx - 1].focus();
      this._scrollCard(items[idx - 1]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = ri + 1 < allRows.length ? allRows[ri + 1] : null;
      if (nextRow) {
        const btns = [...nextRow.querySelectorAll(':scope > button, :scope > .browse-card')];
        if (btns.length > 0) {
          const t = btns[Math.min(Math.max(idx, 0), btns.length - 1)];
          t.focus();
          this._scrollCard(t);
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (ri > 0) {
        const prevRow = allRows[ri - 1];
        const btns = [...prevRow.querySelectorAll(':scope > button, :scope > .browse-card')];
        if (btns.length > 0) {
          const t = btns[Math.min(Math.max(idx, 0), btns.length - 1)];
          t.focus();
          this._scrollCard(t);
        }
      }
      return;
    }
  },

  _scrollCard(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    const row = el.closest('.browse-row');
    if (row) row.scrollLeft = Math.max(0, el.offsetLeft - 48);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
