"use client";

import type {
  MonitoringHistoryPoint,
  MonitoringSnapshot
} from "../types";
import {
  formatCompactBytesPerSecond,
  formatCompactNumber,
  formatPercent,
  formatTimestamp
} from "../utils";

type OverviewSectionProps = {
  activeDisks: number;
  displayName: string;
  isAdmin: boolean;
  isLoading: boolean;
  monitoringHistory: MonitoringHistoryPoint[];
  monitoringSnapshot: MonitoringSnapshot | null;
  totalDiskSize: number;
  userMeta: string;
  onOpenDisks: () => void;
};

export function OverviewSection({
  activeDisks,
  displayName,
  isAdmin,
  isLoading,
  monitoringHistory,
  monitoringSnapshot,
  totalDiskSize,
  userMeta,
  onOpenDisks
}: OverviewSectionProps) {
  const system = monitoringSnapshot?.system ?? null;
  const topUsers = (monitoringSnapshot?.users ?? []).slice(0, 4);
  const topLogicalDisks = (monitoringSnapshot?.logical_disks ?? []).slice(0, 4);
  const currentUserAggregate =
    monitoringSnapshot?.users.find((user) => user.owner_display === displayName) ??
    monitoringSnapshot?.users[0] ??
    null;
  const systemUpdatedAt = monitoringSnapshot ? formatTimestamp(monitoringSnapshot.generated_at_ms) : "ожидание";
  const sideRankingItems = topLogicalDisks.map((item) => ({
    id: item.disk_id,
    label: item.name,
    meta: `${formatCompactNumber(item.size_gb)} GB`,
    value: formatCompactBytesPerSecond(item.throughput_bytes_per_sec)
  }));
  const boardItems = isAdmin
    ? topUsers.map((item) => ({
        id: item.owner_sub,
        label: item.owner_display,
        value: formatCompactBytesPerSecond(item.throughput_bytes_per_sec),
        subValue: `${formatCompactNumber(item.disk_count)} disks`,
        ratio: Math.max(6, Math.min(100, item.busy_percent))
      }))
    : topLogicalDisks.map((item) => ({
        id: item.disk_id,
        label: item.name,
        value: formatCompactBytesPerSecond(item.throughput_bytes_per_sec),
        subValue: `${formatPercent(item.busy_percent)} busy`,
        ratio: Math.max(6, Math.min(100, item.busy_percent))
      }));

  return (
    <section className="overviewStack">
      <section className="panel panelMain overviewPanel overviewPanelSystem">
        <div className="panelHeader">
          <div>
            <p className="summaryLabel">Grafana-style Board</p>
            <h2 className="panelTitle">I/O выпущенных iSCSI-дисков</h2>
            <p className="panelSubtitle">
              Overview показывает только тома, реально выпущенные пользователям через iSCSI.
            </p>
          </div>
          <div className={`statusPill ${isLoading ? "" : "statusDone"}`}>
            {isLoading ? "Syncing" : systemUpdatedAt}
          </div>
        </div>

        <section className="summaryGrid summaryGridOverview">
          <MetricSummaryCard
            label="Активные диски"
            value={String(activeDisks)}
            meta="Томов в рабочем состоянии по текущему inventory."
          />
          <MetricSummaryCard
            label="Issued throughput"
            value={formatCompactBytesPerSecond(system?.throughput_bytes_per_sec ?? 0)}
            meta="Суммарный поток чтения и записи по выпущенным iSCSI-томам."
          />
          <MetricSummaryCard
            label="Issued busy"
            value={formatPercent(system?.peak_busy_percent ?? 0)}
            meta="Оценочная peak-нагрузка по выпущенным iSCSI-томам."
          />
          <MetricSummaryCard
            label="IOPS"
            value={formatCompactNumber(system?.total_iops ?? 0)}
            meta="Суммарные операции ввода-вывода за секунду."
          />
        </section>

        <section className="overviewChartsGrid">
          <TimeSeriesCard
            accentClassName="chartToneAmber"
            history={monitoringHistory}
            label="Throughput"
            value={formatCompactBytesPerSecond(system?.throughput_bytes_per_sec ?? 0)}
            valueKey="throughput_bytes_per_sec"
          />
          <TimeSeriesCard
            accentClassName="chartToneCyan"
            history={monitoringHistory}
            label="IOPS"
            value={formatCompactNumber(system?.total_iops ?? 0)}
            valueKey="total_iops"
          />
          <TimeSeriesCard
            accentClassName="chartToneRed"
            history={monitoringHistory}
            label="Busy"
            value={formatPercent(system?.peak_busy_percent ?? 0)}
            valueKey="busy_percent"
          />
        </section>
      </section>

      <section className="contentGrid overviewProfileGrid">
        <section className="panel panelMain overviewPanel">
          <div className="panelHeader">
            <div>
              <p className="summaryLabel">Runtime Context</p>
              <h2 className="panelTitle">Текущий профиль</h2>
              <p className="panelSubtitle">
                Быстрый срез по текущей учётной записи и её доле в storage-нагрузке.
              </p>
            </div>
            <div className="statusPill">{isAdmin ? "Admin access" : "User access"}</div>
          </div>

          <section className="identityShell">
            <div className="identityCard">
              <p className="summaryLabel">Пользователь</p>
              <p className="identityName">{displayName}</p>
              <p className="identityMeta">{userMeta}</p>
            </div>
            <div className="identityCard">
              <p className="summaryLabel">Нагрузка</p>
              <p className="identityName">
                {formatCompactBytesPerSecond(currentUserAggregate?.throughput_bytes_per_sec ?? 0)}
              </p>
              <p className="identityMeta">
                Оценочная доля I/O для дисков пользователя по данным monitoring snapshot.
              </p>
            </div>
          </section>

          <section className="quickInfoGrid">
            <MetricSummaryCard
              label="Томов"
              value={String(activeDisks)}
              meta="Активных дисков в зоне ответственности."
            />
            <MetricSummaryCard
              label="Объём"
              value={`${formatCompactNumber(totalDiskSize)} GB`}
              meta="Суммарный выделенный объём под управлением."
            />
            <MetricSummaryCard
              label="User IOPS"
              value={formatCompactNumber(currentUserAggregate?.total_iops ?? 0)}
              meta="Оценочная пользовательская I/O-нагрузка."
            />
            <MetricSummaryCard
              label="User busy"
              value={formatPercent(currentUserAggregate?.busy_percent ?? 0)}
              meta="Оценочная доля загрузки storage-пула."
            />
          </section>
        </section>

        <aside className="panel panelSide overviewPanel">
          <div className="panelHeader">
            <div>
              <p className="summaryLabel">Logical layer</p>
              <h2 className="panelTitle">Top volumes</h2>
              <p className="panelSubtitle">
                Диски пользователей с наибольшей оценочной I/O-нагрузкой среди выпущенных iSCSI-томов.
              </p>
            </div>
          </div>

          <div className="miniRanking">
            {sideRankingItems.map((item, index) => (
              <RankingRow
                key={item.id}
                index={index}
                label={item.label}
                meta={item.meta}
                value={item.value}
              />
            ))}
          </div>

          <div className="stageGrid">
            <button type="button" className="stageCard stageButton" onClick={onOpenDisks}>
              <p className="stageIndex">01</p>
              <p className="stageName">Диски</p>
              <p className="stageText">Открыть inventory и перейти к рабочим томам.</p>
            </button>
          </div>
        </aside>
      </section>

      <section className="panel panelMain overviewPanel overviewPanelNews">
        <div className="panelHeader">
          <div>
            <p className="summaryLabel">Monitoring Breakdown</p>
            <h2 className="panelTitle">{isAdmin ? "Пользователи и устройства" : "Мои диски"}</h2>
            <p className="summaryMeta">
              {isAdmin
                ? "Сводка по самым загруженным пользователям и физическим дискам."
                : "Список дисков пользователя с оценочной долей I/O-нагрузки."}
            </p>
          </div>
          <div className="statusPill">EDA feed</div>
        </div>

        <section className="newsGrid monitoringBoardGrid">
          <article className="monitorPanel">
            <p className="summaryLabel">{isAdmin ? "Top users" : "My disks"}</p>
            <div className="monitorList">
              {boardItems.map((item, index) => (
                <MonitorListRow
                  key={item.id}
                  index={index}
                  label={item.label}
                  value={item.value}
                  subValue={item.subValue}
                  ratio={item.ratio}
                />
              ))}
            </div>
          </article>

          <article className="monitorPanel">
            <p className="summaryLabel">Issued pool</p>
            <div className="monitorFeatureCard">
              <p className="panelTitle">iSCSI production slice</p>
              <p className="monitorHeroValue">{formatCompactBytesPerSecond(system?.throughput_bytes_per_sec ?? 0)}</p>
              <p className="summaryMeta">
                {formatCompactNumber(system?.total_iops ?? 0)} IOPS{" • "}
                {formatPercent(system?.peak_busy_percent ?? 0)} busy
              </p>
            </div>
          </article>

          <article className="monitorPanel">
            <p className="summaryLabel">Read / Write split</p>
            <ReadWriteSplit
              readValue={system?.read_bytes_per_sec ?? 0}
              writeValue={system?.write_bytes_per_sec ?? 0}
            />
          </article>
        </section>
      </section>
    </section>
  );
}

function MetricSummaryCard({
  label,
  value,
  meta
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article className="summaryCard">
      <p className="summaryLabel">{label}</p>
      <p className="summaryValue">{value}</p>
      <p className="summaryMeta">{meta}</p>
    </article>
  );
}

function TimeSeriesCard({
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
            <linearGradient id={`${accentClassName}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={chartPoints.areaPath} fill={`url(#${accentClassName}-fill)`} />
          <path d={chartPoints.linePath} className="sparklineStroke" />
        </svg>
      </div>
      <p className="summaryMeta">
        {history.length > 1
          ? `Последние ${history.length} snapshot-точек из monitoring topic.`
          : "Ожидание накопления тайм-серии."}
      </p>
    </article>
  );
}

function RankingRow({
  index,
  label,
  meta,
  value
}: {
  index: number;
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <article className="rankingRow">
      <p className="rankingIndex">{String(index + 1).padStart(2, "0")}</p>
      <div className="rankingBody">
        <p className="rankingLabel">{label}</p>
        <p className="rankingMeta">{meta}</p>
      </div>
      <p className="rankingValue">{value}</p>
    </article>
  );
}

function MonitorListRow({
  index,
  label,
  value,
  subValue,
  ratio
}: {
  index: number;
  label: string;
  value: string;
  subValue: string;
  ratio: number;
}) {
  return (
    <article className="monitorListRow">
      <div className="monitorListHead">
        <p className="rankingIndex">{String(index + 1).padStart(2, "0")}</p>
        <div className="rankingBody">
          <p className="rankingLabel">{label}</p>
          <p className="rankingMeta">{subValue}</p>
        </div>
        <p className="rankingValue">{value}</p>
      </div>
      <div className="monitorBarTrack">
        <div className="monitorBarFill" style={{ width: `${ratio}%` }} />
      </div>
    </article>
  );
}

function ReadWriteSplit({
  readValue,
  writeValue
}: {
  readValue: number;
  writeValue: number;
}) {
  const total = Math.max(readValue + writeValue, 1);
  const readRatio = (readValue / total) * 100;
  const writeRatio = (writeValue / total) * 100;

  return (
    <div className="splitPanel">
      <div className="splitBar">
        <div className="splitBarRead" style={{ width: `${readRatio}%` }} />
        <div className="splitBarWrite" style={{ width: `${writeRatio}%` }} />
      </div>
      <div className="splitLegend">
        <div className="splitLegendRow">
          <span className="splitDot splitDotRead" />
          <p className="summaryMeta">Read</p>
          <p className="rankingValue">{formatCompactBytesPerSecond(readValue)}</p>
        </div>
        <div className="splitLegendRow">
          <span className="splitDot splitDotWrite" />
          <p className="summaryMeta">Write</p>
          <p className="rankingValue">{formatCompactBytesPerSecond(writeValue)}</p>
        </div>
      </div>
    </div>
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
