import { LoggerHelper } from './logger';
import { RELEASE } from '../version';

class LoggerSingleton {
    private static instance: LoggerHelper;

    public static getInstance(): LoggerHelper {
        if (!LoggerSingleton.instance) {
            LoggerSingleton.instance = new LoggerHelper({
                endpoint: process.env['LOGGER_ENDPOINT'] || 'https://your-domain.com',
                projectKey: process.env['LOGGER_PROJECT_KEY'] ?? '',
                environment: process.env['NODE_ENV'],
                release: RELEASE,
                serverName: 'api-server-1',
            });
        }

        return LoggerSingleton.instance;
    }
}

export const Logger = LoggerSingleton.getInstance();
export { LoggerHelper } from './logger';
