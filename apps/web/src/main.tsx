import '@daiq/ui/styles.css';
import { createDaiqClient } from '@daiq/data';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { ConfigErrorScreen } from './components/config-error';
import { loadLocale } from './i18n';
import { loadRuntimeConfig } from './lib/config';
import { logger } from './lib/logger';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

const localeLoaded = loadLocale();
Promise.all([loadRuntimeConfig(), localeLoaded])
  .then(([config]) =>
    root.render(
      <StrictMode>
        <App client={createDaiqClient(config)} config={config} />
      </StrictMode>,
    ),
  )
  .catch(async (error: unknown) => {
    logger.error('config.invalid', error);
    // The config can fail before the language arrives; explain in the person's language.
    await localeLoaded.catch(() => undefined);
    root.render(<ConfigErrorScreen error={error} />);
  });
