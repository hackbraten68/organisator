/// <reference types="vite/client" />

/** Salesforce API version injected at build time by the Vite define plugin. */
declare const __SF_API_VERSION__: string;

interface ImportMetaEnv {
  /** Agentforce agent id (18 chars) the conversation client embeds. */
  readonly VITE_AGENTFORCE_AGENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
