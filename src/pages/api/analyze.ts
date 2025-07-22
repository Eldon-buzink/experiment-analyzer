import type { NextApiRequest, NextApiResponse } from 'next';
import Papa from 'papaparse';
import ss from 'simple-statistics';

// Use a simple Mann-Whitney U implementation from simple-statistics
function mannWhitneyU(a: number[], b: number[]): number {
  // This is a simplified version for two-sided test
  // Returns the U statistic
  const n1 = a.length;
  const n2 = b.length;
  const all = a.concat(b).sort((x, y) => x - y);
  const ranks = all.map((v, i) => i + 1);
  const rankMap = new Map<number, number[]>();
  all.forEach((v, i) => {
    if (!rankMap.has(v)) rankMap.set(v, []);
    rankMap.get(v)!.push(ranks[i]);
  });
  const getAvgRank = (v: number) => ss.mean(rankMap.get(v)!);
  const rankA = a.map(getAvgRank);
  const rankB = b.map(getAvgRank);
  const sumRankA = ss.sum(rankA);
  const sumRankB = ss.sum(rankB);
  const u1 = sumRankA - (n1 * (n1 + 1)) / 2;
  const u2 = sumRankB - (n2 * (n2 + 1)) / 2;
  return Math.min(u1, u2);
}

interface KpiResult {
  control_mean: number;
  variant_mean: number;
  control_median: number;
  variant_median: number;
  percent_lift: string;
  p_value: number;
  significant: boolean;
  variant_better: boolean;
}

function runMannWhitneyTest(
  rows: Record<string, string | number>[] ,
  kpi: string,
  variantColumn = 'Vwo Metrics per User Mart Test Variant',
  variantA = 'Control',
  variantB?: string
): KpiResult {
  const setA = rows
    .filter(r => String(r[variantColumn]) === variantA)
    .map(r => Number(r[kpi]) || 0);
  const setB = rows
    .filter(r => variantB ? String(r[variantColumn]) === variantB : String(r[variantColumn]) !== variantA)
    .map(r => Number(r[kpi]) || 0);

  // Means and medians
  const meanA = ss.mean(setA);
  const meanB = ss.mean(setB);
  const medianA = ss.median(setA);
  const medianB = ss.median(setB);

  // Percent lift (based on mean)
  const lift = meanA !== 0 ? ((meanB - meanA) / meanA) * 100 : Infinity;

  // Mann-Whitney U test (approximate, two-sided)
  const u = mannWhitneyU(setA, setB);
  // For large samples, approximate p-value using normal distribution
  const n1 = setA.length;
  const n2 = setB.length;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigma !== 0 ? (u - mu) / sigma : 0;
  // Use probit for p-value calculation
  const pValue = 2 * (1 - ss.cumulativeStdNormalProbability(Math.abs(z)));
  const significant = pValue < 0.1;
  const variantBetter = medianB > medianA;

  return {
    control_mean: Number(meanA.toFixed(2)),
    variant_mean: Number(meanB.toFixed(2)),
    control_median: Number(medianA.toFixed(2)),
    variant_median: Number(medianB.toFixed(2)),
    percent_lift: `${lift.toFixed(2)}%`,
    p_value: Number(pValue.toFixed(4)),
    significant,
    variant_better: variantBetter,
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { csv, primary_kpi, secondary_kpis } = req.body;
    if (!csv || !primary_kpi) {
      return res.status(400).json({ error: 'Missing csv or primary_kpi' });
    }
    // Parse CSV
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, string | number>[];

    // Primary KPI
    const primaryResult = runMannWhitneyTest(rows, primary_kpi);
    // Secondary KPIs
    const secondaryResults: Record<string, KpiResult> = {};
    if (secondary_kpis) {
      for (const kpi of String(secondary_kpis).split(',')) {
        const k = kpi.trim();
        if (k && k !== primary_kpi) {
          secondaryResults[k] = runMannWhitneyTest(rows, k);
        }
      }
    }

    // Meta (sample sizes, SRM check, etc.)
    const variantColumn = 'Vwo Metrics per User Mart Test Variant';
    const testName = rows[0]?.['Vwo Metrics per User Mart Test ID'] || '';
    const variantCounts: Record<string, number> = {};
    for (const row of rows) {
      const v = String(row[variantColumn]);
      variantCounts[v] = (variantCounts[v] || 0) + 1;
    }
    const variants = Object.keys(variantCounts);
    const controlCount = variantCounts['Control'] || 0;
    const variantName = variants.find(v => v !== 'Control') || 'Variant';
    const variantCount = variantCounts[variantName] || 0;
    const total = controlCount + variantCount;
    const expectedRatio = 0.5;
    const actualRatio = total > 0 ? controlCount / total : 0;
    const expected = [total * expectedRatio, total * (1 - expectedRatio)];
    const observed = [controlCount, variantCount];
    // Manual chi-squared calculation for SRM
    let chi2 = 0;
    for (let i = 0; i < observed.length; i++) {
      if (expected[i] > 0) {
        chi2 += Math.pow(observed[i] - expected[i], 2) / expected[i];
      }
    }
    // Approximate p-value for 1 degree of freedom
    const p = Math.exp(-0.5 * Number(chi2)); // simple approximation for p-value
    const srmDetected = p < 0.05;
    const meta = {
      test_name: testName,
      control_name: 'Control',
      variant_name: variantName,
      control_count: controlCount,
      variant_count: variantCount,
      actual_split: Number((actualRatio * 100).toFixed(2)),
      expected_split: 50.0,
      srm_detected: srmDetected,
      srm_p_value: Number(p.toFixed(4)),
    };

    return res.status(200).json({
      meta,
      primary_kpi: primaryResult,
      secondary_kpis: secondaryResults,
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
} 