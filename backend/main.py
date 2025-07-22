from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
from scipy.stats import mannwhitneyu

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

    def run_mann_whitney_test(df, kpi_column, variant_column='Vwo Metrics per User Mart Test Variant', variant_a='Control', variant_b=None):
        df = df[[kpi_column, variant_column]].copy()
        df[kpi_column] = pd.to_numeric(df[kpi_column], errors='coerce').fillna(0)
        
        if variant_b:
            setA = df[df[variant_column].astype(str) == variant_a][kpi_column]
            setB = df[df[variant_column].astype(str) == variant_b][kpi_column]
        else:
            setA = df[df[variant_column].astype(str) == variant_a][kpi_column]
            setB = df[df[variant_column].astype(str) != variant_a][kpi_column]

        # Log nulls and zeros
        print(f"Set A ({variant_a}) – Zeros: {(setA == 0).sum()}")
        print(f"Set B ({variant_b or 'Variant'}) – Zeros: {(setB == 0).sum()}")

        # Means and medians
        meanA = setA.mean()
        meanB = setB.mean()
        medianA = setA.median()
        medianB = setB.median()

        # Percent lift (based on mean)
        lift = ((meanB - meanA) / meanA) * 100 if meanA != 0 else float('inf')

        # Mann-Whitney U test
        u_stat, p_value = mannwhitneyu(setA, setB, alternative="two-sided")
        significant = p_value < 0.1
        variant_better = medianB > medianA

        return {
            "control_mean": round(meanA, 2),
            "variant_mean": round(meanB, 2),
            "control_median": round(medianA, 2),
            "variant_median": round(medianB, 2),
            "percent_lift": f"{lift:.2f}%",
            "p_value": round(p_value, 4),
            "significant": bool(significant),
            "variant_better": bool(variant_better)
        }

    primary_result = run_mann_whitney_test(df, primary_kpi)
    secondary_results = {}
    for kpi in secondary_kpis.split(","):
        kpi = kpi.strip()
        if kpi and kpi != primary_kpi:
            secondary_results[kpi] = run_mann_whitney_test(df, kpi)

    # Step 1: Sample sizes
    variant_counts = df['Vwo Metrics per User Mart Test Variant'].value_counts().to_dict()
    variants = list(variant_counts.keys())
    control_count = variant_counts.get("Control", 0)
    variant_name = [v for v in variants if v != "Control"]
    variant_name = variant_name[0] if variant_name else "Variant"
    variant_count = variant_counts.get(variant_name, 0)

    total = control_count + variant_count
    expected_ratio = 0.5
    actual_ratio = control_count / total if total > 0 else 0

    # Step 2: SRM check using chi-squared test
    from scipy.stats import chisquare

    expected = [total * expected_ratio, total * (1 - expected_ratio)]
    observed = [control_count, variant_count]

    chi2, p = chisquare(f_obs=observed, f_exp=expected)
    srm_detected = p < 0.05

    meta = {
        "test_name": df["Vwo Metrics per User Mart Test ID"].iloc[0],
        "control_name": "Control",
        "variant_name": variant_name,
        "control_count": int(control_count),
        "variant_count": int(variant_count),
        "actual_split": round(actual_ratio * 100, 2),
        "expected_split": 50.0,
        "srm_detected": bool(srm_detected),
        "srm_p_value": round(float(p), 4)
    }

    return {
        "meta": meta,
        "primary_kpi": primary_result,
        "secondary_kpis": secondary_results
    } 