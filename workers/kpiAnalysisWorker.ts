// workers/kpiAnalysisWorker.ts
// @ts-nocheck

// This worker will be dynamically created with simple-statistics loaded from CDN

self.onmessage = (e) => {
  const { data, kpis, primaryKpi, variantColumn, controlName } = e.data;

  function analyzeKpi(kpi: string) {
    const validRows = data.filter(r =>
      r[kpi] !== undefined && r[kpi] !== null && r[kpi] !== '' &&
      r[variantColumn] !== undefined && r[variantColumn] !== null
    );

    const control = validRows.filter(r => String(r[variantColumn]) === controlName).map(r => Number(r[kpi]));
    const variant = validRows.filter(r => String(r[variantColumn]) !== controlName).map(r => Number(r[kpi]));

    const controlClean = control.filter(v => !Number.isNaN(v));
    const variantClean = variant.filter(v => !Number.isNaN(v));

    const controlZeros = controlClean.filter(v => v === 0).length;
    const variantZeros = variantClean.filter(v => v === 0).length;

    const controlNoZeros = controlClean.filter(v => v !== 0);
    const variantNoZeros = variantClean.filter(v => v !== 0);

    const controlMean = ss.mean(controlClean);
    const variantMean = ss.mean(variantClean);
    const controlMedian = ss.median(controlClean);
    const variantMedian = ss.median(variantClean);

    const mean_lift = controlMean !== 0 ? ((variantMean - controlMean) / controlMean) * 100 : Infinity;
    const median_lift = controlMedian !== 0 ? ((variantMedian - controlMedian) / controlMedian) * 100 : Infinity;

    const u = ss.wilcoxonRankSum(controlClean, variantClean);
    const n1 = controlClean.length;
    const n2 = variantClean.length;
    const mu = (n1 * n2) / 2;
    const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const z = sigma !== 0 ? (u - mu) / sigma : 0;
    const pValue = 2 * (1 - ss.cumulativeStdNormalProbability(Math.abs(z)));
    const significant = pValue < 0.05;
    const variant_better = variantMean > controlMean;

    const result = {
      kpi,
      control_mean: Number(controlMean.toFixed(2)),
      variant_mean: Number(variantMean.toFixed(2)),
      control_median: Number(controlMedian.toFixed(2)),
      variant_median: Number(variantMedian.toFixed(2)),
      estimated_lift_mean: `${mean_lift === Infinity ? '∞' : mean_lift.toFixed(2)}%`,
      estimated_lift_median: `${median_lift === Infinity ? '∞' : median_lift.toFixed(2)}%`,
      p_value: Number(pValue.toFixed(6)),
      significant,
      variant_better,
      debug: {
        controlSize: controlClean.length,
        variantSize: variantClean.length,
        controlZeros,
        variantZeros
      }
    };

    return result;
  }

  const primary = analyzeKpi(primaryKpi);
  const secondary = kpis
    .filter(k => k !== primaryKpi)
    .map(kpi => [kpi, analyzeKpi(kpi)]);

  self.postMessage({
    type: "done",
    primary,
    secondary,
  });
};
