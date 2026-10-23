const env = process.env;

export const config = {
  mode: (env.TABILENS_MODE || 'mock').toLowerCase(),
  port: Number(env.PORT || 8787),
  redpine: {
    url: env.REDPINE_MCP_URL || '',
    apiKey: env.REDPINE_API_KEY || '',
    maxAutoConfirmUsd: Number(env.MAX_AUTO_CONFIRM_USD || 0.5),
  },
  tools: {
    magazineSearch: env.REDPINE_MAGAZINE_SEARCH_TOOL || 'search-addix-magazines',
    audioSearch: env.REDPINE_AUDIO_SEARCH_TOOL || 'search-chronicle-news-connect',
    findStop: env.TOBU_FIND_STOP_TOOL || 'tobu--find_stop',
    railDepartures: env.TOBU_RAIL_DEPARTURES_TOOL || 'tobu--rail_departures',
    busLinks: env.TOBU_STATION_BUS_LINKS_TOOL || 'tobu--station_bus_links',
  },
};

export const isLive = () => config.mode === 'live';
