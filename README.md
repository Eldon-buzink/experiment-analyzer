# Experiment Results Analyzer

A web-based tool for analyzing A/B test results from CSV files. This tool performs statistical analysis using Mann-Whitney U tests to compare control and variant groups.

## Features

- **Client-side CSV parsing** - No file upload limits, processes files directly in the browser
- **Progress indicators** - Shows parsing progress for large files
- **Statistical analysis** - Mann-Whitney U tests with p-values and significance testing
- **Multiple KPI support** - Analyze primary and secondary metrics
- **Sample Ratio Mismatch (SRM) detection** - Identifies potential issues with test allocation
- **Interactive charts** - Visual representation of results

## How it works

1. **File Upload**: Drag and drop your CSV file or click to browse
2. **KPI Selection**: Choose your primary KPI and optional secondary KPIs
3. **Analysis**: The tool automatically analyzes your data and presents results

## File Requirements

- **Format**: CSV files only
- **Required Columns**: 
  - `Vwo Metrics per User Mart Test Variant` - Contains "Control" and variant names
  - `Vwo Metrics per User Mart Test ID` - Test identifier
- **Data**: Numeric KPI columns for analysis

## Large File Support

This tool is designed to handle large files that exceed typical upload limits:

- **Client-side processing**: Files are parsed directly in your browser
- **Progress tracking**: Shows parsing progress for files over 10MB
- **Memory efficient**: Uses streaming parsing for optimal performance
- **No server storage**: Your data never leaves your device

## Technical Details

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **CSV Parsing**: PapaParse for efficient client-side parsing
- **Statistics**: Simple-statistics library for Mann-Whitney U tests
- **Charts**: Chart.js for data visualization

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Prepare your CSV file with the required columns
2. Upload the file using drag & drop or file browser
3. Select your primary KPI from the dropdown
4. Optionally select secondary KPIs for additional analysis
5. Review the results including:
   - Test overview and sample sizes
   - Statistical significance and p-values
   - Percent lift calculations
   - Sample ratio mismatch detection

## Privacy

Your data is processed entirely in your browser and never uploaded to any server. This ensures complete privacy and eliminates concerns about data storage or transfer limits.
