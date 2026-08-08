import { useEffect, useState } from 'react';
import { getDailyAttendance, markAttendance, type AttendanceStatus, type MarkAttendanceEntry } from '../../api/attendanceApi';

interface RosterRow {
  student_id: string;
  student_name: string;
  attendance_id: string | null;
  status: AttendanceStatus | null;
  remarks: string | null;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'leave', 'excused'];

// Replace with your real class-selector (dropdown fed by the teacher's assigned classes).
export default function MarkAttendance({ classId }: { classId: number }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  async function loadRoster() {
    setLoading(true);
    try {
      const res = await getDailyAttendance(classId, date);
      const rows: RosterRow[] = res.data.data;
      setRoster(rows);
      const initStatus: Record<string, AttendanceStatus> = {};
      const initRemarks: Record<string, string> = {};
      rows.forEach((r) => {
        initStatus[r.student_id] = r.status ?? 'present';
        initRemarks[r.student_id] = r.remarks ?? '';
      });
      setStatusMap(initStatus);
      setRemarksMap(initRemarks);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const entries: MarkAttendanceEntry[] = roster.map((r) => ({
        student_id: r.student_id,
        status: statusMap[r.student_id],
        remarks: remarksMap[r.student_id] || undefined,
      }));
      await markAttendance(classId, date, entries);
      await loadRoster();
    } finally {
      setSaving(false);
    }
  }

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach((r) => (next[r.student_id] = status));
    setStatusMap(next);
  }

  return (
    <div className="attendance-mark">
      <div className="attendance-mark__toolbar">
        <label>
          Date:{' '}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        </label>
        <button type="button" onClick={() => markAll('present')}>Mark all present</button>
      </div>

      {loading ? (
        <p>Loading roster...</p>
      ) : (
        <table className="attendance-mark__table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.student_id}>
                <td>{r.student_name}</td>
                <td>
                  <select
                    value={statusMap[r.student_id]}
                    onChange={(e) =>
                      setStatusMap((prev) => ({ ...prev, [r.student_id]: e.target.value as AttendanceStatus }))
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={remarksMap[r.student_id] ?? ''}
                    onChange={(e) => setRemarksMap((prev) => ({ ...prev, [r.student_id]: e.target.value }))}
                    placeholder="Optional remarks"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={handleSave} disabled={saving || loading}>
        {saving ? 'Saving...' : 'Save attendance'}
      </button>
    </div>
  );
}
