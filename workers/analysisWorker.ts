// workers/analysisWorker.ts
// @ts-nocheck

// Import simple-statistics functions we need
const ss = {
  mean: function(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  },
  median: function(arr) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  },
  wilcoxonRankSum: function(x, y) {
    // Simplified Wilcoxon rank-sum test
    const all = [...x, ...y].map((val, idx) => ({ val, group: idx < x.length ? 'x' : 'y' }));
    all.sort((a, b) => a.val - b.val);
    
    let rankSum = 0;
    for (let i = 0; i < all.length; i++) {
      if (all[i].group === 'x') {
        rankSum += (i + 1);
      }
    }
    return rankSum;
  },
  cumulativeStdNormalProbability: function(z) {
    // Simplified normal CDF approximation
    return 0.5 * (1 + Math.erf(z / Math.sqrt(2)));
  }
};

// Polyfill for Math.erf
Math.erf = function(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
};

self.onmessage = function(e) {
  try {
    const { rows, variantColumn, controlName, variantName, primaryKpi, secondaryKpis, fileName } = e.data;
    
    console.log('Worker: Starting analysis with', rows.length, 'rows');
    
    function analyzeKpi(kpi, isPrimary = false) {
      console.log(`Worker: Analyzing KPI: ${kpi}`);
      
      // Drop rows with missing KPI (keep real 0s)
      const validRows = rows.filter(r => r[kpi] !== undefined && r[kpi] !== null && r[kpi] !== '' && r[variantColumn] !== undefined && r[variantColumn] !== null);
      
      const control = validRows.filter(r => String(r[variantColumn]) === controlName).map(r => Number(r[kpi]));
      const variant = validRows.filter(r => String(r[variantColumn]) !== controlName).map(r => Number(r[kpi]));
      
      // Remove NaNs from both groups (drop NaNs, keep 0s)
      const controlClean = control.filter(v => !Number.isNaN(v));
      const variantClean = variant.filter(v => !Number.isNaN(v));
      
      if (controlClean.length === 0 || variantClean.length === 0) {
        throw new Error(`No valid data found for KPI "${kpi}". Please check if the variant column "${variantColumn}" contains both control and variant values.`);
      }
      
      const controlMean = controlClean.length > 0 ? ss.mean(controlClean) : 0;
      const variantMean = variantClean.length > 0 ? ss.mean(variantClean) : 0;
      const controlMedian = controlClean.length > 0 ? ss.median(controlClean) : 0;
      const variantMedian = variantClean.length > 0 ? ss.median(variantClean) : 0;
      
      // Mean-based percent lift
      const mean_lift = controlMean !== 0 ? ((variantMean - controlMean) / controlMean) * 100 : Infinity;
      const median_lift = controlMedian !== 0 ? ((variantMedian - controlMedian) / controlMedian) * 100 : Infinity;
      
      // Mann-Whitney U and normal approximation for p-value
      let u = 0, pValue = 1, significant = false, variant_better = false;
      
      if (controlClean.length > 0 && variantClean.length > 0) {
        u = ss.wilcoxonRankSum(controlClean, variantClean);
        const n1 = controlClean.length;
        const n2 = variantClean.length;
        const mu = (n1 * n2) / 2;
        const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
        const z = sigma !== 0 ? (u - mu) / sigma : 0;
        pValue = 2 * (1 - ss.cumulativeStdNormalProbability(Math.abs(z)));
        significant = pValue < 0.05;
        variant_better = variantMean > controlMean;
      }
      
      return {
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
          controlZeros: controlClean.filter((v) => v === 0).length,
          variantZeros: variantClean.filter((v) => v === 0).length,
        },
      };
    }
    
    // Analyze primary KPI
    self.postMessage({ type: 'progress', message: `Analyzing primary KPI: ${primaryKpi}`, percent: 10 });
    const primaryResult = analyzeKpi(primaryKpi, true);
    
    // Analyze secondary KPIs with progress updates
    const secondaryResults = {};
    const kpisToAnalyze = secondaryKpis.filter(kpi => kpi && kpi !== primaryKpi);
    
    for (let i = 0; i < kpisToAnalyze.length; i++) {
      const kpi = kpisToAnalyze[i];
      const progress = 10 + ((i + 1) / kpisToAnalyze.length) * 80; // 10-90%
      self.postMessage({ 
        type: 'progress', 
        message: `Analyzing secondary KPI ${i + 1}/${kpisToAnalyze.length}: ${kpi}`, 
        percent: Math.round(progress) 
      });
      secondaryResults[kpi] = analyzeKpi(kpi);
    }
    
    // Calculate impact rows
    self.postMessage({ type: 'progress', message: 'Calculating impact metrics...', percent: 95 });
    
    const impactRows = [];
    const allKpis = [primaryKpi, ...kpisToAnalyze];
    
    for (const kpi of allKpis) {
      const controlRows = rows.filter(r => String(r[variantColumn]) === controlName);
      const variantRows = rows.filter(r => String(r[variantColumn]) !== controlName);
      
      const setA_raw = controlRows.map(r => r[kpi]);
      const setB_raw = variantRows.map(r => r[kpi]);
      const nullsA = setA_raw.filter(v => v === null || v === undefined || v === '').length;
      const nullsB = setB_raw.filter(v => v === null || v === undefined || v === '').length;
      const setA = setA_raw.map(v => Number(v)).map(v => isNaN(v) ? 0 : v);
      const setB = setB_raw.map(v => Number(v)).map(v => isNaN(v) ? 0 : v);
      const zerosA = setA.filter(v => v === 0).length;
      const zerosB = setB.filter(v => v === 0).length;
      
      const setA_no_zeros = setA.filter(v => v !== 0);
      const setB_no_zeros = setB.filter(v => v !== 0);
      
      const controlSum = setA.reduce((sum, v) => sum + v, 0);
      const variantSum = setB.reduce((sum, v) => sum + v, 0);
      const controlTotal = setA.length;
      const variantTotal = setB.length;
      const controlConverted = setA.filter(v => v > 0).length;
      const variantConverted = setB.filter(v => v > 0).length;
      const controlCR = controlTotal ? (controlConverted / controlTotal) * 100 : 0;
      const variantCR = variantTotal ? (variantConverted / variantTotal) * 100 : 0;
      const percentChange = controlCR !== 0 ? ((variantCR - controlCR) / controlCR) * 100 : 0;
      
      const avgA = setA_no_zeros.length ? ss.mean(setA_no_zeros) : 0;
      const avgB = setB_no_zeros.length ? ss.mean(setB_no_zeros) : 0;
      const percentImpact = avgA !== 0 ? ((avgB - avgA) / avgA) * 100 : 0;
      const medA = setA_no_zeros.length ? ss.median(setA_no_zeros) : 0;
      const medB = setB_no_zeros.length ? ss.median(setB_no_zeros) : 0;
      
      let pValue = null;
      let significant = false;
      if (setA_no_zeros.length > 0 && setB_no_zeros.length > 0) {
        pValue = ss.wilcoxonRankSum(setA_no_zeros, setB_no_zeros);
        significant = pValue < 0.1;
      }
      
      impactRows.push({
        kpi,
        controlSum,
        variantSum,
        controlCR,
        variantCR,
        percentChange,
        avgA,
        avgB,
        percentImpact,
        medA,
        medB,
        pValue,
        significant,
      });
    }
    
    // Calculate debug info for primary KPI
    const controlRows = rows.filter(r => String(r[variantColumn]) === controlName);
    const variantRows = rows.filter(r => String(r[variantColumn]) !== controlName);
    const setA_raw = controlRows.map(r => r[primaryKpi]);
    const setB_raw = variantRows.map(r => r[primaryKpi]);
    const nullsA = setA_raw.filter(v => v === null || v === undefined || v === '').length;
    const nullsB = setB_raw.filter(v => v === null || v === undefined || v === '').length;
    const setA = setA_raw.map(v => Number(v)).map(v => isNaN(v) ? 0 : v);
    const setB = setB_raw.map(v => Number(v)).map(v => isNaN(v) ? 0 : v);
    const zerosA = setA.filter(v => v === 0).length;
    const zerosB = setB.filter(v => v === 0).length;
    const debugInfo = { nullsA, zerosA, nullsB, zerosB };
    
    // Calculate results metadata
    const results = {
      meta: {
        control_name: controlName,
        variant_name: variantName,
        control_count: rows.filter(r => String(r[variantColumn]) === controlName).length,
        variant_count: rows.filter(r => String(r[variantColumn]) !== controlName).length,
        test_name: fileName || 'Untitled Test',
        split_control: (() => {
          const controlCount = rows.filter(r => String(r[variantColumn]) === controlName).length;
          const variantCount = rows.filter(r => String(r[variantColumn]) !== controlName).length;
          const total = controlCount + variantCount;
          if (total === 0) return null;
          return Number(((controlCount / total) * 100).toFixed(2));
        })(),
        split_variant: (() => {
          const controlCount = rows.filter(r => String(r[variantColumn]) === controlName).length;
          const variantCount = rows.filter(r => String(r[variantColumn]) !== controlName).length;
          const total = controlCount + variantCount;
          if (total === 0) return null;
          return Number(((variantCount / total) * 100).toFixed(2));
        })(),
        srm_detected: false,
        srm_p_value: 1.0,
        control_size: primaryResult.debug.controlSize,
        variant_size: primaryResult.debug.variantSize,
        control_zeros: primaryResult.debug.controlZeros,
        variant_zeros: primaryResult.debug.variantZeros,
      },
      primary_kpi: primaryResult,
      secondary_kpis: secondaryResults,
    };
    
    self.postMessage({ type: 'progress', message: 'Analysis complete!', percent: 100 });
    self.postMessage({ 
      type: 'done', 
      results, 
      impactRows, 
      debugInfo 
    });
    
  } catch (error) {
    console.error('Worker: Analysis error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Analysis failed' });
  }
};
