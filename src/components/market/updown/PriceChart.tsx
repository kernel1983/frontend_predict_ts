import { useEffect, useRef } from 'react'
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

import { ascOrderedPoints, type PricePoint } from '@/lib/priceCurve'

export type { PricePoint }

export function PriceChart({
  points,
  target,
}: {
  points: PricePoint[]
  target: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return
    const chart = createChart(containerRef.current, {
      width: containerRef.current.offsetWidth || 600,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.05)' },
        horzLines: { color: 'rgba(0,0,0,0.05)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const d = new Date(Number(time) * 1000)
          return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.08)',
      },
    })
    const series = chart.addLineSeries({
      color: '#2563eb',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: '#2563eb',
    })
    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.offsetWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      priceLineRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    series.setData(
      ascOrderedPoints(points).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    )
    chartRef.current?.timeScale().scrollToRealTime()
  }, [points])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current)
      priceLineRef.current = null
    }
    if (target !== null) {
      priceLineRef.current = series.createPriceLine({
        price: target,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Target',
      })
    }
  }, [target])

  return <div ref={containerRef} className="h-[220px] w-full" />
}