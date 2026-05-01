import React, { useEffect, useState } from "react";
import { API } from "../api";

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [categoryData, setCategoryData] = useState({});
  const [transactions, setTransactions] = useState([]); // ✅ NEW
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [summaryRes, categoryRes, txnRes] = await Promise.all([
          API.get("/transactions/summary"),
          API.get("/transactions/category-summary"),
          API.get("/transactions"), // ✅ IMPORTANT FIX
        ]);

        if (!isMounted) return;

        setSummary(summaryRes?.data || {});
        setCategoryData(categoryRes?.data || {});
        setTransactions(txnRes?.data || []); // ✅ FIX
      } catch (err) {
        console.error("Dashboard load error:", err);

        if (!isMounted) return;

        setSummary({});
        setCategoryData({});
        setTransactions([]);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const toNumber = (val) => (isNaN(Number(val)) ? 0 : Number(val));

  const income = toNumber(summary.income);
  const expense = toNumber(summary.expense);
  const investment = toNumber(summary.investment);
  const asset = toNumber(summary.asset);
  const liability = toNumber(summary.liability);

  const net = income - expense;

  const categoryPairs = Object.entries(categoryData || {})
    .map(([k, v]) => [k, toNumber(v)])
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="page">

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Quick overview of your finance activity.</p>
        </div>

        <span className="pill">
          {loading ? "Loading…" : "Live"}
        </span>
      </div>

      {/* TOP GRID */}
      <div className="grid">
        <Card title="Income" value={income} />
        <Card title="Expense" value={expense} />
        <Card title="Net" value={net} />
        <Card title="Investment" value={investment} />
        <Card title="Asset" value={asset} />
        <Card title="Liability" value={liability} />
      </div>

      {/* TRANSACTIONS LIST ✅ NEW SECTION */}
      <div className="card">
        <div className="card-title">Recent Transactions</div>

        {transactions.length === 0 ? (
          <p>No transactions found</p>
        ) : (
          transactions.slice(0, 10).map((t) => (
            <div key={t._id} className="list-item">
              <span>
                {t.type} {t.category ? `(${t.category})` : ""}
              </span>
              <strong>₹ {toNumber(t.amount).toFixed(2)}</strong>
            </div>
          ))
        )}
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div className="grid">
        <div className="card" style={{ gridColumn: "span 7" }}>
          <div className="card-title">Expense Breakdown</div>

          <div className="list">
            {categoryPairs.length === 0 ? (
              <div className="list-item">
                <span>No expense data</span>
                <strong>₹0</strong>
              </div>
            ) : (
              categoryPairs.slice(0, 10).map(([key, value]) => (
                <div className="list-item" key={key}>
                  <span style={{ textTransform: "capitalize" }}>
                    {key}
                  </span>
                  <strong>₹{value.toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 5" }}>
          <div className="card-title">Health</div>

          <div className="list">
            <div className="list-item">
              <span>Saving rate</span>
              <strong>
                {income > 0 ? `${((net / income) * 100).toFixed(1)}%` : "—"}
              </strong>
            </div>

            <div className="list-item">
              <span>Expense ratio</span>
              <strong>
                {income > 0 ? `${((expense / income) * 100).toFixed(1)}%` : "—"}
              </strong>
            </div>

            <div className="list-item">
              <span>Loan balance</span>
              <strong>₹{(asset - liability).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* CARD */
function Card({ title, value }) {
  return (
    <div className="card" style={{ gridColumn: "span 4" }}>
      <div className="card-title">{title}</div>
      <div className="card-value">₹ {value.toFixed(2)}</div>
    </div>
  );
}
