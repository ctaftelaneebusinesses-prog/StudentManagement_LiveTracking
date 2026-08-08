import { useEffect, useState } from 'react';
import { editAttendance, getAttendanceHistory, type AttendanceStatus } from '../../api/attendanceApi';

interface HistoryEntry {
  id: string;
  old_status: AttendanceStatus | null;
  new_status: AttendanceStatus;
  change_reason: string | null;
  changed_at: string;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'leave', 'excused'];

export default function EditAttendance({
  attendanceId,
  studentName,
  currentStatus,
  currentRemarks,
  onSaved,
}: {
  attendanceId: number;
  studentName: string;
  currentStatus: AttendanceStatus;
  currentRemarks: string;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(currentStatus);
  const [remarks, setRemarks] = useState(currentRemarks);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceId]);

  async function loadHistory() {
    const res = await getAttendanceHistory(String(attendanceId));
    setHistory(res.data.data);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await editAttendance(String(attendanceId), status, remarks || undefined);
      await loadHistory();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="attendance-edit">
      <h3>Edit attendance — {studentName}</h3>

      <label>
        Status:
        <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label>
        Remarks:
        <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </label>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save changes'}
      </button>

      <h4>Change history</h4>
      {history.length === 0 ? (
        <p>No edits yet.</p>
      ) : (
        <ul className="attendance-edit__history">
          {history.map((h) => (
            <li key={h.id}>
              {new Date(h.changed_at).toLocaleString()}: {h.old_status ?? '—'} → {h.new_status}
              {h.change_reason ? ` (${h.change_reason})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
