export interface Env {
  STATE: KVNamespace;
  CURSOR_API_KEY: string;
  APP_SECRET: string;
  GITHUB_TOKEN?: string;
  WEBHOOK_SECRET?: string;
}
