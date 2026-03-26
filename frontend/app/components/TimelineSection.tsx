import { DatedEvent, RepeatingEvent } from "../schedule-api";
import { DAY_HEIGHT_PX, DaySummary, HOUR_HEIGHT_PX } from "../page-types";
import {
  buildCarryOverOccurrence,
  buildOccurrences,
  buildPeriods,
  classForPeriod,
  formatTs,
  minutesSinceDayStart,
} from "../page-utils";

type TimelineSectionProps = {
  days: DaySummary[];
  devices: readonly number[];
  repeating: RepeatingEvent[];
  dated: DatedEvent[];
};

export function TimelineSection({
  days,
  devices,
  repeating,
  dated,
}: TimelineSectionProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        7 Day Event Timeline
      </h2>
      <div className="mb-4">
        <p className="text-xs text-slate-500">
          Time runs vertically once on the left. For each day, devices 1-4 are
          shown in parallel side-by-side lanes.
        </p>
      </div>
      <div className="max-h-[72vh] overflow-auto">
        <div className="min-w-[1200px] space-y-2">
          <div className="grid grid-cols-[58px_repeat(7,minmax(150px,1fr))] gap-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Time
            </div>
            {days.map((day) => (
              <div
                key={day.key}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <p className="text-center text-xs font-semibold text-slate-600">
                  {day.label}
                </p>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {devices.map((device) => (
                    <p
                      key={`${day.key}-device-header-${device}`}
                      className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      D{device}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[58px_repeat(7,minmax(150px,1fr))] gap-2">
            <div
              className="relative rounded-md border border-slate-200 bg-slate-50"
              style={{ height: `${DAY_HEIGHT_PX}px` }}
            >
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={`hour-label-${hour}`}
                  className="absolute left-1 text-[10px] leading-none text-slate-500"
                  style={{ top: `${hour * HOUR_HEIGHT_PX + 2}px` }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((day) => (
              <div
                key={`${day.key}-lanes`}
                className="relative rounded-md border border-slate-200 bg-white"
                style={{ height: `${DAY_HEIGHT_PX}px` }}
              >
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div
                    key={`${day.key}-line-${hour}`}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: `${hour * HOUR_HEIGHT_PX}px` }}
                  />
                ))}

                <div className="relative grid h-full grid-cols-4 gap-1">
                  {devices.map((device) => {
                    const carryOver = buildCarryOverOccurrence(
                      day,
                      device,
                      repeating,
                      dated,
                    );
                    const occurrences = buildOccurrences(
                      day,
                      device,
                      repeating,
                      dated,
                    );
                    const periods = buildPeriods(
                      carryOver ? [carryOver, ...occurrences] : occurrences,
                      day.end,
                    );

                    return (
                      <div
                        key={`${day.key}-${device}`}
                        className="relative h-full rounded border border-slate-200 bg-slate-50/60"
                      >
                        {periods.map((period, index) => {
                          const startMinute = minutesSinceDayStart(
                            period.start,
                            day.start,
                          );
                          const endMinute = minutesSinceDayStart(
                            period.end,
                            day.start,
                          );
                          const top = startMinute * (DAY_HEIGHT_PX / 1440);
                          const height = Math.max(
                            8,
                            (endMinute - startMinute) * (DAY_HEIGHT_PX / 1440),
                          );

                          return (
                            <div
                              key={`${day.key}-${device}-${index}`}
                              className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1 py-0.5 text-[9px] ${classForPeriod(period)}`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                              title={`Device ${device} | ${period.label} | ${formatTs(period.start)} - ${formatTs(period.end)} | ${period.action.toUpperCase()} ${period.sourceType}`}
                            >
                              <p className="truncate font-semibold">
                                {period.action.toUpperCase()}
                              </p>
                              <p className="truncate">
                                {formatTs(period.start)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
