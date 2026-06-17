export { RideProvider, useRide } from './RideProvider';
export { clearHistory } from './storage';
export {
  computeInsights,
  buildSegments,
  liveWattsSaved,
  summarizeRide,
} from './insights';
export type { RideInsights, RideComparison } from './insights';
export { deriveConditions } from './conditions';
export type { Conditions, CompassDirection } from './conditions';
export { clusterNearbyRiders, getNearbyRiders } from './proximity';
export type { NearbyRider, DraftPotential, RiderCluster } from './proximity';
export { getCompatibility } from './compat';
export type { Compatibility, RidingStyle } from './compat';
export { buildRoutePreview } from './sampleRoutes';
export type { RouteShape } from './sampleRoutes';
export { trafficWeight } from './utils';
export type { TrafficLevel } from './utils';
export { draftPotentialColor, trafficLevelColor } from './statusColor';
export {
  formatDistanceMeters,
  formatHourMin,
  formatKmh,
  formatMmSs,
} from './telemetry';
export type {
  RidePhase,
  RideSample,
  RideSegment,
  RideRecord,
  RideLiveStats,
} from './types';
