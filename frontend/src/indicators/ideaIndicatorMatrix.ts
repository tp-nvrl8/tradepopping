// src/indicators/ideaIndicatorMatrix.ts

import type { LabIdea, IndicatorInstance } from "../lab/types";
import type {
  PriceBar,
  IndicatorRuntimeContext,
  IndicatorResult,
} from "./indicatorRuntime";
import { computeIndicatorSeries } from "./indicatorRuntime";
import {
  INDICATOR_CATALOG,
  type IndicatorDefinition,
} from "../lab/indicatorCatalog";

/**
 * One row in the "idea indicator matrix":
 * - which instance (id, params, enabled)
 * - optional catalog definition (name, category, descriptions)
 * - computed numeric / score / regime series
 */
export interface IdeaIndicatorInstanceResult {
  index: number; // position in idea.indicators.indicators
  instance: IndicatorInstance;
  definition?: IndicatorDefinition;
  result: IndicatorResult;
}

/**
 * Full multi-indicator view for a single idea on a single symbol/timeframe.
 */
export interface IdeaIndicatorMatrix {
  ideaId: string;
  ideaName: string;
  symbol: string;
  timeframe: string;
  bars: PriceBar[];
  rows: IdeaIndicatorInstanceResult[];
}

/** Look up catalog definition by id. */
function getDefinitionForInstance(
  inst: IndicatorInstance
): IndicatorDefinition | undefined {
  return INDICATOR_CATALOG.find((d) => d.id === inst.id);
}

/**
 * Compute all indicators for the given idea over the provided bars.
 *
 * This is the main "engine" you can reuse:
 * - in the Lab bottom panel
 * - in the Test Stand
 * - in Candidates Scanner
 */
export function computeIdeaIndicatorMatrix(
  idea: LabIdea,
  bars: PriceBar[],
  ctx: IndicatorRuntimeContext
): IdeaIndicatorMatrix {
  const list: IndicatorInstance[] =
    idea.indicators?.indicators ?? [];

  const rows: IdeaIndicatorInstanceResult[] = list.map(
    (inst, index) => {
      const definition = getDefinitionForInstance(inst);

      // You *can* skip disabled here if you want:
      // if (!inst.enabled) {
      //   return {
      //     index,
      //     instance: inst,
      //     definition,
      //     result: {
      //       outputType: definition?.outputType ?? "numeric",
      //       values: bars.map(() => null),
      //       meta: { reason: "disabled" },
      //     },
      //   };
      // }

      const result = computeIndicatorSeries(inst, bars, ctx);

      return {
        index,
        instance: inst,
        definition,
        result,
      };
    }
  );

  return {
    ideaId: idea.meta.id,
    ideaName: idea.meta.name,
    symbol: ctx.symbol,
    timeframe: ctx.timeframe,
    bars,
    rows,
  };
}