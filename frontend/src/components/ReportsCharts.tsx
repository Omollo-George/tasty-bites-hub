import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Line,
  Legend,
} from 'recharts'

type HourRow = { hour: number; label: string; orders: number; revenue: number }

const ReportsCharts: React.FC<{ hourlyData: HourRow[] }> = ({ hourlyData }) => {
  return (
    <div className="w-full" style={{ minHeight: 320 }}>
      <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
        <ComposedChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#cbd5e1' }} interval={2} minTickGap={10} />
          <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: '#cbd5e1' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#cbd5e1' }} />
          <Tooltip formatter={(value: any) => typeof value === 'number' ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value) : value} />
          <Legend />
          <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#fb923c" radius={[6, 6, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ReportsCharts
