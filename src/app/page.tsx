"use client"

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { UploadIcon, Loader } from 'lucide-react'

interface Result {
  controlMedian: number;
  variantMedian: number;
  lift: number;
  pValue: number;
  srmDetected: boolean;
  srmPValue: number;
  controlUsers: number;
  variantUsers: number;
  variantName: string;
}

export default function ExperimentAnalyzer() {
  const [step, setStep] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [fileName, setFileName] = useState<string>('')
  const [primaryKpi, setPrimaryKpi] = useState<string>('')
  const [secondaryKpis, setSecondaryKpis] = useState<string[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [showError, setShowError] = useState<boolean>(false)

  const kpiOptions = ['pageviews', 'article_pageviews', 'plus_article_pageviews', 'sessions', 'session_duration', 'video_starts', 'audio_starts', 'game_starts']

  function handleFileUpload(file: File) {
    setLoading(true)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      // const text = reader.result as string
      // const parsed = text.split('\n').map(line => line.split(','))
      // CSV parsing logic can be added here if needed
      setLoading(false)
      setStep(2)
    }
    reader.readAsText(file)
  }

  function toggleSecondaryKpi(kpi: string) {
    setSecondaryKpis(prev =>
      prev.includes(kpi) ? prev.filter(k => k !== kpi) : [...prev, kpi]
    )
  }

  function handleAnalyze() {
    if (!primaryKpi) {
      setShowError(true)
      return
    }

    // Dummy result; replace with actual logic
    setResult({
      controlMedian: 8,
      variantMedian: 8,
      lift: 0,
      pValue: 0.0020000000000000018,
      srmDetected: false,
      srmPValue: 1,
      controlUsers: 25556,
      variantUsers: 25429,
      variantName: 'swapVideoDossier2',
    })
    setStep(3)
  }

  return (
    <main className="max-w-xl mx-auto mt-10 px-4">
      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Experiment Analyzer</h2>
          <label className="border-dashed border-2 border-gray-300 rounded-md flex flex-col items-center justify-center h-40 cursor-pointer hover:border-primary transition-colors">
            <UploadIcon className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Drag & drop your CSV here, or click to browse</p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </label>
          <Button className="mt-6 w-full" disabled={loading}>
            {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : 'Next'}
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Experiment Analyzer</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="primary-kpi">Primary KPI <span className="text-red-500">*</span></Label>
              <Select onValueChange={(val) => { setPrimaryKpi(val); setShowError(false) }}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select primary KPI" />
                </SelectTrigger>
                <SelectContent>
                  {kpiOptions.map(kpi => (
                    <SelectItem key={kpi} value={kpi}>{kpi}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showError && !primaryKpi && (
                <p className="text-sm text-red-500 mt-1">Primary KPI is required</p>
              )}
            </div>

            <div>
              <Label>Secondary KPIs</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {kpiOptions.map(kpi => (
                  <div key={kpi} className="flex items-center space-x-2">
                    <Checkbox
                      id={kpi}
                      checked={secondaryKpis.includes(kpi)}
                      onCheckedChange={() => toggleSecondaryKpi(kpi)}
                    />
                    <Label htmlFor={kpi} className="text-sm">{kpi}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleAnalyze}>Next</Button>
          </div>
        </Card>
      )}

      {step === 3 && result && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Experiment Analyzer</h2>

          <div className="space-y-1 mb-4">
            <p><strong>Test Name:</strong> {fileName}</p>
            <p><strong>Variants:</strong></p>
            <ul className="list-disc ml-5 text-sm">
              <li>Control: {result.controlUsers} users</li>
              <li>{result.variantName}: {result.variantUsers} users</li>
            </ul>
            <p><strong>Split:</strong> NaN% vs NaN% (expected 50/50)</p>
            <p><strong>SRM Detected:</strong> <Badge variant={result.srmDetected ? 'destructive' : 'default'}>{result.srmDetected ? 'Yes' : 'No'}</Badge> (p = {result.srmPValue})</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium mb-2">Primary KPI: {primaryKpi}
              <Badge className="ml-2" variant="default">Significant</Badge>
            </h3>
            <p className="text-sm text-muted-foreground mb-2">Variant ≤ Control</p>

            <div className="my-4 h-32 bg-gray-100 rounded-md flex items-center justify-center">
              [ Chart Placeholder ]
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <p><strong>Control Median:</strong> {result.controlMedian}</p>
              <p><strong>Variant Median:</strong> {result.variantMedian}</p>
              <p><strong>Estimated Lift:</strong> {result.lift}%</p>
              <p><strong>p-value:</strong> {result.pValue}</p>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => {
              setStep(1)
              setFileName('')
              setResult(null)
            }}>Analyze another file</Button>
          </div>
        </Card>
      )}
    </main>
  )
}
