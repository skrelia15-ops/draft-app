export type TrafficLevel = 'CLEAR' | 'MODERATE' | 'HEAVY';

// #region agent log
fetch('http://127.0.0.1:7579/ingest/50ab54ea-04ae-4695-90b6-ffc8b34d4312',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1ed8cb'},body:JSON.stringify({sessionId:'1ed8cb',location:'lib/ride/utils.ts:module',message:'utils module loaded',data:{ok:true},timestamp:Date.now(),hypothesisId:'B',runId:'pre-fix'})}).catch(()=>{});
// #endregion

/** Lower weight = less traffic (better for scenic rides). */
export function trafficWeight(traffic: TrafficLevel): number {
  if (traffic === 'CLEAR') return 0;
  if (traffic === 'MODERATE') return 1;
  return 2;
}
