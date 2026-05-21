"use client";

import type { MonitoringHistoryPoint, MonitoringSnapshot } from "../types";
import {
  formatCompactBytesPerSecond,
  formatCompactNumber,
  formatPercent,
  formatTimestamp
} from "../utils";

type AdminMonitoringSectionProps = {
  isLoading: boolean;
  monitoringHistory: MonitoringHistoryPoint[];
  monitoringSnapshot: MonitoringSnapshot | null;
};

export function AdminMonitoringSection({
  isLoading,
  monitoringHistory,
  monitoringSnapshot
}: AdminMonitoringSectionProps) {
  const system = monitoringSnapshot?.system ?? null;
  const physicalDisks = (monitoringSnapshot?.physical_disks ?? []).slice(0, 8);
  const updatedAt = monitoringSnapshot ? formatTimestamp(monitoringSnapshot.generated_at_ms) : "ожидание";

  return (
    <section className="contentGrid contentGridSingle">
      <section className="panel panelMain panelFlat">
        <div className="panelHeader">
          <div>
            <p className="summaryLabel">Администрирование</p>
            <h2 className="panelTitle">Мониторинг</h2>
            <p className="panelSubtitle">
              Физические диски и host-level I/O метрики вынесены в отдельный admin dashboard.
            </p>
          </div>
          <div className={`statusPill ${isLoading ? "" : "statusDone"}`}>
            {isLoading ? "Syncing" : updatedAt}
          </div>
        </div>

        <section className="summaryGrid summaryGridOverview">
          <article className="summaryCard">
            <p className="summaryLabel">Host throughput</p>
            <p className="summaryValue">
              {formatCompactBytesPerSecond(system?.throughput_bytes_per_sec ?? 0)}
            </p>
            <p className="summaryMeta">Общий поток по физическим устройствам хоста.</p>
          </article>
          <article className="summaryCard">
            <p className="summaryLabel">Host IOPS</p>
            <p className="summaryValue">{formatCompactNumber(system?.total_iops ?? 0)}</p>
            <p className="summaryMeta">Суммарные операции ввода-вывода по системе.</p>
          </article>
          <article className="summaryCard">
            <p className="summaryLabel">Peak busy</p>
            <p className="summaryValue">{formatPercent(system?.peak_busy_percent ?? 0)}</p>
            <p className="summaryMeta">Пиковая загрузка среди физических дисков.</p>
          </article>
          <article className="summaryCard">
            <p className="summaryLabel">Devices</p>
            <p className="summaryValue">{formatCompactNumber(system?.active_device_count ?? 0)}</p>
            <p className="summaryMeta">Количество активных блочных устройств в snapshot.</p>
          </article>
        </section>

        <section className="overviewChartsGrid">
          <AdminTimeSeriesCard
            accentClassName="chartToneAmber"
            history={monitoringHistory}
            label="Physical throughput"
            value={formatCompactBytesPerSecond(system?.throughput_bytes_per_sec ?? 0)}
            valueKey="throughput_bytes_per_sec"
          />
          <AdminTimeSeriesCard
            accentClassName="chartToneCyan"
            history={monitoringHistory}
            label="Physical IOPS"
            value={formatCompactNumber(system?.total_iops ?? 0)}
            valueKey="total_iops"
          />
          <AdminTimeSeriesCard
            accentClassName="chartToneRed"
            history={monitoringHistory}
            label="Physical busy"
            value={formatPercent(system?.peak_busy_percent ?? 0)}
            valueKey="busy_percent"
          />
        </section>

        <section className="inventoryTableShell monitoringTableShell">
          <div className="tableHead monitoringHead">
            <span>Устройство</span>
            <span>Throughput</span>
            <span>IOPS</span>
            <span>Busy</span>
            <span>Inflight</span>
          </div>

          <div className="tableBody">
            {physicalDisks.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isLoading ? "Загружаем physical metrics..." : "Physical диски пока не пришли."}
                </span>
              </div>
            ) : (
              physicalDisks.map((disk) => (
                <article className="tableRow monitoringRow" key={disk.device_name}>
                  <span className="tableService tableServiceDisk">
                    {disk.device_name}
                    <span className="rowMeta">physical block device</span>
                  </span>
                  <span className="tableMessage">{formatCompactBytesPerSecond(disk.throughput_bytes_per_sec)}</span>
                  <span className="tableMessage">{formatCompactNumber(disk.total_iops)}</span>
                  <span className="tableMessage">{formatPercent(disk.busy_percent)}</span>
                  <span className="tableMessage">{formatCompactNumber(disk.inflight_ios)}</span>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </section>
  );
}

function AdminTimeSeriesCard({
  accentClassName,
  history,
  label,
  value,
  valueKey
}: {
  accentClassName: string;
  history: MonitoringHistoryPoint[];
  label: string;
  value: string;
  valueKey: keyof Omit<MonitoringHistoryPoint, "timestamp">;
}) {
  const chartPoints = buildChartPoints(history.map((point) => point[valueKey] as number));

  return (
    <article className={`metricCard metricChartCard ${accentClassName}`}>
      <div className="metricChartHeader">
        <p className="summaryLabel">{label}</p>
        <p className="metricValue">{value}</p>
      </div>
      <div className="sparklineShell">
        <svg viewBox="0 0 320 120" className="sparklineChart" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${accentClassName}-admin-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={chartPoints.areaPath} fill={`url(#${accentClassName}-admin-fill)`} />
          <path d={chartPoints.linePath} className="sparklineStroke" />
        </svg>
      </div>
      <p className="summaryMeta">История физических метрик за последние snapshot-точки.</p>
    </article>
  );
}

function buildChartPoints(values: number[]) {
  if (values.length === 0) {
    return {
      linePath: "M0,96 L320,96",
      areaPath: "M0,120 L0,96 L320,96 L320,120 Z"
    };
  }

  const width = 320;
  const height = 120;
  const maxValue = Math.max(...values, 1);
  const step = values.length === 1 ? width : width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / maxValue) * 88 - 14;
    return `${x},${Number.isFinite(y) ? y : height - 14}`;
  });

  return {
    linePath: `M${points.join(" L")}`,
    areaPath: `M0,120 L${points.join(" L")} L${width},120 Z`
  };
}
