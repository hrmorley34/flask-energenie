type CurrentStatusSectionProps = {
  devices: readonly number[];
  statusTargets: Record<string, boolean>;
};

export function CurrentStatusSection({
  devices,
  statusTargets,
}: CurrentStatusSectionProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Current Switch Status
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {devices.map((device) => {
          const target = statusTargets[String(device)];
          const isOn = target === true;
          const isOff = target === false;

          const cardClass = isOn
            ? "border-emerald-300 bg-emerald-50"
            : isOff
              ? "border-rose-300 bg-rose-50"
              : "border-slate-300 bg-slate-50";

          const textClass = isOn
            ? "text-emerald-700"
            : isOff
              ? "text-rose-700"
              : "text-slate-700";

          const label = isOn ? "ON" : isOff ? "OFF" : "UNSET";
          return (
            <article
              key={device}
              className={`rounded-xl border p-4 ${cardClass}`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Device {device}
              </p>
              <p className={`mt-2 text-2xl font-semibold ${textClass}`}>
                {label}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
