import { ModerationRecord } from "./types";

const records: ModerationRecord[] = [];

export function addRecord(record: ModerationRecord): void {
  records.push(record);
}

export function getAllRecords(): ModerationRecord[] {
  return records;
}

export function getRecordById(id: string): ModerationRecord | undefined {
  return records.find((r) => r.id === id);
}
