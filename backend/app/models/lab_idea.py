from typing import Dict, List, Optional, Union

from pydantic import BaseModel


class RangeFilter(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class PriceLiquidityFilters(BaseModel):
    price: RangeFilter
    averageDailyDollarVolume: Optional[RangeFilter] = None
    averageDailyShareVolume: Optional[RangeFilter] = None
    floatShares: Optional[RangeFilter] = None
    marketCap: Optional[RangeFilter] = None


class VolatilityFilters(BaseModel):
    regime: str  # "quiet", "expanding", etc.
    atrPercent: Optional[RangeFilter] = None
    hvPercent: Optional[RangeFilter] = None


class StructureFilters(BaseModel):
    shortInterestPercentFloat: Optional[RangeFilter] = None
    daysToCover: Optional[RangeFilter] = None
    vanishingFloatScore: Optional[RangeFilter] = None


class IndicatorRef(BaseModel):
    id: str
    enabled: bool
    variant: Optional[str] = None
    params: Optional[Dict[str, Union[str, float, int, bool]]] = None


class IndicatorConfig(BaseModel):
    indicators: List[IndicatorRef]


class IdeaMeta(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: str  # "draft", "active", "retired"
    family: Optional[str] = None
    tags: Optional[List[str]] = None


class LabIdea(BaseModel):
    meta: IdeaMeta
    priceLiquidity: PriceLiquidityFilters
    volatility: VolatilityFilters
    structure: StructureFilters
    indicators: IndicatorConfig
