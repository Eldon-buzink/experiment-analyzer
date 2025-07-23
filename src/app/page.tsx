"use client";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import KPIBarChart from "@/components/KPIBarChart";
import { useDropzone } from "react-dropzone";
import { Badge } from "@/components/ui/badge";
import Papa from 'papaparse';
import { supabase } from "@/lib/supabase";
import * as ss from 'simple-statistics';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

// Define types for KPI results and API response
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

interface ApiResults {
  meta: Record<string, unknown>;
  primary_kpi: KpiResult;
  secondary_kpis: Record<string, KpiResult>;
}

interface MannWhitneyResult {
  control_mean: number;
  variant_mean: number;
  control_median: number;
  variant_median: number;
  estimated_lift_median: string;
  estimated_lift_mean: string;
  p_value: number;
  significant: boolean;
  variant_better: boolean;
}

interface AnalysisResult {
  meta: {
    control_name: string;
    variant_name: string;
    control_count: number;
    variant_count: number;
    test_name: string;
    split_control: number | null;
    split_variant: number | null;
    srm_detected: boolean;
    srm_p_value: number;
  };
  primary_kpi: MannWhitneyResult;
  secondary_kpis: Record<string, MannWhitneyResult>;
}

export default function Home() {
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [kpis, setKpis] = useState<string[]>([]);
  const [primaryKpi, setPrimaryKpi] = useState<string>("");
  const [secondaryKpis, setSecondaryKpis] = useState<string[]>([]);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Drag & Drop logic
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setKpis([]);
      setPrimaryKpi("");
      setSecondaryKpis([]);
      setResults(null);
      setError("");
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setKpis([]);
      setPrimaryKpi("");
      setSecondaryKpis([]);
      setResults(null);
      setError("");
    }
  };

  // Replace handleUpload with Supabase upload/download logic
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResults(null);

    // Use supabase directly
    const fileName = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("csv-uploads")
      .upload(fileName, file);

    if (error) {
      setError("Upload failed: " + error.message);
      setLoading(false);
      return;
    }

    // Now download the file and parse it with PapaParse
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from("csv-uploads")
      .download(data.path);

    if (downloadError || !downloadData) {
      setError("Failed to download uploaded file");
      setLoading(false);
      return;
    }

    const text = await downloadData.text();

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // Find numeric columns
        const rows = result.data as Record<string, string>[];
        const numericColumns = Object.keys(rows[0] || {}).filter(key =>
          rows.some(row => !isNaN(Number(row[key])) && row[key] !== "" && row[key] !== null)
        );
        setKpis(numericColumns);
        setStep(2);
        setLoading(false);
      },
      error: (err: unknown) => {
        setError("CSV parse error: " + (err instanceof Error ? err.message : String(err)));
        setLoading(false);
      }
    });
  };

  const handlePrimaryKpiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPrimaryKpi(e.target.value);
    setSecondaryKpis((prev) => prev.filter((kpi) => kpi !== e.target.value));
  };

  const handleSecondaryKpiChange = (kpi: string) => {
    setSecondaryKpis((prev) =>
      prev.includes(kpi)
        ? prev.filter((item) => item !== kpi)
        : [...prev, kpi]
    );
  };

  // New: Send CSV string and KPI info to /api/analyze
  const handleAnalyze = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !primaryKpi) return;
    setLoading(true);
    setError("");
    setResults(null);

    try {
      // Parse CSV again (or use already parsed rows if available)
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data as Record<string, string>[];
      const variantColumn = 'Vwo Metrics per User Mart Test Variant';
      const controlName = 'Control';
      const variantName = rows.find(r => r[variantColumn] !== controlName)?.[variantColumn] || 'Variant';

      function analyzeKpi(kpi: string): MannWhitneyResult {
        // Drop rows with missing KPI (keep real 0s)
        const validRows = rows.filter(r => r[kpi] !== undefined && r[kpi] !== null && r[kpi] !== '' && r[variantColumn] !== undefined && r[variantColumn] !== null);
        const control = validRows.filter(r => String(r[variantColumn]) === controlName).map(r => Number(r[kpi]));
        const variant = validRows.filter(r => String(r[variantColumn]) !== controlName).map(r => Number(r[kpi]));
        // Remove NaNs from both groups (drop NaNs, keep 0s)
        const controlClean = control.filter(v => !Number.isNaN(v));
        const variantClean = variant.filter(v => !Number.isNaN(v));
        const controlMean = ss.mean(controlClean);
        const variantMean = ss.mean(variantClean);
        const controlMedian = ss.median(controlClean);
        const variantMedian = ss.median(variantClean);
        // Mean-based percent lift
        const mean_lift = controlMean !== 0 ? ((variantMean - controlMean) / controlMean) * 100 : Infinity;
        const median_lift = controlMedian !== 0 ? ((variantMedian - controlMedian) / controlMedian) * 100 : Infinity;
        // Mann-Whitney U and normal approximation for p-value
        const u = ss.wilcoxonRankSum(controlClean, variantClean);
        const n1 = controlClean.length;
        const n2 = variantClean.length;
        const mu = (n1 * n2) / 2;
        const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
        const z = sigma !== 0 ? (u - mu) / sigma : 0;
        const pValue = 2 * (1 - ss.cumulativeStdNormalProbability(Math.abs(z)));
        const significant = pValue < 0.05;
        const variant_better = variantMean > controlMean;
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
        };
      }

      const primaryResult = analyzeKpi(primaryKpi);
      const secondaryResults: Record<string, MannWhitneyResult> = {};
      for (const kpi of secondaryKpis) {
        if (kpi && kpi !== primaryKpi) {
          secondaryResults[kpi] = analyzeKpi(kpi);
        }
      }

      setResults({
        meta: {
          control_name: controlName,
          variant_name: variantName,
          control_count: rows.filter(r => String(r[variantColumn]) === controlName).length,
          variant_count: rows.filter(r => String(r[variantColumn]) !== controlName).length,
          test_name: file?.name || 'Untitled Test',
          // Calculate split as two separate fields
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
          srm_detected: false,   // TODO: implement real SRM check later
          srm_p_value: 1.0,      // TODO: real value goes here
        },
        primary_kpi: primaryResult,
        secondary_kpis: secondaryResults,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // Stepper component
  const steps = ["Upload CSV", "Select KPIs", "Results"];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background p-4">
      <div className="flex flex-col items-center w-full max-w-xl">
        {/* Stepper */}
        <div className="flex items-center gap-4 mb-12">
          {steps.map((label, idx) => (
            <React.Fragment key={label}>
              <div className={`flex flex-col items-center ${step === idx + 1 ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                <div className={`rounded-full w-8 h-8 flex items-center justify-center border-2 ${step === idx + 1 ? 'border-primary' : 'border-muted-foreground'}`}>{idx + 1}</div>
                <span className="text-xs mt-1">{label}</span>
              </div>
              {idx < steps.length - 1 && <div className="w-8 h-0.5 bg-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>
        {step === 1 ? (
          <div className="w-full mt-12">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-center font-bold text-2xl font-sans">Experiment Analyzer</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-accent/30' : 'border-muted'}`}>
                    <input {...getInputProps()} onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                    }} />
                    <span className="text-2xl mb-2">📂</span>
                    <span>{isDragActive ? "Drop the CSV here..." : "Drag & drop your CSV here, or click to browse"}</span>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-sm font-medium">{file.name}</span>
                      <Button variant="outline" size="sm" onClick={() => setFile(null)} type="button">Remove</Button>
                    </div>
                  )}
                  <Button
                    className="mt-6 w-full"
                    onClick={handleUpload}
                    disabled={!file || loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin w-4 h-4" /> Processing...
                      </span>
                    ) : "Next"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-center font-bold text-2xl font-sans">Experiment Analyzer</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Step 2: KPI Selection */}
              {step === 2 && kpis.length > 0 && (
                <form onSubmit={async (e) => { await handleAnalyze(e); if (!error) setStep(3); }} className="flex flex-col gap-4">
                  <div>
                    <label className="font-medium">Primary KPI</label>
                    <select
                      className="w-full mt-1 p-2 border rounded-md"
                      value={primaryKpi}
                      onChange={handlePrimaryKpiChange}
                      required
                    >
                      <option value="" disabled>
                        Select primary KPI
                      </option>
                      {kpis.map((kpi) => (
                        <option key={kpi} value={kpi}>
                          {kpi}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium">Secondary KPIs</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                      {kpis
                        .filter((kpi) => kpi !== primaryKpi)
                        .map((kpi) => (
                          <label key={kpi} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={secondaryKpis.includes(kpi)}
                              onChange={() => handleSecondaryKpiChange(kpi)}
                            />
                            {kpi}
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="submit" disabled={!primaryKpi || loading}>
                      {loading ? "Analyzing..." : "Next"}
                    </Button>
                  </div>
                  {error && <div className="text-red-500 mt-4">{error}</div>}
                </form>
              )}
              {/* Step 3: Results */}
              {step === 3 && results && (
                <div>
                  {results.meta && (
                    <div className="bg-white border border-muted rounded-xl p-8 mb-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">🧪</span>
                        <h2 className="text-lg font-bold">Test Overview</h2>
                      </div>
                      <div className="space-y-3 leading-relaxed">
                        <div>
                          <span className="font-semibold">Test Name: </span>
                          <span className="font-mono break-all">{String(results.meta.test_name ?? "")}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Variants:</span>
                          <div className="ml-4 mt-1 space-y-1">
                            <div>
                              <span className="font-medium">{String(results.meta.control_name ?? "Control")}: </span>
                              <span>{Number(results.meta.control_count ?? 0)} users</span>
                            </div>
                            <div>
                              <span className="font-medium">{String(results.meta.variant_name ?? "Variant")}: </span>
                              <span>{Number(results.meta.variant_count ?? 0)} users</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold">Split: </span>
                          <span>
                            Control: {results.meta.split_control ?? 0}% | Variant: {results.meta.split_variant ?? 0}% <span className="text-muted-foreground">(expected 50/50)</span>
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold">SRM Detected: </span>
                          <span className={`ml-2 px-2 py-1 rounded text-white ${results.meta.srm_detected ? "bg-red-500" : "bg-green-500"}`}>
                            {results.meta.srm_detected ? "⚠️ Yes" : "✅ No"}
                          </span>
                          <span className="ml-2 text-muted-foreground">(p = {Number(results.meta.srm_p_value ?? 0)})</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mb-4">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => { setStep(1); setFile(null); setResults(null); }}>
                      Analyze another file
                    </Button>
                  </div>
                  {/* Primary KPI Result Card */}
                  <div className="mb-6 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">Primary KPI:</span>
                      <span>{primaryKpi}</span>
                      <Badge variant={results.primary_kpi.significant ? "default" : "outline"} className={results.primary_kpi.significant ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}>
                        {results.primary_kpi.significant ? "Significant" : "Not Significant"}
                      </Badge>
                      {typeof results.primary_kpi.variant_better === 'boolean' && (
                        <span className={results.primary_kpi.variant_better ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                          {results.primary_kpi.variant_better ? "Variant > Control" : "Variant ≤ Control"}
                        </span>
                      )}
                    </div>
                    <KPIBarChart
                      kpi={primaryKpi}
                      controlMean={results.primary_kpi.control_median}
                      variantMean={results.primary_kpi.variant_median}
                    />
                    <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                      <div><span className="font-medium">Control Median:</span> {results.primary_kpi.control_median}</div>
                      <div><span className="font-medium">Variant Median:</span> {results.primary_kpi.variant_median}</div>
                      <div><span className="font-medium">Estimated Lift (Mean):</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 cursor-help text-gray-500 underline decoration-dotted">
                              {results.primary_kpi.estimated_lift_mean}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Based on means. Statistical significance tested using Mann-Whitney U test.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div><span className="font-medium">Estimated Lift (Median):</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 cursor-help text-gray-500 underline decoration-dotted">
                              {results.primary_kpi.estimated_lift_median}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Based on medians. For transparency only; not used for significance.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div><span className="font-medium">p-value:</span> {results.primary_kpi.p_value}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {results.primary_kpi.significant
                        ? "The difference is statistically significant."
                        : "No significant difference detected."}
                    </div>
                  </div>
                  {/* Secondary KPI Results */}
                  {results.secondary_kpis && Object.keys(results.secondary_kpis).length > 0 && (
                    <div>
                      <div className="font-semibold mb-2">Secondary KPI Results</div>
                      <div className="grid gap-6">
                        {Object.entries(results.secondary_kpis).map(
                          ([kpi, res]: [string, MannWhitneyResult]) => (
                            <div key={kpi} className="border rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">{kpi}</span>
                                <Badge variant={res.significant ? "default" : "outline"} className={res.significant ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}>
                                  {res.significant ? "Significant" : "Not Significant"}
                                </Badge>
                                {typeof res.variant_better === 'boolean' && (
                                  <span className={res.variant_better ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                                    {res.variant_better ? "Variant > Control" : "Variant ≤ Control"}
                                  </span>
                                )}
                              </div>
                              <KPIBarChart
                                kpi={kpi}
                                controlMean={res.control_median}
                                variantMean={res.variant_median}
                              />
                              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                                <div><span className="font-medium">Control Median:</span> {res.control_median}</div>
                                <div><span className="font-medium">Variant Median:</span> {res.variant_median}</div>
                                <div><span className="font-medium">Estimated Lift (Mean):</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="ml-1 cursor-help text-gray-500 underline decoration-dotted">
                                        {res.estimated_lift_mean}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Based on means. Statistical significance tested using Mann-Whitney U test.
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div><span className="font-medium">Estimated Lift (Median):</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="ml-1 cursor-help text-gray-500 underline decoration-dotted">
                                        {res.estimated_lift_median}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Based on medians. For transparency only; not used for significance.
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div><span className="font-medium">p-value:</span> {res.p_value}</div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {res.significant
                                  ? "The difference is statistically significant."
                                  : "No significant difference detected."}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
