import React, { useEffect, useRef } from 'react';
import * as LightweightCharts from 'lightweight-charts';

interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartProps {
  data: KLineData[];
  loading: boolean;
}

export const CandlestickChart: React.FC<ChartProps> = ({ data, loading }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<LightweightCharts.IChartApi | null>(null);
  const seriesRef = useRef<LightweightCharts.ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !tooltipRef.current) return;

    const chart = LightweightCharts.createChart(chartContainerRef.current, {
      layout: {
        background: { type: LightweightCharts.ColorType.Solid, color: '#181a20' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2f36' },
        horzLines: { color: '#2b2f36' },
      },
      width: chartContainerRef.current.clientWidth || 200,
      height: chartContainerRef.current.clientHeight || 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: '#2ebd85',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#2ebd85',
      wickDownColor: '#f6465d',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Tooltip logic
    const toolTip = tooltipRef.current;
    chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > (chartContainerRef.current?.clientWidth || 0) ||
        param.point.y < 0 ||
        param.point.y > 400
      ) {
        toolTip.style.display = 'none';
      } else {
        toolTip.style.display = 'block';
        const seriesData = param.seriesData.get(candlestickSeries) as any;
        if (seriesData) {
          const dateStr = new Date((param.time as number) * 1000).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
          toolTip.innerHTML = `
            <div style="color: #f3ba2f; font-weight: bold; margin-bottom: 4px;">${dateStr}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
              <div>开: <span style="color: #fff">${seriesData.open.toFixed(2)}</span></div>
              <div>高: <span style="color: #fff">${seriesData.high.toFixed(2)}</span></div>
              <div>低: <span style="color: #fff">${seriesData.low.toFixed(2)}</span></div>
              <div>收: <span style="color: #fff">${seriesData.close.toFixed(2)}</span></div>
            </div>
          `;

          let left = param.point.x + 20;
          if (left > (chartContainerRef.current?.clientWidth || 0) - 160) {
            left = param.point.x - 170;
          }

          let top = param.point.y + 20;
          if (top > 300) {
            top = param.point.y - 100;
          }

          toolTip.style.left = left + 'px';
          toolTip.style.top = top + 'px';
        }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight 
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data as any);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      <div 
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          padding: '12px',
          boxSizing: 'border-box',
          fontSize: '12px',
          textAlign: 'left',
          zIndex: 1000,
          top: '12px',
          left: '12px',
          pointerEvents: 'none',
          border: '1px solid #474d57',
          borderRadius: '8px',
          backgroundColor: 'rgba(30, 35, 41, 0.9)',
          color: '#eaecef',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          minWidth: '160px'
        }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#181a20]/50 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
