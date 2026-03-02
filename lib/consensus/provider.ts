export type ConsensusSnapshot = {
  enabled: boolean;
  available: boolean;
  source: string;
  notes?: string;
  forwardRevenueGrowthPct?: number;
  forwardEpsGrowthPct?: number;
};

export interface ConsensusProvider {
  getConsensus(ticker: string): Promise<ConsensusSnapshot>;
}

class DisabledConsensusProvider implements ConsensusProvider {
  async getConsensus(ticker: string): Promise<ConsensusSnapshot> {
    void ticker;
    const enabled = process.env.CONSENSUS_ENABLED === "true";
    if (!enabled) {
      return {
        enabled: false,
        available: false,
        source: "none",
        notes: "CONSENSUS_ENABLED is false",
      };
    }

    return {
      enabled: true,
      available: false,
      source: "none",
      notes: "No consensus provider configured",
    };
  }
}

const provider: ConsensusProvider = new DisabledConsensusProvider();

export async function getConsensusForTicker(ticker: string) {
  return provider.getConsensus(ticker);
}
