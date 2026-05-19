declare namespace NodeJS {
  export interface ProcessEnv {
    BASE_URL: string;
    LOGGER_ENDPOINT?: string;
    LOGGER_PROJECT_KEY?: string;
    NODE_ENV?: string;
  }
}