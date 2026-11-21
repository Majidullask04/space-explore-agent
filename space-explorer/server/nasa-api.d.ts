import type { IncomingMessage, ServerResponse } from "node:http"

export interface ApiOptions {
  root?: string
  env?: Record<string, string | undefined>
}

export declare function loadEnv(root?: string): Record<string, string | undefined>
export declare function createApiHandler(
  options?: ApiOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
