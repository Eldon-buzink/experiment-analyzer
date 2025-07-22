"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Props = {
  kpi: string;
  controlMean: number;
  variantMean: number;
};

export default function KPIBarChart({ kpi, controlMean, variantMean }: Props) {
  const data = {
    labels: ["Control", "Variant"],
    datasets: [
      {
        label: `${kpi} Mean`,
        data: [controlMean, variantMean],
        backgroundColor: ["#94a3b8", "#0ea5e9"], // slate & sky colors
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `${kpi} – Control vs Variant`,
      },
    },
  };

  return <Bar data={data} options={options} />;
} 