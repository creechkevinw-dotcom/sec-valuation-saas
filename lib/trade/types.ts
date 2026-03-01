export type SessionStatus = "PRE" | "OPEN" | "POST" | "CLOSED";

export type MarketSnapshot = {
  ticker: string;
  price: number;
  lastTradePrice: number;
  lastTradeTimestamp: string;
  bid: number;
  ask: number;
  midpoint: number;
  spreadPct: number;
  volume: number;
  sessionStatus: SessionStatus;
  halted: boolean;
  active: boolean;
  stale: boolean;
  source: string;
};

export type TechnicalSnapshot = {
  points: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  atr14: number;
  bbUpper: number;
  bbLower: number;
  volumeTrend: number;
  momentumScore: number;
  lastClose: number;
  lastTimestamp: string;
};

export type EarningsSnapshot = {
  nextEarningsDate: string | null;
  daysUntilEarnings: number | null;
  earningsRisk: boolean;
  sameWeek: boolean;
  source: string;
};

export type OptionContract = {
  symbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  spreadPct: number;
  openInterest: number;
  iv: number | null;
};

export type OptionsSnapshot = {
  contracts: OptionContract[];
  putCallRatio: number | null;
  ivRank: number | null;
  avgSpreadPct: number | null;
  totalOi: number;
  liquid: boolean;
  source: string;
};

export type FundamentalSnapshot = {
  healthScore: number;
  baseFairValue: number | null;
  marketCap: number | null;
  avgDailyDollarVolume: number;
  source: string;
};

export type DeterministicSignal = {
  technicalScore: number;
  fundamentalScore: number;
  momentumScore: number;
  volatilityScore: number;
  liquidityScore: number;
  bias: "long" | "short" | "mixed";
};

export type TradeLeg = {
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  rewardRisk: number;
  thesis: string;
};

export type DeterministicRecommendation = {
  shortTermTrade: TradeLeg | null;
  longTermTrade: TradeLeg | null;
  optionsStrategy: string | null;
  riskFactors: string[];
  confidenceScore: number;
  confidenceAdjustmentMax: number;
};

export type TradeRefusal = {
  refused: true;
  reasonCode:
    | "CONSENT_REQUIRED"
    | "MARKET_HALTED"
    | "DATA_STALE"
    | "LIQUIDITY_LOW"
    | "EARNINGS_RISK_BLOCK"
    | "RISK_REWARD_INVALID"
    | "PROVIDER_ERROR"
    | "INSUFFICIENT_DATA"
    | "RATE_LIMIT";
  reason: string;
  details?: Record<string, unknown>;
};

export type TradeSuccess = {
  refused: false;
  ticker: string;
  marketSnapshot: MarketSnapshot;
  technicalSnapshot: TechnicalSnapshot;
  fundamentalSnapshot: FundamentalSnapshot;
  optionsSnapshot: OptionsSnapshot;
  earningsData: EarningsSnapshot;
  deterministicSignal: DeterministicSignal;
  deterministicRecommendation: DeterministicRecommendation;
  aiExplanation: {
    shortTermTrade: string;
    longTermTrade: string;
    optionsStrategy: string;
    riskFactors: string[];
    confidenceAdjustment: number;
  };
  finalConfidence: number;
  dataTimestamp: string;
  source: string;
};

export type TradeRecommendationResult = TradeRefusal | TradeSuccess;
