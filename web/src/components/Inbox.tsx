import { useInbox, useApprovePlan, useRejectPlan } from "../hooks/usePages";
import type { Plan } from "../types";

export function Inbox() {
  const { data: plans, isLoading } = useInbox();
  const approvePlan = useApprovePlan();
  const rejectPlan = useRejectPlan();

  if (isLoading) return <div className="loading">Loading inbox...</div>;

  return (
    <div className="page-section">
      <h1>Inbox</h1>

      {!plans?.length && <p className="empty">No plans.</p>}

      {(plans as Plan[] | undefined)?.map((plan) => (
        <div key={plan.id} className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">{plan.title}</h3>
              <span className={`status status-${plan.status}`}>{plan.status}</span>
            </div>
            {plan.status === "pending" && (
              <div className="card-actions">
                <button
                  onClick={() => approvePlan.mutate(plan.id)}
                  disabled={approvePlan.isPending}
                  className="btn btn-sm btn-success"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectPlan.mutate(plan.id)}
                  disabled={rejectPlan.isPending}
                  className="btn btn-sm btn-danger"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <p className="card-text">{plan.summary}</p>
          {plan.steps?.length > 0 && (
            <ul className="plan-steps">
              {plan.steps.map((s, i) => (
                <li key={i}>
                  {s.action} <code>{s.target}</code> — {s.description}
                </li>
              ))}
            </ul>
          )}
          {plan.error && <p className="plan-error">Error: {plan.error}</p>}
        </div>
      ))}
    </div>
  );
}
