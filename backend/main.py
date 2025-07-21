from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    numeric_columns = df.select_dtypes(include="number").columns.tolist()
    return {"kpis": numeric_columns}

@app.post("/analyze")
async def analyze_csv(
    file: UploadFile = File(...),
    primary_kpi: str = Form(...),
    secondary_kpis: str = Form("")
):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))

    def run_bayesian_analysis(df, kpi_column):
        df = df[[kpi_column, 'Vwo Metrics per User Mart Test Variant']].dropna()
        control = df[df['Vwo Metrics per User Mart Test Variant'] == 'Control'][kpi_column]
        variant = df[df['Vwo Metrics per User Mart Test Variant'] != 'Control'][kpi_column]

        control_mean = np.mean(control)
        variant_mean = np.mean(variant)
        control_std = np.std(control)
        variant_std = np.std(variant)
        lift = (variant_mean - control_mean) / control_mean * 100

        samples = 10000
        control_sim = np.random.normal(control_mean, control_std, samples)
        variant_sim = np.random.normal(variant_mean, variant_std, samples)

        prob_variant_better = np.mean(variant_sim > control_sim)
        significant = prob_variant_better > 0.95

        return {
            "control_mean": round(control_mean, 2),
            "variant_mean": round(variant_mean, 2),
            "estimated_lift": f"{lift:.2f}%",
            "prob_variant_better": round(prob_variant_better * 100, 2),
            "significant": bool(significant)
        }

    primary_result = run_bayesian_analysis(df, primary_kpi)
    secondary_results = {}
    for kpi in secondary_kpis.split(","):
        kpi = kpi.strip()
        if kpi and kpi != primary_kpi:
            secondary_results[kpi] = run_bayesian_analysis(df, kpi)

    return {
        "primary_kpi": primary_result,
        "secondary_kpis": secondary_results
    } 