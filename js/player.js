const VideoPlayer = {
  hls: null,
  el: null,
  current: null,
  _retries: 0,
  MAX_RETRIES: 2,
  _sleepTimer: null,

  init(videoElement) {
    this.el = videoElement;
    this.el.addEventListener('error', () => this._emitError('Media error'));
  },

  play(channel) {
    this.current = channel;
    this._retries = 0;
    this._load(channel.url);
    Favorites.setLastWatched(channel);
  },

  _load(url) {
    this.destroy();

    if (url.includes('.m3u8') || url.includes('m3u8')) {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          enableWorker: true
        });
        this.hls.loadSource(url);
        this.hls.attachMedia(this.el);
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.el.play().catch(() => {});
          this._emit('tracks-updated');
        });
        this.hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this._emit('tracks-updated'));
        this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this._emit('tracks-updated'));
        this.hls.on(Hls.Events.LEVEL_SWITCHED, () => this._emit('tracks-updated'));
        this.hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && this._retries < this.MAX_RETRIES) {
              this._retries++;
              setTimeout(() => this.hls && this.hls.startLoad(), 2000);
            } else {
              this._emitError(data.details || 'Stream error');
            }
          }
        });
      } else if (this.el.canPlayType('application/vnd.apple.mpegurl')) {
        this.el.src = url;
        this.el.play().catch(() => {});
        this.el.addEventListener('loadedmetadata', () => this._emit('tracks-updated'), { once: true });
      } else {
        this._emitError('HLS not supported');
      }
    } else {
      this.el.src = url;
      this.el.play().catch(() => {});
      this.el.addEventListener('loadedmetadata', () => this._emit('tracks-updated'), { once: true });
    }
  },

  /* ── Audio tracks ───────────────────── */

  getAudioTracks() {
    if (this.hls) {
      return this.hls.audioTracks.map((t, i) => ({
        index: i,
        label: t.name || t.lang || `Track ${i + 1}`,
        lang: t.lang || '',
        active: i === this.hls.audioTrack
      }));
    }
    const tracks = Array.from(this.el.audioTracks || []);
    return tracks.map((t, i) => ({
      index: i,
      label: t.label || t.language || `Track ${i + 1}`,
      lang: t.language || '',
      active: t.enabled
    }));
  },

  setAudioTrack(index) {
    if (this.hls) {
      this.hls.audioTrack = index;
    } else if (this.el.audioTracks) {
      Array.from(this.el.audioTracks).forEach((t, i) => { t.enabled = i === index; });
    }
    this._emit('tracks-updated');
  },

  /* ── Quality levels ─────────────────── */

  getQualityLevels() {
    if (!this.hls) return [];
    const levels = this.hls.levels.map((l, i) => ({
      index: i,
      height: l.height,
      width: l.width,
      bitrate: l.bitrate,
      label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`,
      active: i === this.hls.currentLevel
    }));
    levels.unshift({ index: -1, label: 'Auto', active: this.hls.currentLevel === -1 });
    return levels;
  },

  setQuality(index) {
    if (!this.hls) return;
    this.hls.currentLevel = index;
    this._emit('tracks-updated');
  },

  /* ── Subtitles ──────────────────────── */

  getSubtitleTracks() {
    if (this.hls) {
      const tracks = this.hls.subtitleTracks.map((t, i) => ({
        index: i,
        label: t.name || t.lang || `Sub ${i + 1}`,
        lang: t.lang || '',
        active: i === this.hls.subtitleTrack
      }));
      tracks.unshift({ index: -1, label: 'Off', active: this.hls.subtitleTrack === -1 });
      return tracks;
    }
    const tracks = Array.from(this.el.textTracks || []);
    return [
      { index: -1, label: 'Off', active: tracks.every(t => t.mode !== 'showing') },
      ...tracks.map((t, i) => ({
        index: i,
        label: t.label || t.language || `Sub ${i + 1}`,
        lang: t.language || '',
        active: t.mode === 'showing'
      }))
    ];
  },

  setSubtitleTrack(index) {
    if (this.hls) {
      this.hls.subtitleTrack = index;
    } else {
      Array.from(this.el.textTracks || []).forEach((t, i) => {
        t.mode = i === index ? 'showing' : 'hidden';
      });
    }
    this._emit('tracks-updated');
  },

  /* ── Playback speed ─────────────────── */

  getSpeed() {
    return this.el.playbackRate;
  },

  setSpeed(rate) {
    this.el.playbackRate = rate;
    this._emit('tracks-updated');
  },

  /* ── Volume ─────────────────────────── */

  getVolume() {
    return this.el.volume;
  },

  setVolume(vol) {
    this.el.volume = Math.max(0, Math.min(1, vol));
    this.el.muted = vol <= 0;
  },

  isMuted() {
    return this.el.muted;
  },

  toggleMute() {
    this.el.muted = !this.el.muted;
    return this.el.muted;
  },

  /* ── Aspect ratio ───────────────────── */

  setAspectRatio(mode) {
    const map = {
      'fit':     'contain',
      'fill':    'cover',
      'stretch': 'fill',
      '16:9':    'contain',
      '4:3':     'contain'
    };
    this.el.style.objectFit = map[mode] || 'contain';

    if (mode === '16:9') {
      this.el.style.aspectRatio = '16/9';
      this.el.style.width = '';
      this.el.style.height = '';
    } else if (mode === '4:3') {
      this.el.style.aspectRatio = '4/3';
      this.el.style.width = '';
      this.el.style.height = '';
    } else {
      this.el.style.aspectRatio = '';
      this.el.style.width = '100%';
      this.el.style.height = '100vh';
    }
  },

  /* ── Picture-in-Picture ─────────────── */

  async togglePiP() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (this.el.requestPictureInPicture) {
        await this.el.requestPictureInPicture();
      }
    } catch { /* PiP not supported */ }
  },

  isPiPSupported() {
    return 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  },

  /* ── Sleep timer ────────────────────── */

  setSleepTimer(minutes) {
    clearTimeout(this._sleepTimer);
    if (minutes <= 0) return;
    this._sleepTimer = setTimeout(() => {
      this.stop();
      this._emit('sleep-triggered');
    }, minutes * 60 * 1000);
  },

  clearSleepTimer() {
    clearTimeout(this._sleepTimer);
  },

  /* ── Lifecycle ──────────────────────── */

  stop() {
    this.clearSleepTimer();
    this.destroy();
    this.current = null;
  },

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.el) {
      this.el.removeAttribute('src');
      this.el.style.objectFit = 'contain';
      this.el.style.aspectRatio = '';
      this.el.style.width = '100%';
      this.el.style.height = '100vh';
      this.el.load();
    }
  },

  _emitError(msg) {
    document.dispatchEvent(new CustomEvent('player-error', { detail: msg }));
  },

  _emit(type) {
    document.dispatchEvent(new CustomEvent(type));
  }
};
