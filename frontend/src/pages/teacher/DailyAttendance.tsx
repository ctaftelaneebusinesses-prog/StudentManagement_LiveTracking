import { useEffect, useMemo, useState } from 'react';
import { getDailyAttendance } from '../../api/attendanceApi';
import { AttendancePieChart } from '../../components/attendance/AttendanceChart';
import type { AttendanceStatus } from '@/types/dashboard.types';

interface RosterRow {
  student_id: string;
  student_name: string;
  status: AttendanceStatus | null;
}

export default function DailyAttendance({ classId }: { classId: number }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDailyAttendance(classId, date)
      .then((res) => setRoster(res.data.data))
      .finally(() => setLoading(false));
  }, [classId, date]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, half_day: 0, leave: 0, excused: 0 };
    roster.forEach((r) => {
      if (r.status) c[r.status] += 1;
    });
    return c;
  }, [roster]);

  return (
    <div className="attendance-daily">
      <label>
        Date:{' '}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
      </label>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <AttendancePieChart present={counts.present} absent={counts.absent} late={counts.late} excused={counts.excused} />
          <table>
            <thead>
              <tr><th>Student</th><th>Status</th></tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.student_id}>
                  <td>{r.student_name}</td>
                  <td>{r.status ?? 'Not marked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
