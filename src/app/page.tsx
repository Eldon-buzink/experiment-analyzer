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

export default function Home() {
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [kpis, setKpis] = useState<string[]>([]);
  const [primaryKpi, setPrimaryKpi] = useState<string>("");
  const [secondaryKpis, setSecondaryKpis] = useState<string[]>([]);
  const [results, setResults] = useState<ApiResults | null>(null);
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

  // New: Read CSV and extract headers (numeric columns)
  const handleUpload = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data as Record<string, string>[];
      // Find numeric columns
      const numericColumns = Object.keys(rows[0] || {}).filter(key =>
        rows.some(row => !isNaN(Number(row[key])) && row[key] !== "" && row[key] !== null)
      );
      setKpis(numericColumns);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
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
      const csv = await file.text();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv,
          primary_kpi: primaryKpi,
          secondary_kpis: secondaryKpis.join(","),
        }),
      });
      if (!res.ok) throw new Error("Failed to analyze data");
      const data: ApiResults = await res.json();
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
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
                    <input {...getInputProps()} />
                    <span className="text-2xl mb-2">📂</span>
                    <span>{isDragActive ? "Drop the CSV here..." : "Drag & drop your CSV here, or click to browse"}</span>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-sm font-medium">{file.name}</span>
                      <Button variant="outline" size="sm" onClick={() => setFile(null)} type="button">Remove</Button>
                    </div>
                  )}
                  <Button className="mt-6 w-full" onClick={async (e) => { await handleUpload(e); if (!error && file) setStep(2); }} disabled={!file || loading}>
                    {loading ? "Uploading..." : "Next"}
                  </Button>
                  {error && <div className="text-red-500 mt-4">{error}</div>}
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
                    <div className="flex flex-wrap gap-2 mt-1">
                      {kpis
                        .filter((kpi) => kpi !== primaryKpi)
                        .map((kpi) => (
                          <label key={kpi} className="flex items-center gap-1">
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
                            {Number(results.meta.actual_split ?? 0)}% vs {100 - Number(results.meta.actual_split ?? 0)}%{" "}
                            <span className="text-muted-foreground">(expected 50/50)</span>
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
                      <div><span className="font-medium">Estimated Lift:</span> {results.primary_kpi.percent_lift}</div>
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
                          ([kpi, res]: [string, KpiResult]) => (
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
                                <div><span className="font-medium">Estimated Lift:</span> {res.percent_lift}</div>
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
