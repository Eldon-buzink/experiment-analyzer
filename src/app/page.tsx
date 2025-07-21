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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [kpis, setKpis] = useState<string[]>([]);
  const [primaryKpi, setPrimaryKpi] = useState("");
  const [secondaryKpis, setSecondaryKpis] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>CSV KPI Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <Input type="file" accept=".csv" onChange={handleFileChange} />
            <Button type="submit" disabled={!file || loading}>
              {loading ? "Uploading..." : "Upload CSV"}
            </Button>
          </form>
          {kpis.length > 0 && (
            <form onSubmit={handleAnalyze} className="flex flex-col gap-4 mt-6">
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
              <Button type="submit" disabled={!primaryKpi || loading}>
                {loading ? "Analyzing..." : "Run Analysis"}
              </Button>
            </form>
          )}
          {error && <div className="text-red-500 mt-4">{error}</div>}
        </CardContent>
        {results && (
          <CardFooter className="flex flex-col items-start gap-4">
            <div>
              <div className="font-semibold">Primary KPI Result</div>
              <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
                {JSON.stringify(results.primary_kpi, null, 2)}
              </pre>
            </div>
            {results.secondary_kpis && Object.keys(results.secondary_kpis).length > 0 && (
              <div>
                <div className="font-semibold">Secondary KPI Results</div>
                <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
                  {JSON.stringify(results.secondary_kpis, null, 2)}
                </pre>
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
