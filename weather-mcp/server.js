import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const WEATHER_BASE_URL = 'https://wttr.in';
const USER_AGENT = 'ama-rag-weather-mcp/1.0';

const server = new McpServer({
  name: 'weatherReport',
  version: '1.0.0'
});

function buildWeatherUrl(location) {
  const encodedLocation = encodeURIComponent(location.trim());
  return `${WEATHER_BASE_URL}/${encodedLocation}?format=j1`;
}

async function fetchWeather(location) {
  const response = await fetch(buildWeatherUrl(location), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }

  return response.json();
}

function formatCurrentConditions(location, payload) {
  const current = payload.current_condition?.[0];

  if (!current) {
    return `No current weather data is available for ${location}.`;
  }

  const description = current.weatherDesc?.[0]?.value ?? 'Unknown';
  const feelsLike = current.FeelsLikeC ? `${current.FeelsLikeC} C` : 'Unknown';
  const temperature = current.temp_C ? `${current.temp_C} C` : 'Unknown';
  const humidity = current.humidity ? `${current.humidity}%` : 'Unknown';
  const wind = current.windspeedKmph
    ? `${current.windspeedKmph} km/h ${current.winddir16Point ?? ''}`.trim()
    : 'Unknown';
  const observationTime = current.localObsDateTime ?? current.observation_time ?? 'Unknown';

  return [
    `Current weather for ${location}:`,
    `Condition: ${description}`,
    `Temperature: ${temperature}`,
    `Feels like: ${feelsLike}`,
    `Humidity: ${humidity}`,
    `Wind: ${wind}`,
    `Observed at: ${observationTime}`
  ].join('\n');
}

function formatForecast(location, payload, days) {
  const forecastDays = Array.isArray(payload.weather) ? payload.weather.slice(0, days) : [];

  if (forecastDays.length === 0) {
    return `No forecast data is available for ${location}.`;
  }

  const sections = forecastDays.map((day) => {
    const hourly = Array.isArray(day.hourly) && day.hourly.length > 0 ? day.hourly[4] ?? day.hourly[0] : undefined;
    const summary = hourly?.weatherDesc?.[0]?.value ?? 'No summary';
    const wind = hourly?.windspeedKmph
      ? `${hourly.windspeedKmph} km/h ${hourly.winddir16Point ?? ''}`.trim()
      : 'Unknown';

    return [
      `${day.date}:`,
      `High: ${day.maxtempC ?? 'Unknown'} C`,
      `Low: ${day.mintempC ?? 'Unknown'} C`,
      `Condition: ${summary}`,
      `Chance of rain: ${hourly?.chanceofrain ?? 'Unknown'}%`,
      `Wind: ${wind}`
    ].join('\n');
  });

  return [`Forecast for ${location}:`, ...sections].join('\n---\n');
}

server.registerTool(
  'get_current_weather',
  {
    title: 'Get Current Weather',
    description: 'Get the latest current weather report for a city or place name.',
    inputSchema: z.object({
      location: z.string().min(2).describe('City, region, or country name, for example London or New York')
    })
  },
  async ({ location }) => {
    try {
      const payload = await fetchWeather(location);
      return {
        content: [
          {
            type: 'text',
            text: formatCurrentConditions(location, payload)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Unable to fetch current weather for ${location}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }
);

server.registerTool(
  'get_weather_forecast',
  {
    title: 'Get Weather Forecast',
    description: 'Get a short weather forecast for a city or place name.',
    inputSchema: z.object({
      location: z.string().min(2).describe('City, region, or country name, for example Delhi or Seattle'),
      days: z.number().int().min(1).max(3).default(3).describe('Number of forecast days to include, between 1 and 3')
    })
  },
  async ({ location, days }) => {
    try {
      const payload = await fetchWeather(location);
      return {
        content: [
          {
            type: 'text',
            text: formatForecast(location, payload, days)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Unable to fetch forecast for ${location}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Weather MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});