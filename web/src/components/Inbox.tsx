import { useInbox, useApprovePlan, useRejectPlan } from "../hooks/usePages";

export function Inbox() {
  const { data: plans, isLoading } = useInbox();
  const approvePlan = useApprovePlan();
  const rejectPlan = useRejectPlan();

  if (isLoading) return <div style={{ padding: 32 }}>Loading inbox...</div>;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 800 }}>
      <h1 style={{ marginBottom: 24 }}>Inbox</h1>

      {!plans?.length && <p style={{ color: "#666" }}>No plans.</p>}

      {plans?.map((plan: any) => (
        <div
          key={plan.id}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{plan.title}</h3>
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background:
                    plan.status === "done" ? "#d4edda" :
                    plan.status === "failed" ? "#f8d7da" :
                    plan.status === "approved" ? "#cce5ff" :
                    plan.status === "rejected" ? "#f8d7da" :
                    "#fff3cd",
                  color:
                    plan.status === "done" ? "#155724" :
                    plan.status === "failed" ? "#721c24" :
                    plan.status === "approved" ? "#004085" :
                    plan.status === "rejected" ? "#721c24" :
                    "#856404",
                }}
              >
                {plan.status}
              </span>
            </div>
            {plan.status === "pending" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => approvePlan.mutate(plan.id)}
                  disabled={approvePlan.isPending}
                  style={{
                    padding: "6px 14px",
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectPlan.mutate(plan.id)}
                  disabled={rejectPlan.isPending}
                  style={{
                    padding: "6px 14px",
                    background: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <p style={{ margin: "8px 0", fontSize: 14 }}>{plan.summary}</p>
          {plan.steps?.length > 0 && (
            <ul style={{ fontSize: 13, paddingLeft: 20, color: "#555" }}>
              {plan.steps.map((s: any, i: number) => (
                <li key={i}>
                  {s.action} <code>{s.target}</code> — {s.description}
                </li>
              ))}
            </ul>
          )}
          {plan.error && (
            <p style={{ color: "#dc3545", fontSize: 13, marginTop: 8 }}>Error: {plan.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
