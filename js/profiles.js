const IPTV_BASE = 'https://iptv-org.github.io/iptv';

const LIVETV_SECTIONS = [
  { label: 'Tamil Channels',   url: `${IPTV_BASE}/languages/tam.m3u`,           category: 'Tamil' },
  { label: 'Sri Lankan',       url: `${IPTV_BASE}/countries/lk.m3u`,            category: 'Sri Lankan' },
  { label: 'Indian',           url: `${IPTV_BASE}/countries/in.m3u`,            category: 'Indian' },
  { label: 'Kids & Cartoons',  url: `${IPTV_BASE}/categories/kids.m3u`,         category: 'Kids' },
  { label: 'Movies',           url: `${IPTV_BASE}/categories/movies.m3u`,       category: 'Movies' },
  { label: 'Documentary',      url: `${IPTV_BASE}/categories/documentary.m3u`,  category: 'Documentary' },
  { label: 'News',             url: `${IPTV_BASE}/categories/news.m3u`,         category: 'News' },
  { label: 'Sports',           url: `${IPTV_BASE}/categories/sports.m3u`,       category: 'Sports' },
  { label: 'Entertainment',    url: `${IPTV_BASE}/categories/entertainment.m3u`, category: 'Entertainment' },
];
