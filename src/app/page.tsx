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

export default function Home() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [kpis, setKpis] = useState<string[]>([]);
  const [primaryKpi, setPrimaryKpi] = useState("");
  const [secondaryKpis, setSecondaryKpis] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResults(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      const data = await res.json();
      setKpis(data.kpis);
    } catch (err: any) {
      setError(err.message || "Upload failed");
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

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !primaryKpi) return;
    setLoading(true);
    setError("");
    setResults(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("primary_kpi", primaryKpi);
    formData.append("secondary_kpis", secondaryKpis.join(","));
    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to analyze data");
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
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
        <div className="flex items-center gap-4 mb-8">
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
        <div className="h-32 bg-transparent" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center font-bold text-2xl font-sans">Experiment Analyzer</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step 1: File Upload */}
            {step === 1 && (
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
            )}
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
                  </div>
                  <KPIBarChart
                    kpi={primaryKpi}
                    controlMean={results.primary_kpi.control_mean}
                    variantMean={results.primary_kpi.variant_mean}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                    <div><span className="font-medium">Control Mean:</span> {results.primary_kpi.control_mean}</div>
                    <div><span className="font-medium">Variant Mean:</span> {results.primary_kpi.variant_mean}</div>
                    <div><span className="font-medium">Estimated Lift:</span> {results.primary_kpi.estimated_lift}</div>
                    <div><span className="font-medium">Prob. Variant Better:</span> {results.primary_kpi.prob_variant_better}%</div>
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
                        ([kpi, res]: [string, any]) => (
                          <div key={kpi} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{kpi}</span>
                              <Badge variant={res.significant ? "default" : "outline"} className={res.significant ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}>
                                {res.significant ? "Significant" : "Not Significant"}
                              </Badge>
                            </div>
                            <KPIBarChart
                              kpi={kpi}
                              controlMean={res.control_mean}
                              variantMean={res.variant_mean}
                            />
                            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                              <div><span className="font-medium">Control Mean:</span> {res.control_mean}</div>
                              <div><span className="font-medium">Variant Mean:</span> {res.variant_mean}</div>
                              <div><span className="font-medium">Estimated Lift:</span> {res.estimated_lift}</div>
                              <div><span className="font-medium">Prob. Variant Better:</span> {res.prob_variant_better}%</div>
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
      </div>
    </div>
  );
}
