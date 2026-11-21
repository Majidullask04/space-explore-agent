import { planFromQuery } from "./intentRouter"
import type { AgentPlan, AgentToolCall, AgentResult } from "./types"

/**
 * Client-side agent executor.
 *
 * In dev, /api/agent is proxied by Vite to the Express server. In production
 * the same route is expected from the hosting layer. If the network is down or
 * the server is unreachable, we transparently fall back to the local intent
 * router so the app never breaks.
 *
 * The local router is deterministic and key‑free: every tool call below is
 * validated against the known catalog and regime set, so the app remains
 * fully functional offline.
 */
export async function requestAgentPlan(query: string): Promise<AgentPlan> {
  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) throw new Error(`agent ${res.status}`)
    const plan = await res.json()
    if (plan && Array.isArray(plan.steps)) {
      return { steps: plan.steps as AgentToolCall[], narration: plan.narration || "", fallback: !!plan.fallback }
    }
    throw new Error("bad plan")
  } catch {
    return planFromQuery(query)
  }
}

export function isMissionStep(step: AgentToolCall): step is AgentToolCall & { tool: "run_mission_tour" } {
  return step.tool === "run_mission_tour"
}

export function describeResult(r: AgentResult): string {
  if (!r.ok) return `[${r.tool}] failed: ${r.summary}`
  return `[${r.tool}] ${r.summary}`
}