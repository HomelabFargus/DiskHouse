import { Kafka, KafkaJSProtocolError, logLevel } from "kafkajs";

export type StageOutput = {
  service: string;
  message: string;
};

export type FrontendUpdate = {
  request_id: string;
  service: string;
  message: string;
  outputs: StageOutput[];
  complete: boolean;
};

export type MonitoringDeviceSummary = {
  device_name: string;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
  inflight_ios: number;
};

export type MonitoringLogicalDiskSummary = {
  disk_id: string;
  name: string;
  owner_sub: string;
  owner_display: string;
  size_gb: number;
  status: string;
  iscsi_status: string;
  source_device_name: string;
  estimated_share_ratio: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
};

export type MonitoringUserSummary = {
  owner_sub: string;
  owner_display: string;
  disk_count: number;
  total_size_gb: number;
  estimated_share_ratio: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  busy_percent: number;
};

export type MonitoringSystemSummary = {
  active_device_count: number;
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_iops: number;
  write_iops: number;
  throughput_bytes_per_sec: number;
  total_iops: number;
  avg_busy_percent: number;
  peak_busy_percent: number;
  inflight_ios: number;
};

export type MonitoringSnapshot = {
  generated_at_ms: number;
  sample_window_ms: number;
  logical_disks: MonitoringLogicalDiskSummary[];
  users: MonitoringUserSummary[];
  system: MonitoringSystemSummary;
  storage_device: MonitoringDeviceSummary | null;
  physical_disks: MonitoringDeviceSummary[];
};

const brokers = process.env.KAFKA_BROKERS?.split(",") ?? [
  "kafka-worker-1:19092",
  "kafka-worker-2:19092",
  "kafka-worker-3:19092"
];

const updatesTopic = process.env.FRONTEND_UPDATES_TOPIC ?? "eda.frontend.updates";
const monitoringTopic = process.env.FRONTEND_MONITORING_TOPIC ?? "eda.monitoring.io";

function createKafka() {
  return new Kafka({
    clientId: "diskhouse-frontend",
    brokers,
    logLevel: logLevel.NOTHING
  });
}

export async function readWorkflowState(requestId: string) {
  const kafka = createKafka();
  const consumer = kafka.consumer({
    groupId: `frontend-read-${requestId}-${Date.now()}`
  });

  const state: { latestEvent: FrontendUpdate | null } = {
    latestEvent: null
  };

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: updatesTopic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const payload = message.value?.toString();

        if (!payload) {
          return;
        }

        const event = JSON.parse(payload) as FrontendUpdate;

        if (event.request_id === requestId) {
          state.latestEvent = event;
        }
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 800));
  } catch (error) {
    if (
      error instanceof KafkaJSProtocolError &&
      error.type === "UNKNOWN_TOPIC_OR_PARTITION"
    ) {
      return {
        requestId,
        complete: false,
        updates: [] as StageOutput[]
      };
    }

    throw error;
  } finally {
    await consumer.disconnect().catch(() => undefined);
  }

  return {
    requestId,
    complete: state.latestEvent?.complete ?? false,
    updates: state.latestEvent?.outputs ?? []
  };
}

export async function readMonitoringState() {
  const kafka = createKafka();
  const consumer = kafka.consumer({
    groupId: `frontend-monitoring-${Date.now()}`
  });

  const state: { latestEvent: MonitoringSnapshot | null } = {
    latestEvent: null
  };

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: monitoringTopic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const payload = message.value?.toString();

        if (!payload) {
          return;
        }

        state.latestEvent = JSON.parse(payload) as MonitoringSnapshot;
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    if (
      error instanceof KafkaJSProtocolError &&
      error.type === "UNKNOWN_TOPIC_OR_PARTITION"
    ) {
      return null;
    }

    throw error;
  } finally {
    await consumer.disconnect().catch(() => undefined);
  }

  return state.latestEvent;
}
